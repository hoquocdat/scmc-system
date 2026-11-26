import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import { CashBookPostingService } from '../../src/cash-book/cash-book-posting.service';
import { CaslAbilityFactory } from '../../src/casl/casl-ability.factory';
import { LoyaltyService } from '../../src/loyalty/loyalty.service';
import { CheckoutPaymentMethod } from '../../src/pos/dto/checkout.dto';
import { PosCheckoutService } from '../../src/pos/pos-checkout.service';
import { PosService } from '../../src/pos/pos.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ReturnRequestDto } from '../../src/sales-returns/dto/sales-returns.dto';
import { SalesReturnsService } from '../../src/sales-returns/sales-returns.service';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

/**
 * Task 5.1: one customer, one shift, figures computed by hand.
 *
 * Sale: jeans 1,000,000 + exhaust 2,500,000 + 4 stickers 200,000 = 3,700,000,
 *   order discount 370,000, 100 points redeemed (100,000) → paid 3,230,000 cash.
 *   Reductions 470,000 split by value (largest remainder):
 *   jeans 127,027 · exhaust 317,568 · stickers 25,405
 *   → paid values jeans 872,973 · exhaust 2,182,432 · stickers 174,595.
 * 1. Return the jeans, cash: −872,973 from the drawer; points restored round(100 × 872,973 / 3,230,000) = 27.
 * 2. Exchange 2 stickers (round(174,595 × 2/4) = 87,298) for jeans 1,000,000: customer pays 912,702 cash;
 *    points restored round(100 × 87,298 / 3,230,000) = 3.
 * 3. Return the last 2 stickers as credit: 174,595 − 87,298 = 87,297;
 *    points restored round(100 × 87,297 / 3,230,000) = 3 (27 + 3 + 3 = 33 of the 100 redeemed).
 * 4. Buy 1 sticker (50,000) with credit → credit 37,297; no cash book entry.
 * Drawer entries: +3,230,000 − 872,973 + 912,702 = 3,269,729; expected cash 1,000,000 + 3,269,729 = 4,269,729.
 * Stock: jeans −1 +1 −1 = −1; exhaust −1; stickers −4 +2 +2 −1 = −1.
 */
