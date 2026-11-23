import { closeTestDb, resetTestDb, testDb } from './db';
import { EXPECTED_MARCH, seedReportFixtures, vn } from './report-fixtures';

describe('report fixtures', () => {
  beforeAll(async () => {
    await resetTestDb();
    await seedReportFixtures();
  });

  afterAll(closeTestDb);

  it('seeds orders in every status across two stores', async () => {
    const statuses = await testDb.sales_orders.groupBy({
      by: ['status'],
      _count: true,
    });
    expect(statuses.map((s) => s.status).sort()).toEqual(
      [
        'cancelled',
        'completed',
        'confirmed',
        'draft',
        'pending',
        'processing',
        'ready',
      ].sort(),
    );
    const stores = await testDb.sales_orders.groupBy({
      by: ['store_id'],
      _count: true,
    });
    expect(stores).toHaveLength(2);
  });

  it('stores the 06:30 Vietnam sale as 23:30 UTC the day before', async () => {
    const order = await testDb.sales_orders.findUnique({
      where: { order_number: 'SO-T-0002' },
    });
    expect(order?.order_date?.toISOString()).toBe('2026-03-04T23:30:00.000Z');
    expect(vn('2026-03-05 06:30').toISOString()).toBe(
      '2026-03-04T23:30:00.000Z',
    );
  });

  it('keeps stock on hand as seeded despite the inventory trigger', async () => {
    const rows = await testDb.inventory.findMany({
      orderBy: { quantity_on_hand: 'asc' },
    });
    expect(rows.map((r) => r.quantity_on_hand)).toEqual([2, 3, 4, 10, 100]);
  });

  it('records payments in both retail and workshop tables', async () => {
    const retail = await testDb.sales_order_payments.aggregate({
      _sum: { amount: true },
      where: { status: 'completed' },
    });
    const workshop = await testDb.payments.aggregate({
      _sum: { amount: true },
    });
    const expectedRetail =
      Object.values(EXPECTED_MARCH.retailReceived).reduce((a, b) => a + b, 0) +
      700_000; // + February sale
    expect(Number(retail._sum.amount)).toBe(expectedRetail);
    expect(Number(workshop._sum.amount)).toBe(
      EXPECTED_MARCH.workshopRevenue + 1_500_000,
    ); // + February service
  });

  it('seeds a service order with a primary and a secondary technician', async () => {
    const order = await testDb.service_orders.findUnique({
      where: { order_number: 'SV-T-0001' },
      include: { service_order_employees: true },
    });
    expect(order?.service_order_employees).toHaveLength(2);
    expect(
      order?.service_order_employees.filter((e) => e.is_primary),
    ).toHaveLength(1);
  });
});
