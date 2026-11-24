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
import { EodReportsService } from '../../src/reports/eod-reports.service';
import { LedgerReportsService } from '../../src/reports/ledger-reports.service';
import { ReportScope, toReportDate } from '../../src/reports/report-scope';
import { ReportResult } from '../../src/reports/report-types';
import { RetailReportsService } from '../../src/reports/retail-reports.service';
import { StockReportsService } from '../../src/reports/stock-reports.service';
import { ReturnRequestDto } from '../../src/sales-returns/dto/sales-returns.dto';
import { SalesReturnsService } from '../../src/sales-returns/sales-returns.service';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

/**
 * reports-retail-suite: one day at the HCMC branch, figures by hand.
 *
 * A  jeans 1,000,000 + exhaust 2,500,000 + 4 stickers 200,000 = 3,700,000 gross,
 *    manual order discount 370,000, loyalty 100,000 → net 3,230,000 cash.
 * r1 jeans back for cash 872,973.
 * r2 2 stickers (87,298) exchanged for jeans → B gross/net 1,000,000, paid exchange 87,298 + cash 912,702.
 * r3 2 stickers as store credit 87,297.
 * C  1 sticker 50,000 paid with store credit.
 * Rent 500,000 paid from the drawer during the shift.
 *
 * Day: 3 orders, gross 4,750,000, manual 370,000, loyalty 100,000, net 4,280,000,
 *   returns 1,047,568 → net after returns 3,232,432.
 * Cash received 3,230,000 + 912,702 = 4,142,702; exchange 87,298; credit 50,000.
 * Drawer account: in 4,142,702, out 872,973 + 500,000 → closing 2,769,729.
 * Shift expected 1,000,000 + 4,142,702 − 872,973 − 500,000 = 3,769,729.
 * COGS: sold jeans 2×500,000 + exhaust 2,000,000 + stickers 5×10,000 = 3,050,000,
 *   restocked jeans 500,000 + stickers 4×10,000 = 540,000 → 2,510,000.
 * P&L: revenue 3,232,432 − COGS 2,510,000 = gross profit 722,432 − rent 500,000 = 222,432.
 */
