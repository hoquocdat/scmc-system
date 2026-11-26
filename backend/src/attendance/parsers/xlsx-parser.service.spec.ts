import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { XlsxParserService } from './xlsx-parser.service';

/** Builds a workbook in the layout of the timekeeping export the parser expects. */
async function sampleAttendanceFile(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Cham cong');
  ws.addRow([
    'Bảng chấm công theo số ca làm việc\nThời gian: 01/12/2025 - 16/12/2025\nChi nhánh: SCMC',
  ]);
  ws.addRow([
    'STT',
    'Mã NV',
    'Tên nhân viên',
    'Phòng ban',
    'Chức danh',
    'Tên ca',
    '01/12',
    '02/12',
    '03/12',
    'Tổng công',
  ]);
  ws.addRow(['', '', '', '', '', '', 'T2', 'T3', 'T4', '']);
  ws.addRow([
    1,
    'NV001',
    { richText: [{ text: 'Nguyễn ' }, { text: 'Văn A' }] },
    'Xưởng',
    'KTV',
    'Ca hành chính',
    'X',
    'CV',
    '-',
    2.5,
  ]);
  ws.addRow([
    2,
    'NV002',
    'Trần Thị B',
    'Bán hàng',
    'NVBH',
    'Ca sáng',
    'P',
    'X',
    'O',
    { formula: '1+1', result: 2 },
  ]);
  ws.addRow([3, '', 'Dòng không mã', '', '', '', '', '', '', '']);
  ws.addRow(['Chú thích', 'X: đi làm', 'P: nghỉ phép']);
  ws.addRow([4, 'NV999', 'Sau chú thích', '', '', '', 'X', 'X', 'X', 3]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('XlsxParserService (exceljs)', () => {
  const service = new XlsxParserService();

  it('parses period info, date columns and employee rows', async () => {
    const result = await service.parseAttendanceFile(
      await sampleAttendanceFile(),
    );

    expect(result.periodInfo).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-16',
      branch: 'SCMC',
    });
    expect(result.dateColumns).toEqual(['01/12', '02/12', '03/12']);
    expect(result.records.map((r) => r.employeeCode)).toEqual([
      'NV001',
      'NV002',
    ]); // stops at "Chú thích"
    expect(result.summary).toEqual({
      totalRows: 2,
      successfulRows: 2,
      warningRows: 0,
      errorRows: 0,
    });

    const a = result.records[0];
    expect(a.employeeName).toBe('Nguyễn Văn A'); // rich text flattened
    expect(a.department).toBe('Xưởng');
    expect(a.shiftName).toBe('Ca hành chính');
    expect([...a.dailyAttendance.entries()]).toEqual([
      ['01/12', 'X'],
      ['02/12', 'CV'],
    ]);
    expect(a.summaryData.totalWorkDays).toBe(2.5);

    const b = result.records[1];
    expect([...b.dailyAttendance.entries()]).toEqual([
      ['01/12', 'P'],
      ['02/12', 'X'],
      ['03/12', 'O'],
    ]);
    expect(b.summaryData.totalWorkDays).toBe(2); // formula result
  });

  it('rejects legacy .xls files with a clear message', async () => {
    const xls = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(64),
    ]);
    await expect(service.parseAttendanceFile(xls)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.parseAttendanceFile(xls)).rejects.toThrow(/\.xlsx/);
  });

  it('rejects files that are not workbooks', async () => {
    await expect(
      service.parseAttendanceFile(Buffer.from('not a workbook')),
    ).rejects.toThrow(BadRequestException);
  });

  it('keeps the attendance type and hours mapping', () => {
    expect(service.getAttendanceType('cv')).toBe('check_in_only');
    expect(service.getRegularHours('check_in_only')).toBe(4);
    expect(service.getRegularHours('regular')).toBe(8);
  });
});
