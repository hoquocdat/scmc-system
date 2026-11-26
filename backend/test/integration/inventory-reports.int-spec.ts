import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { InventoryReportsService } from '../../src/reports/inventory-reports.service';
import { ReportScope } from '../../src/reports/report-scope';
import { closeTestDb, resetTestDb, testDb } from './db';
import {
  MARCH,
  ReportFixtures,
  seedReportFixtures,
  vn,
} from './report-fixtures';

describe('InventoryReportsService', () => {
  let service: InventoryReportsService;
  let fx: ReportFixtures;
  const scope = () => new ReportScope(MARCH);

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedReportFixtures();
    service = new InventoryReportsService(testDb as unknown as PrismaService);
  });
  afterAll(closeTestDb);

  it('values a variant at its own cost and filters by location', async () => {
    const r = await service.valuation(scope(), {
      locationId: fx.locations.hanoi,
    });
    const variant = r.rows.find((row) => row.sku === 'JEANS-B-32');
    expect(variant).toMatchObject({
      quantity: 3,
      unitCost: 400_000,
      value: 1_200_000,
    });
    expect(r.rows.every((row) => row.locationId === fx.locations.hanoi)).toBe(
      true,
    );
    // Hanoi: Jeans A 4 x 500,000 + variant 1,200,000 + Sticker 100 x 10,000
    expect(r.totals).toEqual({
      quantity: 107,
      value: 2_000_000 + 1_200_000 + 1_000_000,
    });

    const all = await service.valuation(scope());
    expect((all.meta?.byLocation as unknown[]).length).toBe(2);
  });

  it('pages stock movements and reports the total', async () => {
    // Add 60 extra movements so paging is exercised
    const base = vn('2026-03-28 08:00').getTime();
    await testDb.inventory_transactions.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        location_id: fx.locations.hcmc,
        product_id: fx.products.sticker,
        transaction_type: 'ADJUST',
        quantity: 1,
        created_at: new Date(base + i * 60_000),
      })),
    });
    const page1 = await service.movement(scope(), { page: 1, pageSize: 50 });
    expect(page1.rows).toHaveLength(50);
    // 60 adjustments + 5 SALE lines in March (SO-T-0001 x2, 0002, 0005, 0006, 0008 = 6) + 1 RECEIVE
    expect(page1.meta).toMatchObject({ page: 1, pageSize: 50, total: 67 });
    const page2 = await service.movement(scope(), { page: 2, pageSize: 50 });
    expect(page2.rows).toHaveLength(17);

    const sales = await service.movement(scope(), {
      type: 'sale',
      productId: fx.products.jeansA,
    });
    expect(
      sales.rows.every((row) => row.type === 'SALE' && row.sku === 'JEANS-A'),
    ).toBe(true);
    expect(sales.meta?.total).toBe(3);
  });

  it('lists products at or below their reorder point per location', async () => {
    const r = await service.lowStock(scope());
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      sku: 'EXH-X',
      quantity: 2,
      reorderPoint: 5,
      shortfall: 3,
      locationId: fx.locations.hcmc,
    });

    // Exactly at the reorder point counts
    await testDb.inventory.updateMany({
      where: {
        product_id: fx.products.jeansA,
        location_id: fx.locations.hanoi,
      },
      data: { quantity_on_hand: 2 },
    });
    const atPoint = await service.lowStock(scope(), {
      locationId: fx.locations.hanoi,
    });
    expect(atPoint.rows.map((row) => row.sku)).toEqual(['JEANS-A']);
    await testDb.inventory.updateMany({
      where: {
        product_id: fx.products.jeansA,
        location_id: fx.locations.hanoi,
      },
      data: { quantity_on_hand: 4 },
    });
  });

  it('counts units sold once for a product stocked in two locations', async () => {
    const r = await service.turnover(scope());
    const jeansA = r.rows.find((row) => row.sku === 'JEANS-A');
    // Sold 2 + 1 + 1 = 4 units in March, stocked in HCMC (10) and Hanoi (4)
    expect(jeansA).toMatchObject({
      unitsSold: 4,
      averageStock: 7,
      totalStock: 14,
      turnoverRatio: 0.57,
    });
    // COGS: 2 x 500,000 recorded + 2 x 500,000 current cost fallback
    expect(jeansA?.cogs).toBe(2_000_000);
    const variantParent = r.rows.find((row) => row.sku === 'JEANS-B');
    expect(variantParent).toMatchObject({ unitsSold: 1, cogs: 400_000 });
  });

  it('has no rows for a period without sales', async () => {
    const r = await service.turnover(
      new ReportScope({ from: '2026-01-01', to: '2026-01-31' }),
    );
    expect(r.rows).toEqual([]);
    expect(Prisma.sql`x`).toBeDefined();
  });
});
