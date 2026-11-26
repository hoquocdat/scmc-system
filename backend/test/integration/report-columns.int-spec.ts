import { PrismaService } from '../../src/prisma/prisma.service';
import { FinancialReportsService } from '../../src/reports/financial-reports.service';
import { InventoryReportsService } from '../../src/reports/inventory-reports.service';
import { ReportScope } from '../../src/reports/report-scope';
import { ReportResult } from '../../src/reports/report-types';
import { SalesReportsService } from '../../src/reports/sales-reports.service';
import { WorkshopReportsService } from '../../src/reports/workshop-reports.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { MARCH, seedReportFixtures } from './report-fixtures';

/**
 * Every report returns a column definition that matches its rows, so the
 * on-screen table and the exported file share one contract.
 */
describe('report column contracts', () => {
  const reports: Record<string, () => Promise<ReportResult>> = {};

  beforeAll(async () => {
    await resetTestDb();
    await seedReportFixtures();
    const prisma = testDb as unknown as PrismaService;
    const sales = new SalesReportsService(prisma);
    const inventory = new InventoryReportsService(prisma);
    const workshop = new WorkshopReportsService(prisma);
    const financial = new FinancialReportsService(
      prisma,
      sales,
      workshop,
      inventory,
    );
    const scope = new ReportScope(MARCH);

    Object.assign(reports, {
      'sales.summary': () => sales.summary(scope),
      'sales.by-category': () => sales.byCategory(scope),
      'sales.by-payment-method': () => sales.byPaymentMethod(scope),
      'sales.top-products': () => sales.topProducts(scope),
      'sales.trends': () => sales.trends(scope),
      'inventory.valuation': () => inventory.valuation(scope),
      'inventory.movement': () => inventory.movement(scope),
      'inventory.low-stock': () => inventory.lowStock(scope),
      'inventory.turnover': () => inventory.turnover(scope),
      'financial.revenue': () => financial.revenue(scope),
      'financial.profit': () => financial.profit(scope),
      'financial.vat': () => financial.vat(scope),
      'workshop.revenue': () => workshop.revenue(scope),
      'workshop.technicians': () => workshop.technicians(scope),
      'workshop.parts': () => workshop.parts(scope),
      'workshop.in-service': () => workshop.inService(scope),
      'workshop.turnaround': () => workshop.turnaround(scope),
    });
  });
  afterAll(closeTestDb);

  it('declares columns whose keys exist on every row, with both header languages', async () => {
    for (const [name, run] of Object.entries(reports)) {
      const result = await run();
      expect({ name, report: result.report }).toEqual({ name, report: name });
      expect(result.columns.length).toBeGreaterThan(0);
      expect(result.rows.length).toBeGreaterThan(0); // fixtures give every report data
      for (const column of result.columns) {
        expect({
          name,
          key: column.key,
          vi: column.header.vi.length > 0,
          en: column.header.en.length > 0,
        }).toEqual({
          name,
          key: column.key,
          vi: true,
          en: true,
        });
        for (const row of result.rows) {
          expect({ name, key: column.key, present: column.key in row }).toEqual(
            { name, key: column.key, present: true },
          );
        }
      }
      if (result.totals) {
        for (const key of Object.keys(result.totals)) {
          expect({
            name,
            totalKey: key,
            isColumn: result.columns.some((c) => c.key === key),
          }).toEqual({ name, totalKey: key, isColumn: true });
        }
      }
    }
  });
});
