import { UserContextService } from '../../src/auth/user-context.service';
import { CashBookPostingService } from '../../src/cash-book/cash-book-posting.service';
import { LoyaltyService } from '../../src/loyalty/loyalty.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PaymentMethod } from '../../src/sales/dto/create-payment.dto';
import {
  OrderStatus,
  SalesChannel,
} from '../../src/sales/dto/create-sales-order.dto';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { SalesService } from '../../src/sales/sales.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { onHand, SalesFixtures, seedSalesFixtures } from './sales-fixtures';

/** The back-office sales-order flow (form: create draft, then confirm, then pay) on the shared posting service. */
describe('SalesService on SalesPostingService', () => {
  let service: SalesService;
  let fx: SalesFixtures;

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    const loyalty = new LoyaltyService(prisma);
    const posting = new SalesPostingService(
      prisma,
      new PriceResolverService(prisma),
      loyalty,
      new CashBookPostingService(prisma),
    );
    const userContext = {
      getUserId: () => fx.users.sales_associate,
      getUser: () => null,
    } as unknown as UserContextService;
    service = new SalesService(prisma, userContext, loyalty, posting, new CashBookPostingService(prisma));
  });
  afterAll(closeTestDb);

  const draftDto = (over: Record<string, unknown> = {}) => ({
    customer_id: fx.customers.plain,
    customer_name: 'ignored, taken from customer',
    channel: SalesChannel.RETAIL_STORE,
    store_id: fx.store.id,
    items: [
      {
        product_id: fx.products.jeans,
        quantity: 3,
        unit_price: 1 /* tampered, ignored */,
      },
    ],
    total_amount: 5 /* tampered, ignored */,
    ...over,
  });

  it('create + confirm deducts stock exactly once and keeps server-computed totals', async () => {
    const stockBefore = await onHand(fx.store.locationId, fx.products.jeans);
    const draft = await service.create(draftDto() as never);
    expect(draft.status).toBe(OrderStatus.DRAFT);
    expect(Number(draft.total_amount)).toBe(3_000_000); // 3 x 1,000,000 at server price
    expect(Number(draft.subtotal)).toBe(3_000_000);
    expect(draft.customer_name).toBe('Trần Văn Minh');
    expect(await onHand(fx.store.locationId, fx.products.jeans)).toBe(
      stockBefore,
    ); // draft holds no stock

    const confirmed = await service.confirm(draft.id);
    expect(confirmed.status).toBe(OrderStatus.CONFIRMED);
    expect(await onHand(fx.store.locationId, fx.products.jeans)).toBe(
      stockBefore - 3,
    );
    const moves = await testDb.inventory_transactions.count({
      where: { reference_id: draft.id, transaction_type: 'SALE' },
    });
    expect(moves).toBe(1);

    // stored subtotal equals the computed one (the 006 trigger no longer rewrites it)
    const stored = await testDb.sales_orders.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(Number(stored.subtotal)).toBe(3_000_000);
    const receivable = await testDb.customer_receivables.findFirst({
      where: { sales_order_id: draft.id },
    });
    expect(Number(receivable?.balance)).toBe(3_000_000);
    expect(receivable?.status).toBe('unpaid');
  });

  it('a payment reduces the receivable in the same transaction', async () => {
    const draft = await service.create(draftDto() as never);
    await service.confirm(draft.id);
    await service.addPayment({
      sales_order_id: draft.id,
      payment_method: PaymentMethod.CASH,
      amount: 1_000_000,
    });
    const receivable = await testDb.customer_receivables.findFirst({
      where: { sales_order_id: draft.id },
    });
    expect(Number(receivable?.balance)).toBe(2_000_000);
    expect(receivable?.status).toBe('partial');
    const order = await service.findOne(draft.id);
    expect(order.payment_status).toBe('partial');

    await service.addPayment({
      sales_order_id: draft.id,
      payment_method: PaymentMethod.BANK_TRANSFER,
      amount: 2_000_000,
    });
    const paid = await testDb.customer_receivables.findFirst({
      where: { sales_order_id: draft.id },
    });
    expect(Number(paid?.balance)).toBe(0);
    expect(paid?.status).toBe('paid');
    await expect(
      service.addPayment({
        sales_order_id: draft.id,
        payment_method: PaymentMethod.CASH,
        amount: 1,
      }),
    ).rejects.toThrow(/exceeds/);
  });

  it('confirming twice does not deduct twice', async () => {
    const stockBefore = await onHand(fx.store.locationId, fx.products.sticker);
    const draft = await service.create(
      draftDto({
        items: [
          { product_id: fx.products.sticker, quantity: 5, unit_price: 50_000 },
        ],
      }) as never,
    );
    await service.confirm(draft.id);
    await expect(service.confirm(draft.id)).rejects.toThrow(
      /Only draft orders/,
    );
    expect(await onHand(fx.store.locationId, fx.products.sticker)).toBe(
      stockBefore - 5,
    );
  });

  it('the cancel path still returns stock', async () => {
    const stockBefore = await onHand(fx.store.locationId, fx.products.sticker);
    const draft = await service.create(
      draftDto({
        items: [
          { product_id: fx.products.sticker, quantity: 2, unit_price: 50_000 },
        ],
      }) as never,
    );
    await service.confirm(draft.id);
    expect(await onHand(fx.store.locationId, fx.products.sticker)).toBe(
      stockBefore - 2,
    );
    await service.cancel(draft.id);
    expect(await onHand(fx.store.locationId, fx.products.sticker)).toBe(
      stockBefore,
    );
  });
});