describe('retail suite reports', () => {
  let fx: SalesFixtures;
  let eod: EodReportsService;
  let retail: RetailReportsService;
  let stock: StockReportsService;
  let ledger: LedgerReportsService;
  let scope: ReportScope;
  const today = toReportDate(new Date());
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const row = (r: ReportResult, key: string, value: unknown) =>
    r.rows.find((x) => x[key] === value);

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
    const shifts = new PosService(prisma, casl, activity, cashBook);
    const checkout = new PosCheckoutService(prisma, posting, casl, activity, {
      get: () => 'secret',
    } as unknown as ConfigService);
    const returns = new SalesReturnsService(
      prisma,
      posting,
      cashBook,
      loyalty,
      casl,
      activity,
    );
    eod = new EodReportsService(prisma);
    retail = new RetailReportsService(prisma);
    stock = new StockReportsService(prisma);
    ledger = new LedgerReportsService(prisma);
    scope = new ReportScope({ from: today, to: today, storeId: fx.store.id });

    await testDb.inventory.updateMany({
      where: { location_id: fx.store.locationId },
      data: { quantity_on_hand: 500 },
    });
    const cashier = { id: fx.users.store_manager };
    await shifts.openShift(cashier, {
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
    const line = (productId: string) =>
      sale.sales_order_items.find((i) => i.product_id === productId).id;
    await returns.create(cashier, {
      sales_order_id: sale.id,
      items: [
        {
          sales_order_item_id: line(fx.products.jeans),
          quantity: 1,
          reason_code: 'wrong_size',
        },
      ],
      refunds: [{ method: 'cash', amount: 872_973 }],
    } as ReturnRequestDto);
    await returns.create(cashier, {
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
    await returns.create(cashier, {
      sales_order_id: sale.id,
      items: [
        {
          sales_order_item_id: line(fx.products.sticker),
          quantity: 2,
          reason_code: 'defective',
        },
      ],
      refunds: [{ method: 'store_credit', amount: 87_297 }],
    } as ReturnRequestDto);
    await checkout.checkout(cashier, {
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
    await testDb.$transaction((tx) =>
      cashBook.post(tx as never, {
        accountId: fx.accounts.hcmDrawer,
        direction: 'out',
        amount: 500_000,
        categoryCode: 'rent',
        linkOpenShiftOf: cashier.id,
        isAutomatic: false,
      }),
    );

    // An old credit sale (45 days) and an old supplier order (100 days) for aging
    const old = await testDb.sales_orders.create({
      data: {
        order_number: 'SO-OLD-1',
        customer_name: 'Khách nợ',
        channel: 'pos',
        store_id: fx.store.id,
        location_id: fx.store.locationId,
        customer_id: fx.customers.plain,
        status: 'completed',
        order_date: daysAgo(45),
        subtotal: 300_000,
        total_amount: 300_000,
      },
    });
    await testDb.customer_receivables.create({
      data: {
        customer_id: fx.customers.plain,
        sales_order_id: old.id,
        original_amount: 300_000,
        paid_amount: 100_000,
        balance: 200_000,
        status: 'partial',
      },
    });
    const supplier = await testDb.suppliers.create({
      data: { name: 'NCC Một' },
    });
    await testDb.purchase_orders.create({
      data: {
        order_number: 'PO-OLD-1',
        supplier_id: supplier.id,
        status: 'approved',
        subtotal: 1_000_000,
        total_amount: 1_000_000,
        paid_amount: 400_000,
        order_date: daysAgo(100),
      },
    });
  });
  afterAll(closeTestDb);

  it('end of day per branch', async () => {
    const r = await eod.daily(scope);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      orders: 3,
      gross: 4_750_000,
      manualDiscounts: 370_000,
      promotionDiscounts: 0,
      voucherDiscounts: 0,
      loyaltyDiscounts: 100_000,
      netSales: 4_280_000,
      returns: 1_047_568,
      netAfterReturns: 3_232_432,
      receivedCash: 4_142_702,
      receivedExchange: 87_298,
      receivedCredit: 50_000,
      drawerOut: 500_000,
      newReceivables: 0,
    });
    expect(r.meta?.staff).toEqual([
      { name: 'User store_manager', orders: 3, net: 4_280_000 },
    ]);
  });

  it('shift close', async () => {
    const r = await eod.shifts(scope);
    expect(r.rows[0]).toMatchObject({
      openingCash: 1_000_000,
      cashSales: 4_142_702,
      cashRefunds: 872_973,
      cashOut: 500_000,
      expected: 3_769_729,
      counted: null,
      difference: null,
    });
  });

  it('sales by staff, hour, branch, brand and discounts', async () => {
    const staff = await retail.byStaff(scope);
    expect(staff.rows[0]).toMatchObject({
      orders: 3,
      gross: 4_750_000,
      netSales: 4_280_000,
      returns: 1_047_568,
      netAfterReturns: 3_232_432,
    });
    expect((await retail.byHour(scope)).totals).toEqual({
      orders: 3,
      netSales: 4_280_000,
    });
    const branch = await retail.byBranch(scope);
    expect(branch.totals).toEqual({
      orders: 3,
      gross: 4_750_000,
      netSales: 4_280_000,
    });
    expect((await retail.byBrand(scope)).totals?.netSales).toBe(4_280_000);
    const disc = await retail.discounts(scope);
    expect(disc.totals).toMatchObject({
      gross: 4_750_000,
      manual: 370_000,
      loyalty: 100_000,
      totalDiscounts: 470_000,
      netSales: 4_280_000,
      discountedOrders: 1,
    });
  });

  it('returns by product and by reason', async () => {
    const r = await retail.returnsByProduct(scope);
    expect(row(r, 'sku', 'JEANS-A')).toMatchObject({
      quantity: 1,
      value: 872_973,
      sold: 2,
      returnRate: 50,
    });
    expect(row(r, 'sku', 'STICKER')).toMatchObject({
      returns: 2,
      quantity: 4,
      value: 174_595,
      sold: 5,
      returnRate: 80,
    });
    const reasons = await retail.returnsReasons(scope);
    expect(row(reasons, 'label', 'Sai size')).toMatchObject({
      returns: 1,
      value: 872_973,
    });
    expect(row(reasons, 'label', 'Lỗi sản phẩm')).toMatchObject({
      value: 87_297,
    });
    expect(row(reasons, 'label', 'Khác')).toMatchObject({ value: 87_298 });
    const staff = await retail.returnsReasons(scope, 'staff');
    expect(staff.rows[0]).toMatchObject({
      returns: 3,
      exchanges: 1,
      value: 1_047_568,
    });
  });

  it('stock card, days of stock', async () => {
    const card = await stock.stockCard(scope, fx.products.sticker);
    // out 4 (A) + 1 (C), in 2 + 2 returned
    expect(card.totals).toMatchObject({ quantityIn: 4, quantityOut: 5 });
    expect(card.meta?.closing).toBe((card.meta?.opening as number) - 1);
    const days = await stock.daysOfStock(scope);
    expect(row(days, 'sku', 'STICKER')).toMatchObject({
      onHand: 499,
      sold: 5,
      perDay: 5,
      daysOfStock: 100,
    });
    const dead = await stock.daysOfStock(scope, 'dead');
    expect(dead.rows.find((x) => x.sku === 'STICKER')).toBeUndefined();
  });

  it('top customers', async () => {
    const r = await retail.topCustomers(scope);
    expect(r.rows[0]).toMatchObject({
      orders: 3,
      netSales: 4_280_000,
      returns: 1_047_568,
      netAfterReturns: 3_232_432,
    });
  });

  it('receivables and payables aging', async () => {
    const recv = await ledger.receivablesAging(scope);
    expect(recv.totals).toEqual({
      b0: 0,
      b31: 200_000,
      b61: 0,
      b90: 0,
      total: 200_000,
    });
    const pay = await ledger.payablesAging(scope);
    expect(pay.totals).toEqual({
      b0: 0,
      b31: 0,
      b61: 0,
      b90: 600_000,
      total: 600_000,
    });
    expect(pay.rows[0]).toMatchObject({ supplier: 'NCC Một', oldest: 100 });
  });

  it('cash balances and profit and loss', async () => {
    const cash = await ledger.cashBalances(scope);
    expect(
      row(
        cash,
        'code',
        (
          await testDb.cash_book_accounts.findUniqueOrThrow({
            where: { id: fx.accounts.hcmDrawer },
          })
        ).code,
      ),
    ).toMatchObject({
      moneyIn: 4_142_702,
      moneyOut: 1_372_973,
      closing: 2_769_729,
    });
    const pnl = await ledger.pnl(scope);
    const line = (key: string) => pnl.rows.find((x) => x.key === key);
    expect(line('revenue')).toMatchObject({ retail: 3_232_432, workshop: 0 });
    expect(line('cogs')).toMatchObject({ retail: -2_510_000 });
    expect(line('grossProfit')).toMatchObject({ combined: 722_432 });
    expect(line('expense:rent')).toMatchObject({ combined: -500_000 });
    expect(line('netProfit')).toMatchObject({ combined: 222_432 });
  });

  it('every new report keeps its column contract', async () => {
    const all = [
      await eod.daily(scope),
      await eod.shifts(scope),
      await retail.byHour(scope),
      await retail.byStaff(scope),
      await retail.byBranch(scope),
      await retail.byBrand(scope),
      await retail.slowMovers(scope),
      await retail.discounts(scope),
      await retail.returnsByProduct(scope),
      await retail.returnsReasons(scope),
      await retail.returnsReasons(scope, 'staff'),
      await retail.topCustomers(scope),
      await retail.loyalty(scope),
      await retail.promotionPerformance(scope),
      await stock.stockCard(scope, fx.products.sticker),
      await stock.inTransit(scope),
      await stock.countVariances(scope),
      await stock.daysOfStock(scope),
      await stock.daysOfStock(scope, 'dead'),
      await ledger.receivablesAging(scope),
      await ledger.payablesAging(scope),
      await ledger.supplierPurchases(scope),
      await ledger.cashBalances(scope),
      await ledger.pnl(scope),
    ];
    for (const r of all) {
      for (const row of r.rows) {
        for (const c of r.columns)
          expect({ report: r.report, key: c.key, ok: c.key in row }).toEqual({
            report: r.report,
            key: c.key,
            ok: true,
          });
      }
    }
  });
});
