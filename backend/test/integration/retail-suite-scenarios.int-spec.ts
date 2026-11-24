import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EodReportsService } from '../../src/reports/eod-reports.service';
import { LedgerReportsService } from '../../src/reports/ledger-reports.service';
import { ReportScope } from '../../src/reports/report-scope';
import { ReportResult } from '../../src/reports/report-types';
import { RetailReportsService } from '../../src/reports/retail-reports.service';
import { StockReportsService } from '../../src/reports/stock-reports.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { vn } from './report-fixtures';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

const D = (n: number) => new Prisma.Decimal(n);

/**
 * One test per numbered scenario in the reports-retail-suite specs, on rows
 * written directly so each figure is exactly the scenario's.
 *   July: P&L. September: discount sources. October: everything else
 *   (plus one August order for the 75-day receivable).
 */
describe('retail suite spec scenarios', () => {
  let fx: SalesFixtures;
  let eod: EodReportsService;
  let retail: RetailReportsService;
  let stock: StockReportsService;
  let ledger: LedgerReportsService;
  const OCT = new ReportScope({ from: '2026-10-01', to: '2026-10-31' });
  const row = (r: ReportResult, key: string, value: unknown) =>
    r.rows.find((x) => x[key] === value);
  let n = 0;

  async function order(input: {
    at: string;
    lines: {
      product_id: string;
      quantity: number;
      unit_price: number;
      discount?: number;
      promo?: number;
    }[];
    order_discount?: number;
    promo?: number;
    voucher?: number;
    loyalty?: number;
  }) {
    n += 1;
    const at = vn(input.at);
    const subtotal = input.lines.reduce(
      (t, l) => t + l.unit_price * l.quantity,
      0,
    );
    const o = await testDb.sales_orders.create({
      data: {
        order_number: `SO-SC-${n}`,
        customer_name: 'Khách',
        channel: 'pos',
        status: 'completed',
        store_id: fx.store.id,
        location_id: fx.store.locationId,
        customer_id: fx.customers.member,
        created_by: fx.users.store_manager,
        order_date: at,
        created_at: at,
        discount_amount: D(input.order_discount ?? 0),
        promotion_discount_amount: D(input.promo ?? 0),
        voucher_discount_amount: D(input.voucher ?? 0),
        loyalty_discount_amount: D(input.loyalty ?? 0),
        subtotal: D(subtotal),
        total_amount: D(subtotal),
      },
    });
    const items: Awaited<ReturnType<typeof testDb.sales_order_items.create>>[] =
      [];
    for (const l of input.lines) {
      items.push(
        await testDb.sales_order_items.create({
          data: {
            sales_order_id: o.id,
            product_id: l.product_id,
            product_name: 'x',
            quantity: l.quantity,
            unit_price: D(l.unit_price),
            discount_amount: D(l.discount ?? 0),
            promotion_discount: D(l.promo ?? 0),
            total_amount: D(l.unit_price * l.quantity),
          },
        }),
      );
    }
    return { order: o, items };
  }

  async function product(sku: string, cost: number, onHand: number) {
    const p = await testDb.products.create({
      data: {
        sku,
        name: sku,
        cost_price: D(cost),
        retail_price: D(cost * 2),
        product_type: 'physical',
        is_active: true,
      },
    });
    await testDb.inventory.create({
      data: {
        location_id: fx.store.locationId,
        product_id: p.id,
        quantity_on_hand: onHand,
      },
    });
    return p.id;
  }

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    eod = new EodReportsService(prisma);
    retail = new RetailReportsService(prisma);
    stock = new StockReportsService(prisma);
    ledger = new LedgerReportsService(prisma);
    await testDb.inventory.updateMany({ data: { quantity_on_hand: 0 } });
  });
  afterAll(closeTestDb);

  it('returns: 20 jeans sold, 2 returned → 10%; 5 of 8 returns "wrong size" listed first', async () => {
    const sale = await order({
      at: '2026-10-05 10:00',
      lines: [
        { product_id: fx.products.jeans, quantity: 20, unit_price: 1_000_000 },
        { product_id: fx.products.sticker, quantity: 8, unit_price: 50_000 },
      ],
    });
    const [jeansLine, stickerLine] = sale.items;
    const reasons = [
      ...Array<string>(5).fill('wrong_size'),
      ...Array<string>(3).fill('changed_mind'),
    ];
    for (const [i, reason] of reasons.entries()) {
      const line = i === 0 ? jeansLine : stickerLine;
      const qty = i === 0 ? 2 : 1;
      const value = Number(line.unit_price) * qty;
      const r = await testDb.sales_returns.create({
        data: {
          return_number: `TH-SC-${i}`,
          sales_order_id: sale.order.id,
          store_id: fx.store.id,
          kind: 'return',
          goods_amount: D(value),
          refund_amount: D(value),
          created_by: fx.users.store_manager,
          created_at: vn('2026-10-06 10:00'),
        },
      });
      await testDb.sales_return_items.create({
        data: {
          sales_return_id: r.id,
          sales_order_item_id: line.id,
          product_id: line.product_id,
          product_name: line.product_name,
          product_sku: i === 0 ? 'JEANS-A' : 'STICKER',
          quantity: qty,
          unit_refund: line.unit_price,
          line_refund: D(value),
          restock: true,
          location_id: fx.store.locationId,
          reason_code: reason,
        },
      });
    }
    const byProduct = await retail.returnsByProduct(OCT);
    expect(row(byProduct, 'sku', 'JEANS-A')).toMatchObject({
      quantity: 2,
      sold: 20,
      returnRate: 10,
    });
    const byReason = await retail.returnsReasons(OCT);
    expect(byReason.rows[0]).toMatchObject({ label: 'Sai size', returns: 5 });
    expect(byReason.totals).toMatchObject({ returns: 8 });
  });

  it('shift short by 50,000', async () => {
    await testDb.pos_sessions.create({
      data: {
        session_number: 'CA-SC-1',
        location_id: fx.store.locationId,
        store_id: fx.store.id,
        user_id: fx.users.store_manager,
        status: 'closed',
        opening_cash: D(500_000),
        expected_cash: D(2_150_000),
        closing_cash: D(2_100_000),
        cash_difference: D(-50_000),
        opened_at: vn('2026-10-07 08:00'),
        closed_at: vn('2026-10-07 22:00'),
      },
    });
    const r = await eod.shifts(OCT);
    expect(row(r, 'session', 'CA-SC-1')).toMatchObject({
      expected: 2_150_000,
      counted: 2_100_000,
      difference: -50_000,
    });
  });

  it('receivable from 75 days ago in 61–90; supplier order 40 days ago with 4,000,000 paid shows 6,000,000 in 31–60', async () => {
    const { order: o } = await order({
      at: '2026-08-17 10:00', // 75 days before 31 October
      lines: [
        { product_id: fx.products.sticker, quantity: 30, unit_price: 50_000 },
      ],
    });
    await testDb.customer_receivables.create({
      data: {
        customer_id: fx.customers.plain,
        sales_order_id: o.id,
        original_amount: D(1_500_000),
        balance: D(1_500_000),
        status: 'open',
      },
    });
    const recv = await ledger.receivablesAging(OCT);
    expect(recv.rows).toEqual([
      expect.objectContaining({ b61: 1_500_000, total: 1_500_000, oldest: 75 }),
    ]);

    const supplier = await testDb.suppliers.create({
      data: { name: 'Shoei VN' },
    });
    await testDb.purchase_orders.create({
      data: {
        order_number: 'PO-SC-1',
        supplier_id: supplier.id,
        status: 'approved',
        total_amount: D(10_000_000),
        paid_amount: D(4_000_000),
        order_date: vn('2026-09-21 10:00'), // 40 days before 31 October
      },
    });
    const pay = await ledger.payablesAging(OCT);
    expect(row(pay, 'supplier', 'Shoei VN')).toMatchObject({
      b0: 0,
      b31: 6_000_000,
      total: 6_000_000,
    });
  });

  it('Momotaro: 20,000,000 + 5,000,000 approved and 1,000,000 returned', async () => {
    const momotaro = await testDb.suppliers.create({
      data: { name: 'Momotaro' },
    });
    const po1 = await testDb.purchase_orders.create({
      data: {
        order_number: 'PO-SC-2',
        supplier_id: momotaro.id,
        status: 'approved',
        total_amount: D(20_000_000),
        order_date: vn('2026-10-03 09:00'),
      },
    });
    await testDb.purchase_orders.create({
      data: {
        order_number: 'PO-SC-3',
        supplier_id: momotaro.id,
        status: 'approved',
        total_amount: D(5_000_000),
        order_date: vn('2026-10-10 09:00'),
      },
    });
    await testDb.purchase_orders.create({
      data: {
        order_number: 'PO-SC-4',
        supplier_id: momotaro.id,
        status: 'draft',
        total_amount: D(9_000_000),
        order_date: vn('2026-10-11 09:00'),
      },
    });
    await testDb.supplier_returns.create({
      data: {
        return_number: 'TNCC-SC-1',
        supplier_id: momotaro.id,
        purchase_order_id: po1.id,
        total_return_amount: D(1_000_000),
        return_date: vn('2026-10-15 09:00'),
        status: 'completed',
      },
    });
    const r = await ledger.supplierPurchases(OCT);
    expect(row(r, 'supplier', 'Momotaro')).toMatchObject({
      orders: 2,
      purchased: 25_000_000,
      returns: 1_000_000,
      netPurchases: 24_000_000,
    });
  });

  it('loyalty: 12,000 points worth 1,000 each → 12,000,000 outstanding', async () => {
    expect(fx.loyalty.redemptionRate).toBe(1000);
    await testDb.customer_loyalty.deleteMany({});
    await testDb.customer_loyalty.createMany({
      data: [
        { customer_id: fx.customers.member, points_balance: 9_000 },
        { customer_id: fx.customers.plain, points_balance: 3_000 },
      ],
    });
    const r = await retail.loyalty(OCT);
    expect(r.totals).toMatchObject({
      balance: 12_000,
      balanceValue: 12_000_000,
    });
  });

  it('10 exhausts shipped HCMC → Hanoi, 8 received: 2 in transit', async () => {
    const t = await testDb.transfer_orders.create({
      data: {
        transfer_number: 'CK-SC-1',
        from_location_id: fx.store.locationId,
        to_location_id: fx.store2.locationId,
        status: 'partially_received',
        shipped_date: vn('2026-10-20 09:00'),
      },
    });
    await testDb.transfer_order_items.create({
      data: {
        transfer_order_id: t.id,
        product_id: fx.products.exhaust,
        quantity_requested: 10,
        quantity_shipped: 10,
        quantity_received: 8,
        unit_cost: D(2_000_000),
      },
    });
    const r = await stock.inTransit(OCT);
    expect(row(r, 'transfer', 'CK-SC-1')).toMatchObject({
      quantity: 2,
      value: 4_000_000,
    });
  });

  it('gloves: 30 on hand, 60 sold in 30 days → 15 days; an unsold helmet tops slow movers', async () => {
    const gloves = await product('GLOVES', 100_000, 30);
    await product('HELMET', 1_500_000, 8);
    await order({
      at: '2026-10-12 15:00',
      lines: [{ product_id: gloves, quantity: 60, unit_price: 200_000 }],
    });
    const thirtyDays = new ReportScope({
      from: '2026-10-02',
      to: '2026-10-31',
    });
    const days = await stock.daysOfStock(thirtyDays);
    expect(row(days, 'sku', 'GLOVES')).toMatchObject({
      onHand: 30,
      sold: 60,
      perDay: 2,
      daysOfStock: 15,
    });
    const slow = await retail.slowMovers(thirtyDays);
    expect(slow.rows[0]).toMatchObject({ sku: 'HELMET', sold: 0, onHand: 8 });
    const dead = await stock.daysOfStock(thirtyDays, 'dead');
    expect(dead.rows.map((x) => x.sku)).toContain('HELMET');
  });

  it('"Mua 2 tặng 1" in 12 orders: 600,000 off on 4,200,000 of sales', async () => {
    const promo = await testDb.promotions.create({
      data: {
        code: 'B2G1-SC',
        name: 'Mua 2 tặng 1',
        type: 'buy_x_get_y',
        buy_quantity: 2,
        get_quantity: 1,
        get_discount_percent: D(100),
      },
    });
    for (let i = 0; i < 12; i++) {
      const { order: o, items } = await order({
        at: '2026-10-25 11:00',
        lines: [
          {
            product_id: fx.products.sticker,
            quantity: 8,
            unit_price: 50_000,
            promo: 50_000,
          },
        ],
      });
      await testDb.sales_order_discounts.create({
        data: {
          sales_order_id: o.id,
          sales_order_item_id: items[0].id,
          source_type: 'promotion',
          promotion_id: promo.id,
          amount: D(50_000),
        },
      });
    }
    const r = await retail.promotionPerformance(
      new ReportScope({ from: '2026-10-25', to: '2026-10-25' }),
    );
    expect(row(r, 'name', 'Mua 2 tặng 1')).toMatchObject({
      orders: 12,
      discount: 600_000,
      netSales: 4_200_000,
    });
  });

  it('drawer: 2,000,000 at the start of the day, 1,650,000 in, 2,350,000 out → 1,300,000', async () => {
    const cat = async (code: string) =>
      (await testDb.cash_book_categories.findFirstOrThrow({ where: { code } }))
        .id;
    const entry = async (
      dir: 'in' | 'out',
      amount: number,
      at: string,
      code: string,
    ) =>
      testDb.cash_book_entries.create({
        data: {
          entry_number: `SC-${(n += 1)}`,
          account_id: fx.accounts.hcmDrawer,
          store_id: fx.store.id,
          direction: dir,
          amount: D(amount),
          entry_date: vn(at),
          category_id: await cat(code),
          status: 'posted',
          is_automatic: false,
        },
      });
    await entry('in', 2_000_000, '2026-10-29 18:00', 'other_income');
    await entry('in', 1_650_000, '2026-10-30 10:00', 'sale');
    await entry('out', 2_350_000, '2026-10-30 16:00', 'supplier_payment');
    const r = await ledger.cashBalances(
      new ReportScope({
        from: '2026-10-30',
        to: '2026-10-30',
        storeId: fx.store.id,
      }),
    );
    const code = (
      await testDb.cash_book_accounts.findUniqueOrThrow({
        where: { id: fx.accounts.hcmDrawer },
      })
    ).code;
    expect(row(r, 'code', code)).toMatchObject({
      opening: 2_000_000,
      moneyIn: 1_650_000,
      moneyOut: 2_350_000,
      closing: 1_300_000,
    });
  });

  it('discount sources: 200,000 line, 300,000 order, 500,000 promotion, 100,000 voucher, 50,000 loyalty = 1,150,000', async () => {
    await order({
      at: '2026-09-15 10:00',
      lines: [
        {
          product_id: fx.products.jeans,
          quantity: 4,
          unit_price: 1_000_000,
          discount: 50_000,
        },
      ],
      order_discount: 300_000,
      promo: 500_000,
      voucher: 100_000,
      loyalty: 50_000,
    });
    const r = await retail.discounts(
      new ReportScope({
        from: '2026-09-01',
        to: '2026-09-30',
        interval: 'monthly',
      }),
    );
    expect(r.totals).toMatchObject({
      manual: 500_000,
      promotions: 500_000,
      vouchers: 100_000,
      loyalty: 50_000,
      totalDiscounts: 1_150_000,
    });
  });

  it('P&L: retail 100,000,000 − COGS 60,000,000 + workshop 30,000,000 − parts 10,000,000 − expenses 25,000,000 = 35,000,000', async () => {
    await testDb.inventory.updateMany({
      where: {
        location_id: fx.store.locationId,
        product_id: fx.products.jeans,
        product_variant_id: null,
      },
      data: { quantity_on_hand: 100 },
    });
    // two orders of 50,000,000 (order amounts are numeric(10,2))
    for (const day of ['2026-07-10 10:00', '2026-07-20 10:00']) {
      const { order: o } = await order({
        at: day,
        lines: [
          {
            product_id: fx.products.jeans,
            quantity: 50,
            unit_price: 1_000_000,
          },
        ],
      });
      await testDb.inventory_transactions.create({
        data: {
          location_id: fx.store.locationId,
          product_id: fx.products.jeans,
          transaction_type: 'SALE',
          quantity: -50,
          unit_cost: D(600_000),
          reference_type: 'sales_order',
          reference_id: o.id,
          created_at: vn(day),
        },
      });
    }
    const bike = await testDb.bikes.create({
      data: {
        brand: 'Honda',
        model: 'CB350',
        license_plate: '59-SC 000.01',
        owner_id: fx.customers.member,
      },
    });
    const svc = await testDb.service_orders.create({
      data: {
        order_number: 'SV-SC-1',
        motorcycle_id: bike.id,
        customer_id: fx.customers.member,
        status: 'delivered',
        store_id: fx.store.id,
        drop_off_date: vn('2026-07-05 09:00'),
        pickup_date: vn('2026-07-12 17:00'),
        final_cost: D(30_000_000),
      },
    });
    const part = await testDb.parts.create({
      data: { name: 'Bộ côn', part_number: 'CL-SC', unit_cost: D(5_000_000) },
    });
    await testDb.service_parts.create({
      data: {
        service_order_id: svc.id,
        part_id: part.id,
        quantity_used: 2,
        unit_cost: D(5_000_000),
        total_cost: D(10_000_000),
        created_at: vn('2026-07-08 10:00'),
      },
    });
    const rent = (
      await testDb.cash_book_categories.findFirstOrThrow({
        where: { code: 'rent' },
      })
    ).id;
    const transfer = (
      await testDb.cash_book_categories.findFirstOrThrow({
        where: { code: 'supplier_payment' },
      })
    ).id;
    for (const [amount, category] of [
      [25_000_000, rent],
      [7_000_000, transfer],
    ] as const) {
      await testDb.cash_book_entries.create({
        data: {
          entry_number: `SC-${(n += 1)}`,
          account_id: fx.accounts.hcmBank,
          store_id: fx.store.id,
          direction: 'out',
          amount: D(amount),
          entry_date: vn('2026-07-31 10:00'),
          category_id: category,
          status: 'posted',
          is_automatic: false,
        },
      });
    }
    const pnl = await ledger.pnl(
      new ReportScope({ from: '2026-07-01', to: '2026-07-31' }),
    );
    const line = (key: string) => pnl.rows.find((x) => x.key === key);
    expect(line('revenue')).toMatchObject({
      retail: 100_000_000,
      workshop: 30_000_000,
      combined: 130_000_000,
    });
    expect(line('cogs')).toMatchObject({
      retail: -60_000_000,
      workshop: -10_000_000,
    });
    expect(line('opex')).toMatchObject({ combined: -25_000_000 });
    expect(line('netProfit')).toMatchObject({ combined: 35_000_000 });
  });
});
