import { BadRequestException } from '@nestjs/common';
import { CashBookPostingService } from '../../src/cash-book/cash-book-posting.service';
import { LoyaltyService } from '../../src/loyalty/loyalty.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import {
  PostingDraft,
  SalesPostingService,
} from '../../src/sales/sales-posting.service';
import {
  InsufficientStockException,
  PaymentRuleException,
  PriceChangedException,
} from '../../src/sales/sales.errors';
import { closeTestDb, resetTestDb, testDb } from './db';
import { onHand, SalesFixtures, seedSalesFixtures } from './sales-fixtures';

describe('SalesPostingService', () => {
  let posting: SalesPostingService;
  let loyalty: LoyaltyService;
  let fx: SalesFixtures;

  const baseDraft = (over: Partial<PostingDraft> = {}): PostingDraft => ({
    channel: 'pos',
    status: 'completed',
    store_id: fx.store.id,
    customer_id: null,
    discount_type: 'fixed',
    discount_value: 0,
    created_by: fx.users.sales_associate,
    lines: [{ product_id: fx.products.jeans, quantity: 2 }],
    payments: [
      {
        payment_method: 'cash',
        amount: 2_000_000,
        amount_tendered: 2_000_000,
        change_given: 0,
      },
    ],
    ...over,
  });

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    loyalty = new LoyaltyService(prisma);
    posting = new SalesPostingService(
      prisma,
      new PriceResolverService(prisma),
      loyalty,
      new CashBookPostingService(prisma),
    );
  });
  afterAll(closeTestDb);

  it('posts a paid sale: order, lines at server prices, stock, payment, no receivable', async () => {
    const before = await onHand(fx.store.locationId, fx.products.jeans);
    const order = await posting.createOrder(baseDraft());
    expect(order.status).toBe('completed');
    expect(order.payment_status).toBe('paid');
    expect(order.order_number).toMatch(/^SO-\d{8}-\d{4}$/);
    expect(Number(order.total_amount)).toBe(2_000_000);
    expect(order.sales_order_items).toHaveLength(1);
    expect(Number(order.sales_order_items[0].unit_cost)).toBe(500_000);
    expect(await onHand(fx.store.locationId, fx.products.jeans)).toBe(
      before - 2,
    );
    const moves = await testDb.inventory_transactions.findMany({
      where: { reference_id: order.id, transaction_type: 'SALE' },
    });
    expect(moves).toHaveLength(1);
    expect(Number(moves[0].unit_cost)).toBe(500_000);
    expect(
      await testDb.customer_receivables.count({
        where: { sales_order_id: order.id },
      }),
    ).toBe(0);
  });

  it('uses the sale price inside its window and the variant adjustment, ignoring client prices', async () => {
    const order = await posting.createOrder(
      baseDraft({
        lines: [
          {
            product_id: fx.products.exhaust,
            quantity: 1,
            expected_unit_price: 1,
          }, // not enforced here
          {
            product_id: fx.products.master,
            product_variant_id: fx.variants.size32,
            quantity: 1,
          },
        ],
        payments: [{ payment_method: 'card', amount: 2_500_000 + 1_600_000 }],
      }),
    );
    const bySku = Object.fromEntries(
      order.sales_order_items.map((i) => [i.product_sku, Number(i.unit_price)]),
    );
    expect(bySku).toEqual({ 'EXH-X': 2_500_000, 'JEANS-B-32': 1_600_000 });
    expect(Number(order.total_amount)).toBe(4_100_000);
    // the variant movement only touched the variant's stock row
    expect(
      await onHand(fx.store.locationId, undefined, fx.variants.size32),
    ).toBe(fx.stock.size32 - 1);
    expect(await onHand(fx.store.locationId, fx.products.master)).toBe(0);
  });

  it('rejects a POS checkout whose expected price differs (price changed)', async () => {
    await expect(
      posting.createOrder(
        baseDraft({
          enforcePrice: true,
          lines: [
            {
              product_id: fx.products.jeans,
              quantity: 1,
              expected_unit_price: 900_000,
            },
          ],
          payments: [{ payment_method: 'cash', amount: 900_000 }],
        }),
      ),
    ).rejects.toBeInstanceOf(PriceChangedException);
  });

  it('refuses insufficient stock and writes nothing', async () => {
    const ordersBefore = await testDb.sales_orders.count();
    const stockBefore = await onHand(fx.store.locationId, fx.products.exhaust);
    await expect(
      posting.createOrder(
        baseDraft({
          lines: [
            { product_id: fx.products.jeans, quantity: 1 },
            { product_id: fx.products.exhaust, quantity: 3 },
          ],
          payments: [{ payment_method: 'cash', amount: 8_500_000 }],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockException);
    expect(await testDb.sales_orders.count()).toBe(ordersBefore);
    expect(await onHand(fx.store.locationId, fx.products.exhaust)).toBe(
      stockBefore,
    );
    expect(await testDb.sales_order_payments.count()).toBe(2); // only the two earlier orders' payments
  });

  it('a partly paid sale for a known customer records the balance as a receivable', async () => {
    const order = await posting.createOrder(
      baseDraft({
        customer_id: fx.customers.plain,
        allowCredit: true,
        lines: [{ product_id: fx.products.jeans, quantity: 3 }],
        payments: [{ payment_method: 'cash', amount: 1_000_000 }],
      }),
    );
    expect(order.payment_status).toBe('partial');
    const receivable = await testDb.customer_receivables.findFirst({
      where: { sales_order_id: order.id },
    });
    expect(receivable).toMatchObject({ status: 'partial' });
    expect(Number(receivable?.balance)).toBe(2_000_000);
    expect(Number(receivable?.paid_amount)).toBe(1_000_000);
  });

  it('refuses a walk-in sale that is not fully paid and a credit sale without permission', async () => {
    await expect(
      posting.createOrder(
        baseDraft({
          payments: [{ payment_method: 'cash', amount: 1_000_000 }],
        }),
      ),
    ).rejects.toBeInstanceOf(PaymentRuleException);
    await expect(
      posting.createOrder(
        baseDraft({
          customer_id: fx.customers.plain,
          payments: [{ payment_method: 'cash', amount: 1_000_000 }],
        }),
      ),
    ).rejects.toBeInstanceOf(PaymentRuleException);
    await expect(
      posting.createOrder(
        baseDraft({
          payments: [{ payment_method: 'card', amount: 2_500_000 }],
        }),
      ),
    ).rejects.toBeInstanceOf(PaymentRuleException);
  });

  it('applies discounts once and validates them', async () => {
    const order = await posting.createOrder(
      baseDraft({
        discount_type: 'fixed',
        discount_value: 100_000,
        lines: [
          {
            product_id: fx.products.jeans,
            quantity: 2,
            discount_amount: 50_000,
          }, // 2 x 950,000
          { product_id: fx.products.sticker, quantity: 1, tax_amount: 5_000 }, // 55,000
        ],
        payments: [
          { payment_method: 'cash', amount: 1_900_000 + 55_000 - 100_000 },
        ],
      }),
    );
    expect(Number(order.subtotal)).toBe(2_050_000);
    expect(Number(order.discount_amount)).toBe(100_000);
    expect(Number(order.tax_amount)).toBe(5_000);
    expect(Number(order.total_amount)).toBe(1_855_000);

    await expect(
      posting.createOrder(
        baseDraft({
          lines: [
            {
              product_id: fx.products.jeans,
              quantity: 1,
              discount_amount: 1_100_000,
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      posting.createOrder(
        baseDraft({ discount_type: 'percent', discount_value: 150 }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('redeems and earns loyalty points inside the same transaction', async () => {
    // member has 500 points; 1 point = 1,000 VND; max 20% of the order
    const order = await posting.createOrder(
      baseDraft({
        customer_id: fx.customers.member,
        points_to_redeem: 200,
        lines: [{ product_id: fx.products.jeans, quantity: 2 }], // 2,000,000
        payments: [{ payment_method: 'cash', amount: 1_800_000 }],
      }),
    );
    expect(Number(order.loyalty_discount_amount)).toBe(200_000);
    expect(Number(order.total_amount)).toBe(1_800_000);
    expect(order.payment_status).toBe('paid');
    // earn on 1,800,000 - 200,000 = 1,600,000 at 1 point / 10,000 VND = 160 points
    expect(order.loyalty_points_earned).toBe(160);
    const loyaltyRow = await testDb.customer_loyalty.findUniqueOrThrow({
      where: { customer_id: fx.customers.member },
    });
    expect(loyaltyRow.points_balance).toBe(500 - 200 + 160);
  });

  it('rejects an invalid redemption and records nothing', async () => {
    const before = await testDb.customer_loyalty.findUniqueOrThrow({
      where: { customer_id: fx.customers.member },
    });
    const ordersBefore = await testDb.sales_orders.count();
    await expect(
      posting.createOrder(
        baseDraft({
          customer_id: fx.customers.member,
          points_to_redeem: 10_000,
          payments: [{ payment_method: 'cash', amount: 1 }],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const after = await testDb.customer_loyalty.findUniqueOrThrow({
      where: { customer_id: fx.customers.member },
    });
    expect(after.points_balance).toBe(before.points_balance);
    expect(await testDb.sales_orders.count()).toBe(ordersBefore);
  });

  it('a draft moves no stock; confirming it deducts stock exactly once', async () => {
    const stockBefore = await onHand(fx.store.locationId, fx.products.sticker);
    const draft = await posting.createOrder(
      baseDraft({
        status: 'draft',
        customer_id: fx.customers.plain,
        lines: [{ product_id: fx.products.sticker, quantity: 4 }],
        payments: [],
      }),
    );
    expect(draft.status).toBe('draft');
    expect(await onHand(fx.store.locationId, fx.products.sticker)).toBe(
      stockBefore,
    );
    expect(
      await testDb.customer_receivables.count({
        where: { sales_order_id: draft.id },
      }),
    ).toBe(0);

    await testDb.$transaction(async (tx) => {
      await tx.sales_orders.update({
        where: { id: draft.id },
        data: { status: 'confirmed' },
      });
      await posting.postConfirmedIn(tx, draft.id, {});
      await posting.settleIn(tx, draft.id);
    });
    expect(await onHand(fx.store.locationId, fx.products.sticker)).toBe(
      stockBefore - 4,
    );
    // a second posting attempt (e.g. a retried confirm) does not deduct again
    await testDb.$transaction(async (tx) =>
      posting.postConfirmedIn(tx, draft.id, {}),
    );
    expect(await onHand(fx.store.locationId, fx.products.sticker)).toBe(
      stockBefore - 4,
    );
    const receivable = await testDb.customer_receivables.findFirst({
      where: { sales_order_id: draft.id },
    });
    expect(Number(receivable?.balance)).toBe(200_000);
  });

  it('assigns distinct order numbers to 20 concurrent orders and never reuses a cancelled one', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        posting.createOrder(
          baseDraft({
            lines: [{ product_id: fx.products.sticker, quantity: 1 }],
            payments: [{ payment_method: 'cash', amount: 50_000 }],
          }),
        ),
      ),
    );
    const numbers = results.map((o) => o.order_number);
    expect(new Set(numbers).size).toBe(20);
    numbers.forEach((n) => expect(n).toMatch(/^SO-\d{8}-\d{4}$/));

    const cancelled = results[0];
    await testDb.sales_orders.update({
      where: { id: cancelled.id },
      data: { status: 'cancelled' },
    });
    const next = await posting.createOrder(
      baseDraft({
        lines: [{ product_id: fx.products.sticker, quantity: 1 }],
        payments: [{ payment_method: 'cash', amount: 50_000 }],
      }),
    );
    expect(numbers).not.toContain(next.order_number);
    const all = await testDb.sales_orders.findMany({
      select: { order_number: true },
    });
    expect(new Set(all.map((o) => o.order_number)).size).toBe(all.length);
  });
});
