import {
  ExecutionContext,
  ForbiddenException,
  PayloadTooLargeException,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { lastValueFrom, of } from 'rxjs';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import { CaslAbilityFactory } from '../../src/casl/casl-ability.factory';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  isExport,
  ReportQueryDto,
} from '../../src/reports/dto/report-query.dto';
import {
  EXPORT_MAX_ROWS,
  ExportService,
} from '../../src/reports/export.service';
import { InventoryReportsService } from '../../src/reports/inventory-reports.service';
import {
  ReportExportInterceptor,
  reportEntityId,
} from '../../src/reports/report-export.interceptor';
import { ReportScope } from '../../src/reports/report-scope';
import { ReportResult } from '../../src/reports/report-types';
import { SalesReportsService } from '../../src/reports/sales-reports.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import {
  MARCH,
  ReportFixtures,
  seedReportFixtures,
  vn,
} from './report-fixtures';

async function streamToBuffer(file: StreamableFile): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of file.getStream())
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe('report export (interceptor)', () => {
  let interceptor: ReportExportInterceptor;
  let inventory: InventoryReportsService;
  let sales: SalesReportsService;
  let fx: ReportFixtures;
  const users: Record<string, string> = {};

  async function userWithRole(role: string): Promise<string> {
    const id = randomUUID();
    await testDb.user_profiles.create({
      data: { id, role: 'sales', full_name: `User ${role}` },
    });
    const r = await testDb.roles.findUniqueOrThrow({ where: { name: role } });
    await testDb.user_roles.create({ data: { user_id: id, role_id: r.id } });
    return id;
  }

  function context(userId: string, query: Record<string, string>) {
    const headers: Record<string, string> = {};
    const req = {
      user: { id: userId, full_name: 'Finance F' },
      query,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
    };
    const res = { setHeader: (k: string, v: string) => (headers[k] = v) };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;
    return { ctx, headers };
  }

  async function run(
    userId: string,
    query: Record<string, string>,
    result: ReportResult,
  ) {
    const { ctx, headers } = context(userId, query);
    const obs = await interceptor.intercept(ctx, { handle: () => of(result) });
    const out = await lastValueFrom(obs);
    return { out, headers };
  }

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedReportFixtures();
    const prisma = testDb as unknown as PrismaService;
    inventory = new InventoryReportsService(prisma);
    sales = new SalesReportsService(prisma);
    interceptor = new ReportExportInterceptor(
      new ExportService(),
      new CaslAbilityFactory(prisma),
      new ActivityLogsService(prisma),
      prisma,
    );
    users.finance = await userWithRole('finance');
    users.associate = await userWithRole('sales_associate');
    users.warehouse = await userWithRole('warehouse_staff');
  });
  afterAll(closeTestDb);

  it('passes JSON requests through untouched', async () => {
    const result = await sales.summary(new ReportScope(MARCH));
    const { out } = await run(users.associate, {}, result);
    expect(out).toBe(result);
  });

  it('refuses a user without reports:export even when they may view the report', async () => {
    const result = await inventory.lowStock(new ReportScope(MARCH));
    await expect(
      run(users.warehouse, { format: 'csv' }, result),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const logs = await testDb.activity_logs.count({
      where: { action: 'export' },
    });
    expect(logs).toBe(0);
  });

  it('exports every row of a paged report as CSV and logs the export', async () => {
    const base = vn('2026-03-28 08:00').getTime();
    await testDb.inventory_transactions.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        location_id: fx.locations.hcmc,
        product_id: fx.products.sticker,
        transaction_type: 'ADJUST',
        quantity: 1,
        created_at: new Date(base + i * 60_000),
      })),
    });
    const q = {
      format: 'csv',
      from: MARCH.from,
      to: MARCH.to,
      type: 'ADJUST',
    } as ReportQueryDto;
    // What the controller does for an export: all rows, paging ignored
    const result = await inventory.movement(new ReportScope(q), {
      ...q,
      all: isExport(q),
    });
    expect(result.rows).toHaveLength(120);
    expect(result.meta).toMatchObject({ total: 120, page: 1, pageSize: 120 });

    const { out, headers } = await run(
      users.finance,
      q as unknown as Record<string, string>,
      result,
    );
    expect(out).toBeInstanceOf(StreamableFile);
    expect(headers['Content-Type']).toContain('text/csv');
    expect(headers['Content-Disposition']).toBe(
      'attachment; filename="inventory.movement_2026-03-01_2026-03-31.csv"',
    );
    const text = (await streamToBuffer(out as StreamableFile)).toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.trim().split('\r\n');
    expect(lines).toHaveLength(1 + 120); // header + every row, no totals for this report

    const log = await testDb.activity_logs.findFirst({
      where: { action: 'export' },
    });
    expect(log).toMatchObject({
      user_id: users.finance,
      entity_type: 'report',
      entity_id: reportEntityId('inventory.movement'),
    });
    expect(log?.new_values).toMatchObject({
      report: 'inventory.movement',
      format: 'csv',
      rows: 120,
      filters: { type: 'ADJUST' },
    });
  });

  it('exports xlsx as a stream with the right headers', async () => {
    const result = await sales.byCategory(
      new ReportScope({ ...MARCH, storeId: fx.stores.hanoi }),
    );
    const { out, headers } = await run(
      users.finance,
      { format: 'xlsx', lang: 'en' },
      result,
    );
    const buffer = await streamToBuffer(out as StreamableFile);
    expect(buffer.subarray(0, 2).toString()).toBe('PK'); // zip container
    expect(headers['Content-Type']).toContain('spreadsheetml');
    expect(headers['Content-Disposition']).toContain(
      'sales.by-category_2026-03-01_2026-03-31.xlsx',
    );
  });

  it('refuses exports above the row limit and does not log them', async () => {
    const before = await testDb.activity_logs.count({
      where: { action: 'export' },
    });
    const result = await inventory.movement(new ReportScope(MARCH), {
      page: 1,
      pageSize: 10,
    });
    const tooBig = {
      ...result,
      meta: { ...result.meta, total: EXPORT_MAX_ROWS + 1 },
    };
    await expect(
      run(users.finance, { format: 'xlsx' }, tooBig),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(
      await testDb.activity_logs.count({ where: { action: 'export' } }),
    ).toBe(before);
  });
});
