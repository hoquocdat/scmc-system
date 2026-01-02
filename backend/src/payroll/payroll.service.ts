import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import {
  CreatePayrollPeriodDto,
  UpdatePayrollPeriodDto,
  PayrollPeriodQueryDto,
  AdjustPayrollSlipDto,
  ConfirmPayrollDto,
  DisputePayrollDto,
  ResolveDisputeDto,
  FinalizePeriodDto,
  MarkPaidDto,
  MyPayrollQueryDto,
} from './dto/payroll.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
  ) {}

  // ========== PAYROLL PERIODS ==========

  async createPeriod(dto: CreatePayrollPeriodDto, userId: string) {
    // Check if period already exists
    const existing = await this.prisma.payroll_periods.findFirst({
      where: {
        period_year: dto.period_year,
        period_month: dto.period_month,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Payroll period for ${dto.period_month}/${dto.period_year} already exists`,
      );
    }

    // Calculate period dates
    const startDate = new Date(dto.period_year, dto.period_month - 1, 1);
    const endDate = new Date(dto.period_year, dto.period_month, 0); // Last day of month

    // Generate period code and name
    const periodCode = `PP${dto.period_year}-${String(dto.period_month).padStart(2, '0')}`;
    const periodName =
      dto.period_name || `Lương Tháng ${dto.period_month}/${dto.period_year}`;

    return this.prisma.payroll_periods.create({
      data: {
        period_code: periodCode,
        period_name: periodName,
        period_year: dto.period_year,
        period_month: dto.period_month,
        period_start_date: startDate,
        period_end_date: endDate,
        confirmation_deadline: dto.confirmation_deadline
          ? new Date(dto.confirmation_deadline)
          : null,
        status: 'draft',
        notes: dto.notes,
        created_by_id: userId,
      },
    });
  }

  async getPeriods(query: PayrollPeriodQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const where: Prisma.payroll_periodsWhereInput = {};
    if (query.year) {
      where.period_year = query.year;
    }
    if (query.status) {
      where.status = query.status as Prisma.Enumpayroll_period_statusFilter['equals'];
    }

    const [data, count] = await Promise.all([
      this.prisma.payroll_periods.findMany({
        where,
        orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payroll_periods.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getPeriod(id: string) {
    const period = await this.prisma.payroll_periods.findUnique({
      where: { id },
      include: {
        user_profiles_payroll_periods_created_by_idTouser_profiles: {
          select: { id: true, full_name: true },
        },
        user_profiles_payroll_periods_published_byTouser_profiles: {
          select: { id: true, full_name: true },
        },
        user_profiles_payroll_periods_finalized_byTouser_profiles: {
          select: { id: true, full_name: true },
        },
        user_profiles_payroll_periods_paid_byTouser_profiles: {
          select: { id: true, full_name: true },
        },
      },
    });

    if (!period) {
      throw new NotFoundException(`Payroll period ${id} not found`);
    }

    return period;
  }

  async updatePeriod(id: string, dto: UpdatePayrollPeriodDto, userId: string) {
    await this.getPeriod(id);

    return this.prisma.payroll_periods.update({
      where: { id },
      data: {
        period_name: dto.period_name,
        confirmation_deadline: dto.confirmation_deadline
          ? new Date(dto.confirmation_deadline)
          : undefined,
        notes: dto.notes,
        internal_notes: dto.internal_notes,
        updated_by_id: userId,
      },
    });
  }

  // ========== PAYROLL GENERATION ==========

  async generatePayroll(periodId: string, userId: string) {
    const period = await this.getPeriod(periodId);

    if (period.status !== 'draft') {
      throw new BadRequestException(
        'Payroll can only be generated for draft periods',
      );
    }

    // Get all active employees with salary configs
    const salaryConfigs = await this.prisma.employee_salary_configs.findMany({
      include: {
        user_profiles_employee_salary_configs_employee_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            employee_code: true,
            is_active: true,
          },
        },
      },
    });

    const generatedSlips: string[] = [];
    const errors: Array<{ employeeId: string; error: string }> = [];

    for (const config of salaryConfigs) {
      const employee =
        config.user_profiles_employee_salary_configs_employee_idTouser_profiles;

      if (!employee.is_active) {
        continue;
      }

      try {
        // Get attendance summary
        const attendance = await this.attendanceService.getAttendanceSummary(
          periodId,
          employee.id,
        );

        // Calculate payroll
        const calculation = this.calculatePayroll(config, attendance);

        // Create or update payroll slip
        const slip = await this.prisma.payroll_slips.upsert({
          where: {
            payroll_period_id_employee_id: {
              payroll_period_id: periodId,
              employee_id: employee.id,
            },
          },
          create: {
            payroll_period_id: periodId,
            employee_id: employee.id,
            salary_config_id: config.id,
            status: 'draft',
            ...calculation,
            calculated_at: new Date(),
          },
          update: {
            salary_config_id: config.id,
            status: 'draft',
            ...calculation,
            calculated_at: new Date(),
          },
        });

        generatedSlips.push(slip.id);
      } catch (error) {
        errors.push({
          employeeId: employee.id,
          error: error.message,
        });
      }
    }

    return {
      periodId,
      generatedSlips: generatedSlips.length,
      errors,
    };
  }

  private calculatePayroll(
    config: Prisma.employee_salary_configsGetPayload<object>,
    attendance: {
      totalDays: number;
      regularDays: number;
      checkInOnlyDays: number;
      checkOutOnlyDays: number;
      paidLeaveDays: number;
      unpaidLeaveDays: number;
      absentDays: number;
      totalRegularHours: number;
      totalOvertimeHours: number;
    },
  ) {
    const baseSalary = Number(config.base_salary);
    const standardWorkDays = config.standard_work_days_per_month || 26;
    const standardHoursPerDay = Number(config.standard_hours_per_day) || 8;

    // Calculate work days (full + half days)
    const totalWorkDays =
      attendance.regularDays +
      attendance.paidLeaveDays +
      (attendance.checkInOnlyDays + attendance.checkOutOnlyDays) * 0.5;

    const totalLeaveDays = attendance.paidLeaveDays + attendance.unpaidLeaveDays;
    const totalAbsentDays = attendance.absentDays + attendance.unpaidLeaveDays;

    // Calculate earnings
    let baseSalaryAmount = 0;
    let attendanceEarnings = 0;

    if (config.salary_type === 'monthly') {
      // Prorate monthly salary based on attendance
      const prorationRate = Math.min(totalWorkDays / standardWorkDays, 1);
      baseSalaryAmount = baseSalary * prorationRate;
      attendanceEarnings = baseSalaryAmount;
    } else if (config.salary_type === 'daily') {
      baseSalaryAmount = baseSalary * totalWorkDays;
      attendanceEarnings = baseSalaryAmount;
    } else if (config.salary_type === 'hourly') {
      baseSalaryAmount = baseSalary * attendance.totalRegularHours;
      attendanceEarnings = baseSalaryAmount;
    }

    // Calculate overtime
    const hourlyRate = baseSalary / standardWorkDays / standardHoursPerDay;
    const overtimeRate = Number(config.overtime_rate_weekday) || 1.5;
    const overtimeEarnings =
      attendance.totalOvertimeHours * hourlyRate * overtimeRate;

    // Calculate allowances
    const lunchAllowance = Number(config.lunch_allowance) || 0;
    const transportAllowance = Number(config.transport_allowance) || 0;
    const phoneAllowance = Number(config.phone_allowance) || 0;
    const allowancesAmount = lunchAllowance + transportAllowance + phoneAllowance;

    // Calculate gross pay
    const grossPay = baseSalaryAmount + overtimeEarnings + allowancesAmount;

    // Calculate deductions
    const socialInsuranceRate = Number(config.social_insurance_rate) || 0.08;
    const healthInsuranceRate = Number(config.health_insurance_rate) || 0.015;
    const unemploymentInsuranceRate =
      Number(config.unemployment_insurance_rate) || 0.01;

    const socialInsuranceDeduction = baseSalary * socialInsuranceRate;
    const healthInsuranceDeduction = baseSalary * healthInsuranceRate;
    const unemploymentInsuranceDeduction = baseSalary * unemploymentInsuranceRate;

    // Absence deduction (for unpaid leave)
    const absenceDeduction =
      config.salary_type === 'monthly'
        ? (baseSalary / standardWorkDays) * attendance.unpaidLeaveDays
        : 0;

    const totalDeductions =
      socialInsuranceDeduction +
      healthInsuranceDeduction +
      unemploymentInsuranceDeduction +
      absenceDeduction;

    // Calculate net pay
    const netPay = grossPay - totalDeductions;

    return {
      // Attendance
      total_work_days: new Prisma.Decimal(totalWorkDays),
      total_regular_hours: new Prisma.Decimal(attendance.totalRegularHours),
      total_overtime_hours: new Prisma.Decimal(attendance.totalOvertimeHours),
      total_leave_days: new Prisma.Decimal(totalLeaveDays),
      total_absent_days: new Prisma.Decimal(totalAbsentDays),
      total_late_minutes: 0,

      // Earnings
      base_salary_amount: new Prisma.Decimal(baseSalaryAmount),
      attendance_earnings: new Prisma.Decimal(attendanceEarnings),
      overtime_earnings: new Prisma.Decimal(overtimeEarnings),
      bonus_amount: new Prisma.Decimal(0),
      allowances_amount: new Prisma.Decimal(allowancesAmount),
      other_earnings: new Prisma.Decimal(0),
      gross_pay: new Prisma.Decimal(grossPay),

      // Deductions
      social_insurance_deduction: new Prisma.Decimal(socialInsuranceDeduction),
      health_insurance_deduction: new Prisma.Decimal(healthInsuranceDeduction),
      unemployment_insurance_deduction: new Prisma.Decimal(
        unemploymentInsuranceDeduction,
      ),
      tax_deduction: new Prisma.Decimal(0),
      advance_deduction: new Prisma.Decimal(0),
      absence_deduction: new Prisma.Decimal(absenceDeduction),
      late_deduction: new Prisma.Decimal(0),
      other_deductions: new Prisma.Decimal(0),
      total_deductions: new Prisma.Decimal(totalDeductions),

      // Net
      net_pay: new Prisma.Decimal(netPay),

      // Details
      earnings_details: {
        lunch_allowance: lunchAllowance,
        transport_allowance: transportAllowance,
        phone_allowance: phoneAllowance,
      },
      deductions_details: {
        social_insurance_rate: socialInsuranceRate,
        health_insurance_rate: healthInsuranceRate,
        unemployment_insurance_rate: unemploymentInsuranceRate,
      },
      allowances_details: config.other_allowances || {},
    };
  }

  // ========== PAYROLL SLIPS ==========

  async getSlipsForPeriod(periodId: string) {
    await this.getPeriod(periodId);

    return this.prisma.payroll_slips.findMany({
      where: { payroll_period_id: periodId },
      include: {
        user_profiles_payroll_slips_employee_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            employee_code: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        user_profiles_payroll_slips_employee_idTouser_profiles: { full_name: 'asc' },
      },
    });
  }

  async getSlip(id: string, userId?: string, isAdmin: boolean = false) {
    const slip = await this.prisma.payroll_slips.findUnique({
      where: { id },
      include: {
        user_profiles_payroll_slips_employee_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            employee_code: true,
            email: true,
            role: true,
          },
        },
        payroll_periods: true,
        employee_salary_configs: true,
        payroll_adjustments: {
          include: {
            user_profiles: {
              select: { id: true, full_name: true },
            },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!slip) {
      throw new NotFoundException(`Payroll slip ${id} not found`);
    }

    // Check permission - employees can only view their own
    if (!isAdmin && userId && slip.employee_id !== userId) {
      throw new ForbiddenException('You can only view your own payroll slip');
    }

    return slip;
  }

  async adjustSlip(id: string, dto: AdjustPayrollSlipDto, userId: string) {
    const slip = await this.getSlip(id, undefined, true);

    if (slip.payroll_periods.status === 'paid') {
      throw new BadRequestException('Cannot adjust a paid payroll slip');
    }

    const previousNetPay = Number(slip.net_pay);
    const adjustmentAmount =
      dto.adjustment_type === 'deduction' ? -Math.abs(dto.amount) : dto.amount;
    const newNetPay = previousNetPay + adjustmentAmount;

    // Create adjustment log
    await this.prisma.payroll_adjustments.create({
      data: {
        payroll_slip_id: id,
        adjustment_type: dto.adjustment_type,
        amount: new Prisma.Decimal(dto.amount),
        reason: dto.reason,
        previous_net_pay: new Prisma.Decimal(previousNetPay),
        new_net_pay: new Prisma.Decimal(newNetPay),
        adjusted_by: userId,
      },
    });

    // Update slip
    const currentAdjustment = Number(slip.adjustment_amount) || 0;
    const totalAdjustment = currentAdjustment + adjustmentAmount;

    return this.prisma.payroll_slips.update({
      where: { id },
      data: {
        adjustment_amount: new Prisma.Decimal(totalAdjustment),
        adjustment_reason:
          (slip.adjustment_reason ? slip.adjustment_reason + '; ' : '') +
          dto.reason,
        adjusted_by: userId,
        adjusted_at: new Date(),
        net_pay: new Prisma.Decimal(newNetPay),
      },
      include: {
        user_profiles_payroll_slips_employee_idTouser_profiles: {
          select: { id: true, full_name: true, employee_code: true },
        },
      },
    });
  }

  // ========== WORKFLOW ACTIONS ==========

  async publishPeriod(id: string, userId: string) {
    const period = await this.getPeriod(id);

    if (period.status !== 'draft') {
      throw new BadRequestException('Only draft periods can be published');
    }

    // Check if there are payroll slips
    const slipCount = await this.prisma.payroll_slips.count({
      where: { payroll_period_id: id },
    });

    if (slipCount === 0) {
      throw new BadRequestException(
        'Cannot publish period without payroll slips. Generate payroll first.',
      );
    }

    // Update period status
    await this.prisma.payroll_periods.update({
      where: { id },
      data: {
        status: 'published',
        published_at: new Date(),
        published_by: userId,
      },
    });

    // Update all slips to published
    await this.prisma.payroll_slips.updateMany({
      where: { payroll_period_id: id, status: 'draft' },
      data: { status: 'published' },
    });

    return this.getPeriod(id);
  }

  async finalizePeriod(id: string, dto: FinalizePeriodDto, userId: string) {
    const period = await this.getPeriod(id);

    if (period.status !== 'published') {
      throw new BadRequestException('Only published periods can be finalized');
    }

    // Check if all slips are confirmed
    const [confirmedCount, totalCount, disputedCount] = await Promise.all([
      this.prisma.payroll_slips.count({
        where: {
          payroll_period_id: id,
          status: { in: ['confirmed', 'finalized'] },
        },
      }),
      this.prisma.payroll_slips.count({
        where: { payroll_period_id: id },
      }),
      this.prisma.payroll_slips.count({
        where: { payroll_period_id: id, status: 'disputed' },
      }),
    ]);

    if (disputedCount > 0) {
      throw new BadRequestException(
        `Cannot finalize: ${disputedCount} slips are still disputed`,
      );
    }

    if (confirmedCount < totalCount && !dto.override_reason) {
      throw new BadRequestException(
        `Not all employees have confirmed. ${confirmedCount}/${totalCount} confirmed. Provide override_reason to proceed.`,
      );
    }

    // Update period status
    await this.prisma.payroll_periods.update({
      where: { id },
      data: {
        status: 'finalized',
        finalized_at: new Date(),
        finalized_by: userId,
        finalize_reason: dto.override_reason,
      },
    });

    // Update all slips to finalized
    await this.prisma.payroll_slips.updateMany({
      where: {
        payroll_period_id: id,
        status: { in: ['published', 'confirmed'] },
      },
      data: { status: 'finalized', finalized_at: new Date(), finalized_by: userId },
    });

    return this.getPeriod(id);
  }

  async markPaid(id: string, dto: MarkPaidDto, userId: string) {
    const period = await this.getPeriod(id);

    if (period.status !== 'finalized') {
      throw new BadRequestException('Only finalized periods can be marked as paid');
    }

    // Update period status
    await this.prisma.payroll_periods.update({
      where: { id },
      data: {
        status: 'paid',
        paid_at: new Date(),
        paid_by: userId,
        payment_method: dto.payment_method,
        payment_reference: dto.payment_reference,
      },
    });

    // Update all slips to paid
    await this.prisma.payroll_slips.updateMany({
      where: { payroll_period_id: id, status: 'finalized' },
      data: { status: 'paid', paid_at: new Date(), paid_by: userId },
    });

    return this.getPeriod(id);
  }

  // ========== EMPLOYEE SELF-SERVICE ==========

  async getMyPayroll(userId: string, query: MyPayrollQueryDto) {
    const where: Prisma.payroll_slipsWhereInput = {
      employee_id: userId,
      payroll_periods: {
        status: { not: 'draft' }, // Only show published and later
      },
    };

    if (query.year) {
      where.payroll_periods = {
        ...where.payroll_periods as object,
        period_year: query.year,
      };
    }

    if (query.status) {
      where.status = query.status as Prisma.Enumpayroll_slip_statusFilter['equals'];
    }

    return this.prisma.payroll_slips.findMany({
      where,
      include: {
        payroll_periods: {
          select: {
            id: true,
            period_code: true,
            period_name: true,
            period_year: true,
            period_month: true,
            confirmation_deadline: true,
          },
        },
      },
      orderBy: {
        payroll_periods: { period_year: 'desc' },
      },
    });
  }

  async confirmSlip(id: string, dto: ConfirmPayrollDto, userId: string) {
    const slip = await this.getSlip(id, userId, false);

    if (slip.status !== 'published') {
      throw new BadRequestException('Only published slips can be confirmed');
    }

    // Check if late confirmation
    const isLate =
      slip.payroll_periods.confirmation_deadline &&
      new Date() > slip.payroll_periods.confirmation_deadline;

    return this.prisma.payroll_slips.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmed_at: new Date(),
        confirmation_comment: dto.comment,
        is_late_confirmation: isLate,
      },
      include: {
        payroll_periods: true,
      },
    });
  }

  async disputeSlip(id: string, dto: DisputePayrollDto, userId: string) {
    const slip = await this.getSlip(id, userId, false);

    if (slip.status !== 'published') {
      throw new BadRequestException('Only published slips can be disputed');
    }

    return this.prisma.payroll_slips.update({
      where: { id },
      data: {
        status: 'disputed',
        disputed_at: new Date(),
        dispute_reason: dto.reason,
      },
      include: {
        payroll_periods: true,
      },
    });
  }

  async resolveDispute(id: string, dto: ResolveDisputeDto, userId: string) {
    const slip = await this.getSlip(id, undefined, true);

    if (slip.status !== 'disputed') {
      throw new BadRequestException('Only disputed slips can be resolved');
    }

    const updateData: Prisma.payroll_slipsUpdateInput = {
      status: 'published',
      dispute_resolved_at: new Date(),
      dispute_resolution: dto.resolution,
      user_profiles_payroll_slips_dispute_resolved_byTouser_profiles: {
        connect: { id: userId },
      },
    };

    // Apply adjustment if provided
    if (dto.adjustment_amount) {
      const previousNetPay = Number(slip.net_pay);
      const newNetPay = previousNetPay + dto.adjustment_amount;

      updateData.adjustment_amount = new Prisma.Decimal(
        (Number(slip.adjustment_amount) || 0) + dto.adjustment_amount,
      );
      updateData.adjustment_reason =
        (slip.adjustment_reason ? slip.adjustment_reason + '; ' : '') +
        `Dispute resolution: ${dto.resolution}`;
      updateData.net_pay = new Prisma.Decimal(newNetPay);

      // Create adjustment log
      await this.prisma.payroll_adjustments.create({
        data: {
          payroll_slip_id: id,
          adjustment_type: 'correction',
          amount: new Prisma.Decimal(dto.adjustment_amount),
          reason: `Dispute resolution: ${dto.resolution}`,
          previous_net_pay: new Prisma.Decimal(previousNetPay),
          new_net_pay: new Prisma.Decimal(newNetPay),
          adjusted_by: userId,
        },
      });
    }

    return this.prisma.payroll_slips.update({
      where: { id },
      data: updateData,
      include: {
        user_profiles_payroll_slips_employee_idTouser_profiles: {
          select: { id: true, full_name: true, employee_code: true },
        },
        payroll_periods: true,
      },
    });
  }
}
