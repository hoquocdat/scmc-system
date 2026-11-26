import { Prisma } from '@prisma/client';
import { ReportScope } from '../../src/reports/report-scope';
import { closeTestDb, resetTestDb, testDb } from './db';
import { seedReportFixtures } from './report-fixtures';

describe('ReportScope SQL fragments', () => {
  beforeAll(async () => {
    await resetTestDb();
    await seedReportFixtures();
  });
  afterAll(closeTestDb);

  it('buckets the 06:30 Vietnam sale under 5 March', async () => {
    const scope = new ReportScope({ from: '2026-03-01', to: '2026-03-31' });
    const rows = await testDb.$queryRaw<{ period: string }[]>`
      SELECT ${scope.periodKey(Prisma.sql`so.order_date`)} AS period
      FROM sales_orders so WHERE so.order_number = 'SO-T-0002'`;
    expect(rows[0].period).toBe('2026-03-05');
  });

  it('includes the 21:00 sale on the end date and excludes February', async () => {
    const scope = new ReportScope({ from: '2026-03-01', to: '2026-03-31' });
    const rows = await testDb.$queryRaw<{ order_number: string }[]>`
      SELECT so.order_number FROM sales_orders so
      WHERE ${scope.inRange(Prisma.sql`so.order_date`)}
      ORDER BY so.order_number`;
    const numbers = rows.map((r) => r.order_number);
    expect(numbers).toContain('SO-T-0008');
    expect(numbers).not.toContain('SO-T-0007');
  });

  it('returns empty periods as rows', async () => {
    const scope = new ReportScope({ from: '2026-03-04', to: '2026-03-06' });
    const rows = await testDb.$queryRaw<{ period: string; orders: number }[]>`
      SELECT p.period, COUNT(so.id)::int AS orders
      FROM ${scope.periodSeries()} p
      LEFT JOIN sales_orders so
        ON ${scope.periodKey(Prisma.sql`so.order_date`)} = p.period
       AND ${scope.inRange(Prisma.sql`so.order_date`)}
       AND ${ReportScope.revenueStatus(Prisma.sql`so.status`)}
      GROUP BY p.period ORDER BY p.period`;
    expect(rows).toEqual([
      { period: '2026-03-04', orders: 0 },
      { period: '2026-03-05', orders: 2 },
      { period: '2026-03-06', orders: 0 },
    ]);
  });

  it('filters by store', async () => {
    const fixtures = await testDb.stores.findFirst({ where: { code: 'HN' } });
    const scope = new ReportScope({
      from: '2026-03-01',
      to: '2026-03-31',
      storeId: fixtures.id,
    });
    const rows = await testDb.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM sales_orders so
      WHERE ${scope.inRange(Prisma.sql`so.order_date`)}
        AND ${ReportScope.revenueStatus(Prisma.sql`so.status`)}
        ${scope.storeFilter(Prisma.sql`so.store_id`)}`;
    expect(rows[0].n).toBe(3); // SO-T-0002, 0005, 0008
  });
});
