import { PrismaService } from '../../src/prisma/prisma.service';
import { ReportScope } from '../../src/reports/report-scope';
import { SalesReportsService } from '../../src/reports/sales-reports.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import {
  EXPECTED_MARCH,
  MARCH,
  ReportFixtures,
  seedReportFixtures,
} from './report-fixtures';

describe('SalesReportsService', () => {
  let service: SalesReportsService;
  let fx: ReportFixtures;

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedReportFixtures();
    service = new SalesReportsService(testDb as unknown as PrismaService);
  });
  afterAll(closeTestDb);

  describe('summary', () => {
    it('excludes cancelled, draft and pending orders', async () => {
      // 10-12 March holds only the cancelled (500,000) and draft (300,000) orders
      const r = await service.summary(
        new ReportScope({ from: '2026-03-10', to: '2026-03-12' }),
      );
      expect(r.meta?.summary).toMatchObject({ orders: 0, netSales: 0 });

      // Whole month: only the five revenue-bearing orders
      const month = await service.summary(new ReportScope(MARCH));
      expect(month.meta?.summary).toMatchObject({
        orders: EXPECTED_MARCH.revenueOrderNumbers.length,
      });
    });

    it('counts each discount once and keeps gross, discounts, net and tax consistent', async () => {
      const r = await service.summary(
        new ReportScope({
          from: '2026-03-05',
          to: '2026-03-05',
          storeId: fx.stores.hcmc,
        }),
      );
      // SO-T-0001: lines 5,000,000; line discount 100,000; order discount 100,000; loyalty 50,000; tax 300,000
      expect(r.meta?.summary).toMatchObject({
        orders: 1,
        grossSales: 5_000_000,
        discounts: 250_000,
        netSales: 4_750_000,
        tax: 300_000,
        total: 5_050_000,
        itemsSold: 3,
        averageOrderValue: 4_750_000,
      });
    });

    it('matches the fixture totals for March and equals total - tax - shipping', async () => {
      const r = await service.summary(new ReportScope(MARCH));
      const s = r.meta?.summary as Record<string, number>;
      expect(s.grossSales).toBe(EXPECTED_MARCH.grossSales);
      expect(s.discounts).toBe(EXPECTED_MARCH.discounts);
      expect(s.netSales).toBe(EXPECTED_MARCH.netSales);
      expect(s.tax).toBe(EXPECTED_MARCH.tax);
      expect(s.itemsSold).toBe(EXPECTED_MARCH.itemsSold);
      expect(s.netSales).toBe(s.total - s.tax - s.shipping);
    });

    it('filters by branch', async () => {
      const hanoi = await service.summary(
        new ReportScope({ ...MARCH, storeId: fx.stores.hanoi }),
      );
      // SO-T-0002 (3,000,000) + SO-T-0005 (200,000) + SO-T-0008 (900,000)
      expect(hanoi.meta?.summary).toMatchObject({
        orders: 3,
        netSales: 4_100_000,
      });
    });
  });

  it('groups sales by product category with Uncategorized', async () => {
    const r = await service.byCategory(new ReportScope(MARCH));
    const byName = Object.fromEntries(
      r.rows.map((row) => [row.category as string, row]),
    ) as Record<string, Record<string, unknown>>;
    expect(Object.keys(byName).sort()).toEqual([
      'Denim',
      'Exhaust',
      'Uncategorized',
    ]);
    // Denim: Jeans A 2x950,000 + Jeans B/32 3,000,000 + Jeans A 1,000,000 + Jeans A 900,000
    expect(byName.Denim).toMatchObject({ quantity: 5, netSales: 6_800_000 });
    expect(byName.Exhaust).toMatchObject({ quantity: 1, netSales: 3_000_000 });
    expect(byName.Uncategorized).toMatchObject({
      quantity: 4,
      netSales: 200_000,
    });
  });

  it('reports retail payments per normalised method, completed only', async () => {
    const r = await service.byPaymentMethod(new ReportScope(MARCH));
    const byMethod = Object.fromEntries(
      r.rows.map((row) => [row.method as string, row.amount as number]),
    ) as Record<string, number>;
    expect(byMethod).toEqual(EXPECTED_MARCH.retailReceived);

    const day = await service.byPaymentMethod(
      new ReportScope({
        from: '2026-03-05',
        to: '2026-03-05',
        storeId: fx.stores.hcmc,
      }),
    );
    expect(
      Object.fromEntries(day.rows.map((row) => [row.method, row.amount])),
    ).toEqual({ cash: 2_000_000, card: 3_050_000 });

    // The refunded payment of the cancelled order is not counted
    const cancelledDay = await service.byPaymentMethod(
      new ReportScope({ from: '2026-03-10', to: '2026-03-10' }),
    );
    expect(cancelledDay.rows).toHaveLength(0);
  });

  it('ranks top products by quantity or net sales with a limit', async () => {
    const byQty = await service.topProducts(
      new ReportScope(MARCH),
      10,
      'quantity',
    );
    // Jeans A and Sticker both sold 4 units; the tie is broken by net sales
    expect(byQty.rows.slice(0, 2).map((r) => [r.sku, r.quantity])).toEqual([
      ['JEANS-A', 4],
      ['STICKER', 4],
    ]);
    expect(
      byQty.rows
        .slice(2)
        .map((r) => r.sku)
        .sort(),
    ).toEqual(['EXH-X', 'JEANS-B-32']);

    const byNet = await service.topProducts(
      new ReportScope(MARCH),
      2,
      'netSales',
    );
    expect(byNet.rows).toHaveLength(2);
    // Jeans A: 1,900,000 + 1,000,000 + 900,000 = 3,800,000; Jeans B/32 and Exhaust X: 3,000,000 each
    expect(byNet.rows[0]).toMatchObject({
      sku: 'JEANS-A',
      netSales: 3_800_000,
    });
    expect(
      byNet.rows.every((r, i, a) => i === 0 || a[i - 1].netSales >= r.netSales),
    ).toBe(true);
  });

  it('returns daily trends including days with no sales', async () => {
    const r = await service.trends(
      new ReportScope({ from: '2026-03-04', to: '2026-03-06' }),
    );
    expect(r.rows).toEqual([
      { period: '2026-03-04', orders: 0, netSales: 0, averageOrderValue: 0 },
      {
        period: '2026-03-05',
        orders: 2,
        netSales: 7_750_000,
        averageOrderValue: 3_875_000,
      },
      { period: '2026-03-06', orders: 0, netSales: 0, averageOrderValue: 0 },
    ]);
  });

  it('returns monthly trends across the year boundary', async () => {
    const r = await service.trends(
      new ReportScope({
        from: '2026-02-01',
        to: '2026-03-31',
        interval: 'monthly',
      }),
    );
    expect(r.rows.map((x) => [x.period, x.orders])).toEqual([
      ['2026-02', 1],
      ['2026-03', 5],
    ]);
  });
});
