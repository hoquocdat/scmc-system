import { PrismaService } from '../../src/prisma/prisma.service';
import { ReportScope } from '../../src/reports/report-scope';
import { WorkshopReportsService } from '../../src/reports/workshop-reports.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import {
  EXPECTED_MARCH,
  MARCH,
  ReportFixtures,
  seedReportFixtures,
} from './report-fixtures';

type Row = Record<string, unknown>;
const indexBy = (rows: Row[], key: string): Record<string, Row> =>
  Object.fromEntries(
    rows.map((r) => {
      const k = r[key];
      return [typeof k === 'string' ? k : JSON.stringify(k), r];
    }),
  );
const rowsByName = (rows: Row[]) => indexBy(rows, 'fullName');

describe('WorkshopReportsService', () => {
  let service: WorkshopReportsService;
  let fx: ReportFixtures;

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedReportFixtures();
    service = new WorkshopReportsService(testDb as unknown as PrismaService);
  });
  afterAll(closeTestDb);

  it('counts only delivered orders, dated by delivery', async () => {
    const r = await service.revenue(
      new ReportScope({ ...MARCH, interval: 'monthly' }),
    );
    // SV-T-0001 (4,000,000) + SV-T-0002 (estimated 2,500,000) + SV-T-0007 (received in Feb, delivered 2 March)
    expect(r.meta?.summary).toEqual({
      orders: 3,
      revenue: EXPECTED_MARCH.workshopRevenue,
      averageOrderValue: 2_500_000,
    });
    expect(r.rows).toEqual([
      {
        period: '2026-03',
        orders: 3,
        revenue: 7_500_000,
        averageOrderValue: 2_500_000,
      },
    ]);

    const feb = await service.revenue(
      new ReportScope({ from: '2026-02-01', to: '2026-02-28' }),
    );
    expect(feb.meta?.summary).toMatchObject({ orders: 1, revenue: 1_500_000 }); // SV-T-0006 only

    const hanoi = await service.revenue(
      new ReportScope({ ...MARCH, storeId: fx.stores.hanoi }),
    );
    expect(hanoi.meta?.summary).toMatchObject({
      orders: 1,
      revenue: 2_500_000,
    });
  });

  it('counts an order for every technician but attributes revenue to the primary one', async () => {
    // 3 March: only SV-T-0001 (A primary, B secondary)
    const day = await service.technicians(
      new ReportScope({ from: '2026-03-03', to: '2026-03-03' }),
    );
    const byName = rowsByName(day.rows);
    expect(byName['Tech A']).toMatchObject({
      orders: 1,
      revenue: 4_000_000,
      averageTurnaroundDays: 2,
    });
    expect(byName['Tech B']).toMatchObject({
      orders: 1,
      revenue: 0,
      averageTurnaroundDays: 2,
    });

    // Whole month: SV-T-0002 has no service_order_employees rows and falls back to assigned_employee_id (A)
    const month = await service.technicians(new ReportScope(MARCH));
    const m = rowsByName(month.rows);
    expect(m['Tech A']).toMatchObject({
      orders: 2,
      revenue: 6_500_000,
      averageTurnaroundDays: 3,
    });
    expect(m['Tech B']).toMatchObject({
      orders: 2,
      revenue: 1_000_000,
      averageTurnaroundDays: 3,
    });
  });

  it('ranks parts used by total cost', async () => {
    const r = await service.parts(new ReportScope(MARCH), 10);
    expect(
      r.rows.map((p) => [p.name, p.quantity, p.totalCost, p.orders]),
    ).toEqual([
      ['Brake pad', 3, 450_000, 2],
      ['Oil filter', 1, 100_000, 1],
    ]);
    const top1 = await service.parts(new ReportScope(MARCH), 1);
    expect(top1.rows).toHaveLength(1);
  });

  it('reports bikes currently in service per status', async () => {
    const r = await service.inService(new ReportScope(MARCH));
    expect(r.meta?.byStatus).toEqual({ in_progress: 2, waiting_parts: 1 });
    expect(r.meta?.total).toBe(EXPECTED_MARCH.bikesInService.total);
    expect(r.rows.find((x) => x.status === 'in_progress')?.bikes).toBe(2);
    expect(r.rows.find((x) => x.status === 'quality_check')?.bikes).toBe(0);

    const hcmc = await service.inService(
      new ReportScope({ ...MARCH, storeId: fx.stores.hcmc }),
    );
    expect(hcmc.meta?.total).toBe(2);
  });

  it('computes average and median turnaround overall and per branch', async () => {
    const r = await service.turnaround(new ReportScope(MARCH));
    // Delivered in March: 2, 4 and 4 days
    expect(r.meta?.overall).toMatchObject({
      orders: 3,
      averageDays: 3.33,
      medianDays: 4,
    });
    const byStore = indexBy(r.rows, 'store');
    expect(byStore['SCMC HCMC']).toMatchObject({
      orders: 2,
      averageDays: 3,
      medianDays: 3,
    });
    expect(byStore['SCMC Hanoi']).toMatchObject({
      orders: 1,
      averageDays: 4,
      medianDays: 4,
    });

    const twoOrders = await service.turnaround(
      new ReportScope({ from: '2026-03-01', to: '2026-03-10' }),
    );
    // SV-T-0001 (2 days) and SV-T-0007 (4 days) -> average 3
    expect(twoOrders.meta?.overall).toMatchObject({
      orders: 2,
      averageDays: 3,
    });
  });
});
