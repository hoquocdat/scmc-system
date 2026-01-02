import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  XlsxParserService,
  ParseResult,
} from './parsers/xlsx-parser.service';
import {
  ManualAttendanceDto,
  UpdateAttendanceDto,
  AttendanceRecordQueryDto,
} from './dto/import-attendance.dto';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private xlsxParser: XlsxParserService,
  ) {}

  async importAttendance(
    periodId: string,
    file: Express.Multer.File,
    userId: string,
    clearExisting: boolean = true,
  ) {
    // Verify period exists and is in draft status
    const period = await this.prisma.payroll_periods.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new NotFoundException(`Payroll period ${periodId} not found`);
    }

    if (period.status !== 'draft') {
      throw new BadRequestException(
        'Attendance can only be imported when period is in draft status',
      );
    }

    // Create import log
    const importBatchId = uuidv4();
    const importLog = await this.prisma.attendance_import_logs.create({
      data: {
        payroll_period_id: periodId,
        file_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype.includes('sheet') ? 'xlsx' : 'csv',
        status: 'processing',
        imported_by: userId,
      },
    });

    try {
      // Parse the file
      const parseResult = this.xlsxParser.parseAttendanceFile(file.buffer);

      // Clear existing attendance if requested
      if (clearExisting) {
        await this.prisma.attendance_records.deleteMany({
          where: { payroll_period_id: periodId },
        });
      }

      // Get all employees by code for matching
      const employees = await this.prisma.user_profiles.findMany({
        where: { employee_code: { not: null } },
        select: { id: true, employee_code: true, full_name: true },
      });

      const employeeMap = new Map(
        employees.map((e) => [e.employee_code, e]),
      );

      // Process each record
      const errors: Array<{
        row: number;
        column?: string;
        message: string;
      }> = [...parseResult.errors];
      let successfulRows = 0;
      let warningRows = 0;

      for (const record of parseResult.records) {
        const employee = employeeMap.get(record.employeeCode);

        if (!employee) {
          errors.push({
            row: record.rowNumber,
            message: `Employee with code ${record.employeeCode} not found in system`,
          });
          continue;
        }

        // Create attendance records for each day
        for (const [dateStr, mark] of record.dailyAttendance) {
          try {
            // Convert date format (DD/MM to YYYY-MM-DD)
            const workDate = this.convertToFullDate(
              dateStr,
              period.period_year,
              period.period_month,
            );

            const attendanceType = this.xlsxParser.getAttendanceType(mark);
            const regularHours = this.xlsxParser.getRegularHours(attendanceType);

            await this.prisma.attendance_records.upsert({
              where: {
                payroll_period_id_employee_id_work_date: {
                  payroll_period_id: periodId,
                  employee_id: employee.id,
                  work_date: workDate,
                },
              },
              create: {
                payroll_period_id: periodId,
                employee_id: employee.id,
                work_date: workDate,
                attendance_type: attendanceType as Prisma.Enumattendance_typeFieldUpdateOperationsInput['set'],
                regular_hours: new Prisma.Decimal(regularHours),
                overtime_hours: new Prisma.Decimal(0),
                import_batch_id: importBatchId,
                source_row_number: record.rowNumber,
                source_employee_code: record.employeeCode,
                raw_data: record.rawData as Prisma.InputJsonValue,
                validation_status:
                  record.validationStatus === 'error' ? 'error' : 'valid',
                validation_notes: record.validationNotes.join('; ') || null,
              },
              update: {
                attendance_type: attendanceType as Prisma.Enumattendance_typeFieldUpdateOperationsInput['set'],
                regular_hours: new Prisma.Decimal(regularHours),
                import_batch_id: importBatchId,
                source_row_number: record.rowNumber,
                raw_data: record.rawData as Prisma.InputJsonValue,
                validation_status:
                  record.validationStatus === 'error' ? 'error' : 'valid',
                validation_notes: record.validationNotes.join('; ') || null,
              },
            });
          } catch (error) {
            errors.push({
              row: record.rowNumber,
              column: dateStr,
              message: `Failed to save attendance: ${error.message}`,
            });
          }
        }

        if (record.validationStatus === 'warning') {
          warningRows++;
        } else if (record.validationStatus === 'valid') {
          successfulRows++;
        }
      }

      // Update import log
      await this.prisma.attendance_import_logs.update({
        where: { id: importLog.id },
        data: {
          status: errors.length > 0 ? 'completed' : 'completed',
          total_rows: parseResult.records.length,
          successful_rows: successfulRows,
          warning_rows: warningRows,
          error_rows: errors.length,
          import_summary: {
            periodInfo: parseResult.periodInfo,
            dateColumns: parseResult.dateColumns,
            employeesProcessed: parseResult.records.length,
          },
          error_details: errors.length > 0 ? errors : null,
          completed_at: new Date(),
        },
      });

      return {
        importLogId: importLog.id,
        summary: {
          totalRows: parseResult.records.length,
          successfulRows,
          warningRows,
          errorRows: errors.length,
        },
        periodInfo: parseResult.periodInfo,
        errors: errors.slice(0, 50), // Return first 50 errors
      };
    } catch (error) {
      // Update import log with error
      await this.prisma.attendance_import_logs.update({
        where: { id: importLog.id },
        data: {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date(),
        },
      });

      throw error;
    }
  }

  private convertToFullDate(
    dateStr: string,
    year: number,
    month: number,
  ): Date {
    // dateStr format: "01/12" (DD/MM)
    const parts = dateStr.split('/');
    if (parts.length === 2) {
      const day = parseInt(parts[0], 10);
      const monthFromDate = parseInt(parts[1], 10);
      return new Date(year, monthFromDate - 1, day);
    }
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  async getImportLogs(periodId: string) {
    return this.prisma.attendance_import_logs.findMany({
      where: { payroll_period_id: periodId },
      include: {
        user_profiles: {
          select: { id: true, full_name: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getImportLog(id: string) {
    const log = await this.prisma.attendance_import_logs.findUnique({
      where: { id },
      include: {
        user_profiles: {
          select: { id: true, full_name: true },
        },
      },
    });

    if (!log) {
      throw new NotFoundException(`Import log ${id} not found`);
    }

    return log;
  }

  async getRecords(query: AttendanceRecordQueryDto) {
    const where: Prisma.attendance_recordsWhereInput = {};

    if (query.payroll_period_id) {
      where.payroll_period_id = query.payroll_period_id;
    }
    if (query.employee_id) {
      where.employee_id = query.employee_id;
    }
    if (query.work_date) {
      where.work_date = new Date(query.work_date);
    }
    if (query.validation_status) {
      where.validation_status = query.validation_status;
    }

    return this.prisma.attendance_records.findMany({
      where,
      include: {
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            employee_code: true,
            role: true,
          },
        },
      },
      orderBy: [{ work_date: 'asc' }, { created_at: 'asc' }],
    });
  }

  async getEmployeeRecords(
    employeeId: string,
    periodId?: string,
  ) {
    const where: Prisma.attendance_recordsWhereInput = {
      employee_id: employeeId,
    };

    if (periodId) {
      where.payroll_period_id = periodId;
    }

    return this.prisma.attendance_records.findMany({
      where,
      include: {
        payroll_periods: {
          select: {
            id: true,
            period_code: true,
            period_name: true,
            period_year: true,
            period_month: true,
          },
        },
      },
      orderBy: { work_date: 'asc' },
    });
  }

  async createManual(dto: ManualAttendanceDto, userId: string) {
    // Verify period exists and is in draft
    const period = await this.prisma.payroll_periods.findUnique({
      where: { id: dto.payroll_period_id },
    });

    if (!period) {
      throw new NotFoundException(
        `Payroll period ${dto.payroll_period_id} not found`,
      );
    }

    if (period.status !== 'draft') {
      throw new BadRequestException(
        'Attendance can only be added when period is in draft status',
      );
    }

    // Verify employee exists
    const employee = await this.prisma.user_profiles.findUnique({
      where: { id: dto.employee_id },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employee_id} not found`);
    }

    return this.prisma.attendance_records.create({
      data: {
        payroll_period_id: dto.payroll_period_id,
        employee_id: dto.employee_id,
        work_date: new Date(dto.work_date),
        attendance_type: dto.attendance_type as Prisma.Enumattendance_typeFieldUpdateOperationsInput['set'],
        regular_hours: dto.regular_hours
          ? new Prisma.Decimal(dto.regular_hours)
          : new Prisma.Decimal(0),
        overtime_hours: dto.overtime_hours
          ? new Prisma.Decimal(dto.overtime_hours)
          : new Prisma.Decimal(0),
        notes: dto.notes,
        validation_status: 'valid',
      },
      include: {
        user_profiles: {
          select: { id: true, full_name: true, employee_code: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateAttendanceDto, userId: string) {
    const record = await this.prisma.attendance_records.findUnique({
      where: { id },
      include: { payroll_periods: true },
    });

    if (!record) {
      throw new NotFoundException(`Attendance record ${id} not found`);
    }

    if (record.payroll_periods.status !== 'draft') {
      throw new BadRequestException(
        'Attendance can only be modified when period is in draft status',
      );
    }

    const updateData: Prisma.attendance_recordsUpdateInput = {};

    if (dto.attendance_type !== undefined) {
      updateData.attendance_type = dto.attendance_type as Prisma.Enumattendance_typeFieldUpdateOperationsInput['set'];
    }
    if (dto.regular_hours !== undefined) {
      updateData.regular_hours = new Prisma.Decimal(dto.regular_hours);
    }
    if (dto.overtime_hours !== undefined) {
      updateData.overtime_hours = new Prisma.Decimal(dto.overtime_hours);
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    return this.prisma.attendance_records.update({
      where: { id },
      data: updateData,
      include: {
        user_profiles: {
          select: { id: true, full_name: true, employee_code: true },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    const record = await this.prisma.attendance_records.findUnique({
      where: { id },
      include: { payroll_periods: true },
    });

    if (!record) {
      throw new NotFoundException(`Attendance record ${id} not found`);
    }

    if (record.payroll_periods.status !== 'draft') {
      throw new BadRequestException(
        'Attendance can only be deleted when period is in draft status',
      );
    }

    await this.prisma.attendance_records.delete({
      where: { id },
    });

    return { message: 'Attendance record deleted successfully' };
  }

  async getAttendanceSummary(periodId: string, employeeId: string) {
    const records = await this.prisma.attendance_records.findMany({
      where: {
        payroll_period_id: periodId,
        employee_id: employeeId,
      },
    });

    const summary = {
      totalDays: records.length,
      regularDays: 0,
      checkInOnlyDays: 0,
      checkOutOnlyDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      absentDays: 0,
      totalRegularHours: 0,
      totalOvertimeHours: 0,
    };

    for (const record of records) {
      const regularHours = Number(record.regular_hours);
      const overtimeHours = Number(record.overtime_hours);

      summary.totalRegularHours += regularHours;
      summary.totalOvertimeHours += overtimeHours;

      switch (record.attendance_type) {
        case 'regular':
          summary.regularDays++;
          break;
        case 'check_in_only':
          summary.checkInOnlyDays++;
          break;
        case 'check_out_only':
          summary.checkOutOnlyDays++;
          break;
        case 'leave_paid':
          summary.paidLeaveDays++;
          break;
        case 'leave_unpaid':
          summary.unpaidLeaveDays++;
          break;
        case 'absent':
          summary.absentDays++;
          break;
      }
    }

    return summary;
  }
}
