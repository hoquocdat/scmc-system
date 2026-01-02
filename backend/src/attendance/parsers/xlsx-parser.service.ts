import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface ParsedAttendanceRow {
  rowNumber: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  position: string;
  shiftName: string;
  dailyAttendance: Map<string, string>; // date -> mark (X, CV, CR, P, O, -)
  summaryData: {
    totalWorkDays?: number;
    totalShifts?: number;
    totalHours?: string;
    lateCount?: number;
    earlyLeaveCount?: number;
    overtimeHours?: string;
    unpaidAbsenceCount?: number;
    paidLeaveCount?: number;
  };
  rawData: Record<string, unknown>;
  validationStatus: 'valid' | 'warning' | 'error';
  validationNotes: string[];
}

export interface ParseResult {
  periodInfo: {
    startDate: string;
    endDate: string;
    branch: string;
  };
  dateColumns: string[]; // List of dates found in headers
  records: ParsedAttendanceRow[];
  summary: {
    totalRows: number;
    successfulRows: number;
    warningRows: number;
    errorRows: number;
  };
  errors: Array<{
    row: number;
    column?: string;
    message: string;
  }>;
}

@Injectable()
export class XlsxParserService {
  // Attendance marks mapping
  private readonly ATTENDANCE_MARKS: Record<string, string> = {
    X: 'regular', // Full attendance
    CV: 'check_in_only', // Checked in only
    CR: 'check_out_only', // Checked out only
    P: 'leave_paid', // Paid leave
    O: 'leave_unpaid', // Unpaid absence
    '-': 'no_data', // No data
  };

