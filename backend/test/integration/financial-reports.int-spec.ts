import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { FinancialReportsService } from '../../src/reports/financial-reports.service';
import { InventoryReportsService } from '../../src/reports/inventory-reports.service';
import { ReportScope } from '../../src/reports/report-scope';
import { SalesReportsService } from '../../src/reports/sales-reports.service';
import { WorkshopReportsService } from '../../src/reports/workshop-reports.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import {
  EXPECTED_MARCH,
  MARCH,
  ReportFixtures,
  seedReportFixtures,
} from './report-fixtures';

describe('FinancialReportsService', () => {
  let service: FinancialReportsService;
  let sales: SalesReportsService;
  let fx: ReportFixtures;

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedReportFixtures();
    const prisma = testDb as unknown as PrismaService;
    sales = new SalesReportsService(prisma);
    const workshop = new WorkshopReportsService(prisma);
    const inventory = new InventoryReportsService(prisma);
    service = new FinancialReportsService(prisma, sales, workshop, inventory);
  });
  afterAll(closeTestDb);

  it('shows retail, workshop and combined revenue', async () => {
    const r = await service.revenue(new ReportScope(MARCH));
    const byLine = Object.fromEntries(
      r.rows.map((row) => [row.line as string, row]),
    ) as Record<string, Record<string, unknown>>;
    expect(byLine.retail).toMatchObject({
      revenue: EXPECTED_MARCH.netSales,
      orders: 5,
    });
    expect(byLine.workshop).toMatchObject({
      revenue: EXPECTED_MARCH.workshopRevenue,
      orders: 3,
    });
    expect(r.totals?.revenue).toBe(
      EXPECTED_MARCH.netSales + EXPECTED_MARCH.workshopRevenue,
    );
  });

  it('shows money received per method for retail, workshop and combined', async () => {
    const r = await service.revenue(new ReportScope(MARCH));
    type Received = { method: string; amount: number }[];
    const received = r.meta?.received as {
      retail: Received;
      workshop: Received;
      combined: Received;
    };
    const byMethod = (rows: Received): Record<string, number> =>
      Object.fromEntries(rows.map((x) => [x.method, x.amount]));
    expect(byMethod(received.retail)).toEqual(EXPECTED_MARCH.retailReceived);
    // workshop 'transfer' is normalised to bank_transfer
    expect(byMethod(received.workshop)).toEqual({
      cash: 5_000_000,
      bank_transfer: 2_500_000,
    });
    const combined = byMethod(received.combined);
    expect(combined.cash).toBe(EXPECTED_MARCH.retailReceived.cash + 5_000_000);
    expect(combined.bank_transfer).toBe(
      EXPECTED_MARCH.retailReceived.bank_transfer + 2_500_000,
    );
  });

  it('money received differs from sales for a partly paid order', async () => {
    const r = await service.revenue(
      new ReportScope({
        from: '2026-03-05',
        to: '2026-03-05',
        storeId: fx.stores.hanoi,
      }),
    );
    const retail = r.rows.find((row) => row.line === 'retail');
    expect(retail).toMatchObject({ revenue: 3_000_000, received: 1_000_000 });
  });

  it('uses the cost recorded at the time of sale and flags estimated COGS', async () => {
    const before = await service.profit(new ReportScope(MARCH));
    expect(before.meta).toMatchObject({
      cogsRecorded: EXPECTED_MARCH.cogsRecorded,
      cogsEstimated: EXPECTED_MARCH.cogsEstimated,
      estimated: true,
    });
    expect(before.rows[0]).toMatchObject({
      netSales: EXPECTED_MARCH.netSales,
      cogs: EXPECTED_MARCH.cogsRecorded + EXPECTED_MARCH.cogsEstimated,
    });
    expect(before.meta?.cogsEstimatedShare).toBeCloseTo(
      EXPECTED_MARCH.cogsEstimated /
        (EXPECTED_MARCH.cogsRecorded + EXPECTED_MARCH.cogsEstimated),
      3,
    );

    // Changing the product cost afterwards does not change recorded COGS
    await testDb.products.update({
      where: { id: fx.products.exhaustX },
      data: { cost_price: new Prisma.Decimal(2_500_000) },
    });
    const after = await service.profit(
      new ReportScope({
        from: '2026-03-05',
        to: '2026-03-05',
        storeId: fx.stores.hcmc,
      }),
    );
    expect(after.rows[0]).toMatchObject({
      netSales: 4_750_000,
      cogs: 3_000_000,
      grossProfit: 1_750_000,
    });
    expect(after.meta).toMatchObject({ cogsEstimated: 0, estimated: false });
    await testDb.products.update({
      where: { id: fx.products.exhaustX },
      data: { cost_price: new Prisma.Decimal(2_000_000) },
    });
  });

  it('totals VAT from recorded tax, per day and for the period', async () => {
    const day = await service.vat(
      new ReportScope({ from: '2026-03-20', to: '2026-03-20' }),
    );
    expect(day.totals).toMatchObject({
      orders: 1,
      vat: 80_000,
      taxable: 1_000_000,
    });

    const month = await service.vat(new ReportScope(MARCH));
    expect(month.totals?.vat).toBe(EXPECTED_MARCH.tax);
    expect(month.rows).toHaveLength(31);
    expect(month.rows.find((r) => r.period === '2026-03-05')?.vat).toBe(
      300_000,
    );
  });

  it('dashboard KPIs match the sales summary for the same month and store', async () => {
    const now = new Date('2026-03-31T10:00:00+07:00');
    const kpis = await service.dashboardKpis(fx.stores.hcmc, now);
    const summary = await sales.summary(
      new ReportScope({ ...MARCH, storeId: fx.stores.hcmc }, now),
    );
    const s = summary.meta?.summary as { netSales: number; orders: number };
    expect(kpis.monthToDate.retail).toMatchObject({
      netSales: s.netSales,
      orders: s.orders,
    });
    expect(kpis.monthToDate.workshop).toMatchObject({
      revenue: 5_000_000,
      orders: 2,
    }); // SV-T-0001 + SV-T-0007
    expect(kpis.today.retail.orders).toBe(0); // 31 March HCMC has no sale (SO-T-0008 is Hanoi)
    expect(kpis.inventory.lowStockCount).toBe(1);
    expect(kpis.workshop.bikesInService).toBe(2);

    const hanoiNow = await service.dashboardKpis(fx.stores.hanoi, now);
    expect(hanoiNow.today.retail).toMatchObject({
      orders: 1,
      netSales: 900_000,
    });
  });
});
