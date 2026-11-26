import { PayloadTooLargeException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EXPORT_MAX_ROWS, ExportService } from './export.service';
import { col, ReportResult } from './report-types';

const sample: ReportResult = {
  report: 'sales.by-customer',
  title: { vi: 'Khách hàng', en: 'Customers' },
  scope: {
    from: '2026-03-01',
    to: '2026-03-31',
    storeId: null,
    interval: 'daily',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  columns: [
    col('name', 'Khách hàng', 'Customer'),
    col('orders', 'Số đơn', 'Orders', 'integer'),
    col('netSales', 'Doanh thu', 'Net sales', 'money'),
    col('margin', 'Biên', 'Margin', 'percent'),
    col('lastOrder', 'Đơn gần nhất', 'Last order', 'datetime'),
  ],
  rows: [
    {
      name: 'Nguyễn Văn Ánh',
      orders: 3,
      netSales: 4_750_000,
      margin: 36.84,
      lastOrder: new Date('2026-03-05T03:00:00Z'),
    },
    {
      name: 'Smith, "Bob"',
      orders: 1,
      netSales: 900_000,
      margin: 10,
      lastOrder: new Date('2026-03-31T14:00:00Z'),
    },
  ],
  totals: { orders: 4, netSales: 5_650_000 },
};

describe('ExportService', () => {
  const service = new ExportService();

  it('writes an xlsx with a title block, typed cells and a totals row', async () => {
    const buffer = await service.toXlsxBuffer(sample, {
      generatedBy: 'Manager M',
      storeName: 'SCMC HCMC',
      generatedAt: new Date('2026-04-01T02:00:00Z'),
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];

    expect(ws.getCell('A1').value).toBe('Khách hàng');
    expect(ws.getCell('A2').value).toBe('Chi nhánh: SCMC HCMC');
    expect(ws.getCell('A3').value as string).toContain(
      '2026-03-01 → 2026-03-31',
    );
    expect(ws.getCell('A4').value as string).toContain('Manager M');

    // Header row 6, Vietnamese headers
    expect(ws.getRow(6).values).toEqual([
      undefined,
      'Khách hàng',
      'Số đơn',
      'Doanh thu',
      'Biên',
      'Đơn gần nhất',
    ]);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 6 });

    // Amounts are numbers, percent is a fraction, dates are dates
    expect(ws.getCell('C7').value).toBe(4_750_000);
    expect(typeof ws.getCell('C7').value).toBe('number');
    expect(ws.getCell('C7').numFmt).toBe('#,##0');
    expect(ws.getCell('D7').value).toBeCloseTo(0.3684, 4);
    expect(ws.getCell('E7').value).toBeInstanceOf(Date);
    expect(ws.getCell('A7').value).toBe('Nguyễn Văn Ánh');

    // Totals row
    expect(ws.getCell('A9').value).toBe('Tổng cộng');
    expect(ws.getCell('B9').value).toBe(4);
    expect(ws.getCell('C9').value).toBe(5_650_000);
    expect(ws.getRow(9).font?.bold).toBe(true);
  });

  it('writes CSV as UTF-8 with BOM and escapes quotes and commas', () => {
    const csv = service.toCsv(sample);
    expect(csv.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const text = csv.toString('utf8').replace(/^\uFEFF/, '');
    const lines = text.trim().split('\r\n');
    expect(lines[0]).toBe('Khách hàng,Số đơn,Doanh thu,Biên,Đơn gần nhất');
    expect(lines[1]).toBe('Nguyễn Văn Ánh,3,4750000,36.84,05/03/2026 10:00');
    expect(lines[2]).toBe('"Smith, ""Bob""",1,900000,10,31/03/2026 21:00');
    expect(lines[3]).toBe('Tổng cộng,4,5650000,,');
  });

  it('uses English headers when asked', () => {
    const csv = service
      .toCsv(sample, { lang: 'en' })
      .toString('utf8')
      .replace(/^\uFEFF/, '');
    expect(csv.split('\r\n')[0]).toBe(
      'Customer,Orders,Net sales,Margin,Last order',
    );
  });

  it('refuses exports above the row limit, using the paged total when present', () => {
    const tooBig: ReportResult = {
      ...sample,
      meta: { total: EXPORT_MAX_ROWS + 1, page: 1, pageSize: 50 },
    };
    expect(() => service.toCsv(tooBig)).toThrow(PayloadTooLargeException);
    expect(() =>
      service.toCsv({ ...sample, meta: { total: EXPORT_MAX_ROWS } }),
    ).not.toThrow();
  });

  it('builds a safe file name from the report id and period', () => {
    expect(service.fileName(sample, 'xlsx')).toBe(
      'sales.by-customer_2026-03-01_2026-03-31.xlsx',
    );
  });
});