  parseAttendanceFile(fileBuffer: Buffer): ParseResult {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with headers
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as unknown[][];

      if (rawData.length < 4) {
        throw new BadRequestException(
          'File does not contain enough data rows',
        );
      }

      // Parse header info (row 0)
      const periodInfo = this.parsePeriodInfo(rawData[0] as string[]);

      // Parse column headers (rows 1-2)
      const { dateColumns, headerMap } = this.parseHeaders(
        rawData[1] as string[],
        rawData[2] as string[],
      );

      // Parse data rows (starting from row 3)
      const records: ParsedAttendanceRow[] = [];
      const errors: ParseResult['errors'] = [];

      for (let i = 3; i < rawData.length; i++) {
        const row = rawData[i] as string[];

        // Skip empty rows or legend rows
        if (
          !row ||
          row.length === 0 ||
          String(row[0]).toLowerCase() === 'chú thích'
        ) {
          break;
        }

        // Skip rows that don't have employee code
        const employeeCode = String(row[1] || '').trim();
        if (!employeeCode || !employeeCode.startsWith('NV')) {
          continue;
        }

        try {
          const parsedRow = this.parseDataRow(
            row,
            i + 1,
            dateColumns,
            headerMap,
          );
          records.push(parsedRow);

          if (parsedRow.validationStatus === 'error') {
            errors.push(
              ...parsedRow.validationNotes.map((note) => ({
                row: i + 1,
                message: note,
              })),
            );
          }
        } catch (error) {
          errors.push({
            row: i + 1,
            message: error.message || 'Failed to parse row',
          });
        }
      }

      // Calculate summary
      const summary = {
        totalRows: records.length,
        successfulRows: records.filter((r) => r.validationStatus === 'valid')
          .length,
        warningRows: records.filter((r) => r.validationStatus === 'warning')
          .length,
        errorRows: records.filter((r) => r.validationStatus === 'error').length,
      };

      return {
        periodInfo,
        dateColumns,
        records,
        summary,
        errors,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to parse Excel file: ${error.message}`,
      );
    }
  }

  private parsePeriodInfo(headerRow: string[]): ParseResult['periodInfo'] {
    // Header format: "Bảng chấm công theo số ca làm việc \n Thời gian: 01/12/2025 - 16/12/2025\n Chi nhánh: SCMC"
    const headerText = String(headerRow[0] || '');

    // Extract date range
    const dateMatch = headerText.match(
      /Thời gian:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/,
    );
    const branchMatch = headerText.match(/Chi nhánh:\s*([^\n]+)/);

    return {
      startDate: dateMatch ? this.convertDateFormat(dateMatch[1]) : '',
      endDate: dateMatch ? this.convertDateFormat(dateMatch[2]) : '',
      branch: branchMatch ? branchMatch[1].trim() : '',
    };
  }

  private parseHeaders(
    row1: string[],
    row2: string[],
  ): {
    dateColumns: string[];
    headerMap: Map<number, { date: string; dayOfWeek: string }>;
  } {
    const dateColumns: string[] = [];
    const headerMap = new Map<number, { date: string; dayOfWeek: string }>();

    // Find where date columns start (after fixed columns: STT, Mã NV, Tên, Phòng ban, Chức danh, Tên ca)
    const fixedColumnsEnd = 6;

    for (let i = fixedColumnsEnd; i < row1.length; i++) {
      const header1 = String(row1[i] || '').trim();
      const header2 = String(row2[i] || '').trim();

      // Check if this looks like a date column (e.g., "01/12")
      const dateMatch = header1.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (dateMatch) {
        const date = header1;
        const dayOfWeek = header2;
        dateColumns.push(date);
        headerMap.set(i, { date, dayOfWeek });
      }
    }

    return { dateColumns, headerMap };
  }

  private parseDataRow(
    row: string[],
    rowNumber: number,
    dateColumns: string[],
    headerMap: Map<number, { date: string; dayOfWeek: string }>,
  ): ParsedAttendanceRow {
    const validationNotes: string[] = [];
    let validationStatus: 'valid' | 'warning' | 'error' = 'valid';

    // Parse fixed columns
    const employeeCode = String(row[1] || '').trim();
    const employeeName = String(row[2] || '').trim();
    const department = String(row[3] || '').trim();
    const position = String(row[4] || '').trim();
    const shiftName = String(row[5] || '').trim();

    // Validate employee code
    if (!employeeCode) {
      validationNotes.push('Missing employee code');
      validationStatus = 'error';
    }

    // Parse daily attendance
    const dailyAttendance = new Map<string, string>();
    const fixedColumnsEnd = 6;

    for (const [colIndex, dateInfo] of headerMap.entries()) {
      const mark = String(row[colIndex] || '').trim().toUpperCase();
      if (mark && mark !== '-') {
        dailyAttendance.set(dateInfo.date, mark);
      }
    }

    // Parse summary columns (after date columns)
    const summaryStartIndex = fixedColumnsEnd + dateColumns.length;
    const summaryData: ParsedAttendanceRow['summaryData'] = {};

    // Try to extract summary values (these columns may vary in position)
    // Based on the sample file structure
    if (row[summaryStartIndex]) {
      summaryData.totalWorkDays = this.parseNumber(row[summaryStartIndex]);
    }

    // Store raw data for debugging
    const rawData: Record<string, unknown> = {};
    row.forEach((cell, index) => {
      rawData[`col_${index}`] = cell;
    });

    return {
      rowNumber,
      employeeCode,
      employeeName,
      department,
      position,
      shiftName,
      dailyAttendance,
      summaryData,
      rawData,
      validationStatus,
      validationNotes,
    };
  }

  private convertDateFormat(dateStr: string): string {
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  private parseNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  // Map attendance mark to attendance type for database
  getAttendanceType(
    mark: string,
  ):
    | 'regular'
    | 'check_in_only'
    | 'check_out_only'
    | 'leave_paid'
    | 'leave_unpaid'
    | 'day_off' {
    const markUpper = mark.toUpperCase();
    switch (markUpper) {
      case 'X':
        return 'regular';
      case 'CV':
        return 'check_in_only';
      case 'CR':
        return 'check_out_only';
      case 'P':
        return 'leave_paid';
      case 'O':
        return 'leave_unpaid';
      default:
        return 'day_off';
    }
  }

  // Get regular hours based on attendance type
  getRegularHours(attendanceType: string, standardHours: number = 8): number {
    switch (attendanceType) {
      case 'regular':
        return standardHours;
      case 'check_in_only':
      case 'check_out_only':
        return standardHours * 0.5; // Count as half day
      case 'leave_paid':
        return standardHours; // Paid leave counts as full day
      default:
        return 0;
    }
  }
}