describe('sales returns: a full customer story', () => {
  let fx: SalesFixtures;
  let returns: SalesReturnsService;
  let checkout: PosCheckoutService;
  let shifts: PosService;

  const stock = async (productId: string) =>
    (
      await testDb.inventory.findFirstOrThrow({
        where: {
          location_id: fx.store.locationId,
          product_id: productId,
          product_variant_id: null,
        },
      })
    ).quantity_on_hand;

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    const cashBook = new CashBookPostingService(prisma);
    const loyalty = new LoyaltyService(prisma);
    const posting = new SalesPostingService(
      prisma,
      new PriceResolverService(prisma),
      loyalty,
      cashBook,
    );
    const casl = new CaslAbilityFactory(prisma);
    const activity = new ActivityLogsService(prisma);
    shifts = new PosService(prisma, casl, activity, cashBook);
    checkout = new PosCheckoutService(prisma, posting, casl, activity, {
      get: () => 'secret',
    } as unknown as ConfigService);
    returns = new SalesReturnsService(
      prisma,
      posting,
      cashBook,
      loyalty,
      casl,
      activity,
    );
    await testDb.inventory.updateMany({
      where: { location_id: fx.store.locationId },
      data: { quantity_on_hand: 500 },
    });
  });
  afterAll(closeTestDb);

  it('matches the hand-computed figures', async () => {
    const cashier = { id: fx.users.store_manager };
    const shift = await shifts.openShift(cashier, {
      store_id: fx.store.id,
      opening_cash: 1_000_000,
    });

    const sale = await checkout.checkout(cashier, {
      client_request_id: randomUUID(),
      customer_id: fx.customers.member,
      lines: [
        {
          product_id: fx.products.jeans,
          quantity: 1,
          expected_unit_price: 1_000_000,
        },
        {
          product_id: fx.products.exhaust,
          quantity: 1,
          expected_unit_price: 2_500_000,
        },
        {
          product_id: fx.products.sticker,
          quantity: 4,
          expected_unit_price: 50_000,
        },
      ],
      order_discount: { type: 'fixed', value: 370_000 },
      points_to_redeem: 100,
      payments: [
        {
          method: CheckoutPaymentMethod.CASH,
          amount: 3_230_000,
          amount_tendered: 3_230_000,
        },
      ],
    } as never);
    expect(Number(sale.total_amount)).toBe(3_230_000);
    const line = (productId: string) =>
      sale.sales_order_items.find((i) => i.product_id === productId).id;
    const earned =
      (await testDb.sales_orders.findUniqueOrThrow({ where: { id: sale.id } }))
        .loyalty_points_earned ?? 0;
    expect(earned).toBeGreaterThan(0);

    const lookup = await returns.lookup(sale.order_number);
    expect(
      Object.fromEntries(
        lookup.lines.map((l) => [l.product_sku, l.paid_value]),
      ),
    ).toEqual({
      'JEANS-A': 872_973,
      'EXH-X': 2_182_432,
      STICKER: 174_595,
    });

    // 1. jeans back for cash
    const r1 = await returns.create(cashier, {
      sales_order_id: sale.id,
      items: [{ sales_order_item_id: line(fx.products.jeans), quantity: 1 }],
      refunds: [{ method: 'cash', amount: 872_973 }],
    } as ReturnRequestDto);
    expect(r1.points_restored).toBe(27);
    expect(r1.points_reversed).toBe(Math.round((earned * 872_973) / 3_230_000));

    // 2. two stickers exchanged for jeans, customer pays the difference in cash
    const preview = await returns.preview(cashier, {
      sales_order_id: sale.id,
      items: [{ sales_order_item_id: line(fx.products.sticker), quantity: 2 }],
      exchange: { lines: [{ product_id: fx.products.jeans, quantity: 1 }] },
    } as ReturnRequestDto);
    expect([
      preview.goods_amount,
      preview.exchange_applied,
      preview.customer_pays,
    ]).toEqual([87_298, 87_298, 912_702]);
    const r2 = await returns.create(cashier, {
      sales_order_id: sale.id,
      items: [{ sales_order_item_id: line(fx.products.sticker), quantity: 2 }],
      exchange: {
        lines: [
          {
            product_id: fx.products.jeans,
            quantity: 1,
            expected_unit_price: 1_000_000,
          },
        ],
        payments: [
          { method: 'cash', amount: 912_702, amount_tendered: 912_702 },
        ],
      },
    } as ReturnRequestDto);
    expect(r2.points_restored).toBe(3);

    // 3. last two stickers kept as credit
    const r3 = await returns.create(cashier, {
      sales_order_id: sale.id,
      items: [{ sales_order_item_id: line(fx.products.sticker), quantity: 2 }],
      refunds: [{ method: 'store_credit', amount: 87_297 }],
    } as ReturnRequestDto);
    expect(Number(r3.goods_amount)).toBe(87_297);

    // 4. spend part of the credit
    const spend = await checkout.checkout(cashier, {
      client_request_id: randomUUID(),
      customer_id: fx.customers.member,
      lines: [
        {
          product_id: fx.products.sticker,
          quantity: 1,
          expected_unit_price: 50_000,
        },
      ],
      payments: [
        { method: CheckoutPaymentMethod.STORE_CREDIT, amount: 50_000 },
      ],
    } as never);
    expect((await returns.customerCredit(fx.customers.member)).balance).toBe(
      37_297,
    );
    expect(
      await testDb.cash_book_entries.count({
        where: {
          source_id: { in: spend.sales_order_payments.map((p) => p.id) },
        },
      }),
    ).toBe(0);

    // Drawer, shift and stock
    const drawer = await testDb.cash_book_entries.findMany({
      where: { account_id: fx.accounts.hcmDrawer, status: 'posted' },
    });
    expect(
      drawer.reduce(
        (s, e) => s + (e.direction === 'in' ? 1 : -1) * Number(e.amount),
        0,
      ),
    ).toBe(3_269_729);
    expect((await shifts.getSummary(shift.id, cashier)).expected_cash).toBe(
      4_269_729,
    );
    expect([
      await stock(fx.products.jeans),
      await stock(fx.products.exhaust),
      await stock(fx.products.sticker),
    ]).toEqual([499, 499, 499]);

    // Loyalty movements caused by the returns
    const loyaltyTx = await testDb.loyalty_point_transactions.findMany({
      where: { reference_type: 'sales_return' },
    });
    const restored = loyaltyTx
      .filter((t) => t.points > 0)
      .reduce((s, t) => s + t.points, 0);
    const reversed = -loyaltyTx
      .filter((t) => t.points < 0)
      .reduce((s, t) => s + t.points, 0);
    expect(r3.points_restored).toBe(3);
    expect(restored).toBe(27 + 3 + 3);
    expect(reversed).toBe(
      r1.points_reversed + r2.points_reversed + r3.points_reversed,
    );
    expect(reversed).toBeLessThanOrEqual(earned);

    // The original order: partially returned (the exhaust remains), no receivable
    const original = await testDb.sales_orders.findUniqueOrThrow({
      where: { id: sale.id },
    });
    expect([original.return_status, Number(original.returned_amount)]).toEqual([
      'partial',
      872_973 + 87_298 + 87_297,
    ]);
    expect(
      await testDb.customer_receivables.count({
        where: { sales_order_id: sale.id },
      }),
    ).toBe(0);
  });
});
