import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalaryConfigDto } from './dto/create-salary-config.dto';
import { UpdateSalaryConfigDto } from './dto/update-salary-config.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SalaryConfigService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.employee_salary_configs.findMany({
      include: {
        user_profiles_employee_salary_configs_employee_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
            employee_code: true,
            is_active: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findByEmployee(employeeId: string) {
    const config = await this.prisma.employee_salary_configs.findUnique({
      where: { employee_id: employeeId },
      include: {
        user_profiles_employee_salary_configs_employee_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
            employee_code: true,
            is_active: true,
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException(
        `Salary config for employee ${employeeId} not found`,
      );
    }

    return config;
  }

  async findOne(id: string) {
    const config = await this.prisma.employee_salary_configs.findUnique({
      where: { id },
      include: {
        user_profiles_employee_salary_configs_employee_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
            employee_code: true,
            is_active: true,
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException(`Salary config ${id} not found`);
    }

    return config;
  }

  async create(dto: CreateSalaryConfigDto, userId: string) {
    // Check if employee exists
    const employee = await this.prisma.user_profiles.findUnique({
      where: { id: dto.employee_id },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employee_id} not found`);
    }

    // Check if config already exists for this employee
    const existing = await this.prisma.employee_salary_configs.findUnique({
      where: { employee_id: dto.employee_id },
    });

    if (existing) {
      throw new ConflictException(
        `Salary config already exists for employee ${dto.employee_id}`,
      );
    }

    return this.prisma.employee_salary_configs.create({
      data: {
        employee_id: dto.employee_id,
        salary_type: dto.salary_type,
        base_salary: new Prisma.Decimal(dto.base_salary),
        standard_work_days_per_month: dto.standard_work_days_per_month,
        standard_hours_per_day: dto.standard_hours_per_day
          ? new Prisma.Decimal(dto.standard_hours_per_day)
          : undefined,
        overtime_rate_weekday: dto.overtime_rate_weekday
          ? new Prisma.Decimal(dto.overtime_rate_weekday)
          : undefined,
        overtime_rate_weekend: dto.overtime_rate_weekend
          ? new Prisma.Decimal(dto.overtime_rate_weekend)
          : undefined,
        overtime_rate_holiday: dto.overtime_rate_holiday
          ? new Prisma.Decimal(dto.overtime_rate_holiday)
          : undefined,
        lunch_allowance: dto.lunch_allowance
          ? new Prisma.Decimal(dto.lunch_allowance)
          : undefined,
        transport_allowance: dto.transport_allowance
          ? new Prisma.Decimal(dto.transport_allowance)
          : undefined,
        phone_allowance: dto.phone_allowance
          ? new Prisma.Decimal(dto.phone_allowance)
          : undefined,
        other_allowances: dto.other_allowances || {},
        social_insurance_rate: dto.social_insurance_rate
          ? new Prisma.Decimal(dto.social_insurance_rate)
          : undefined,
        health_insurance_rate: dto.health_insurance_rate
          ? new Prisma.Decimal(dto.health_insurance_rate)
          : undefined,
        unemployment_insurance_rate: dto.unemployment_insurance_rate
          ? new Prisma.Decimal(dto.unemployment_insurance_rate)
          : undefined,
        effective_from: dto.effective_from
          ? new Date(dto.effective_from)
          : new Date(),
        effective_to: dto.effective_to ? new Date(dto.effective_to) : null,
        notes: dto.notes,
        created_by_id: userId,
      },
      include: {
        user_profiles_employee_salary_configs_employee_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
            employee_code: true,
            is_active: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateSalaryConfigDto, userId: string) {
    await this.findOne(id);

    const updateData: Prisma.employee_salary_configsUpdateInput = {
      user_profiles_employee_salary_configs_updated_by_idTouser_profiles: {
        connect: { id: userId },
      },
    };

    if (dto.salary_type !== undefined) {
      updateData.salary_type = dto.salary_type;
    }
    if (dto.base_salary !== undefined) {
      updateData.base_salary = new Prisma.Decimal(dto.base_salary);
    }
    if (dto.standard_work_days_per_month !== undefined) {
      updateData.standard_work_days_per_month = dto.standard_work_days_per_month;
    }
    if (dto.standard_hours_per_day !== undefined) {
      updateData.standard_hours_per_day = new Prisma.Decimal(
        dto.standard_hours_per_day,
      );
    }
    if (dto.overtime_rate_weekday !== undefined) {
      updateData.overtime_rate_weekday = new Prisma.Decimal(
        dto.overtime_rate_weekday,
      );
    }
    if (dto.overtime_rate_weekend !== undefined) {
      updateData.overtime_rate_weekend = new Prisma.Decimal(
        dto.overtime_rate_weekend,
      );
    }
    if (dto.overtime_rate_holiday !== undefined) {
      updateData.overtime_rate_holiday = new Prisma.Decimal(
        dto.overtime_rate_holiday,
      );
    }
    if (dto.lunch_allowance !== undefined) {
      updateData.lunch_allowance = new Prisma.Decimal(dto.lunch_allowance);
    }
    if (dto.transport_allowance !== undefined) {
      updateData.transport_allowance = new Prisma.Decimal(
        dto.transport_allowance,
      );
    }
    if (dto.phone_allowance !== undefined) {
      updateData.phone_allowance = new Prisma.Decimal(dto.phone_allowance);
    }
    if (dto.other_allowances !== undefined) {
      updateData.other_allowances = dto.other_allowances;
    }
    if (dto.social_insurance_rate !== undefined) {
      updateData.social_insurance_rate = new Prisma.Decimal(
        dto.social_insurance_rate,
      );
    }
    if (dto.health_insurance_rate !== undefined) {
      updateData.health_insurance_rate = new Prisma.Decimal(
        dto.health_insurance_rate,
      );
    }
    if (dto.unemployment_insurance_rate !== undefined) {
      updateData.unemployment_insurance_rate = new Prisma.Decimal(
        dto.unemployment_insurance_rate,
      );
    }
    if (dto.effective_from !== undefined) {
      updateData.effective_from = new Date(dto.effective_from);
    }
    if (dto.effective_to !== undefined) {
      updateData.effective_to = dto.effective_to
        ? new Date(dto.effective_to)
        : null;
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    return this.prisma.employee_salary_configs.update({
      where: { id },
      data: updateData,
      include: {
        user_profiles_employee_salary_configs_employee_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
            employee_code: true,
            is_active: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.employee_salary_configs.delete({
      where: { id },
    });

    return { message: 'Salary config deleted successfully' };
  }

  async getEmployeesWithoutConfig() {
    // Get all employees who don't have a salary config yet
    const employeesWithConfig = await this.prisma.employee_salary_configs.findMany({
      select: { employee_id: true },
    });

    const employeeIds = employeesWithConfig.map((e) => e.employee_id);

    return this.prisma.user_profiles.findMany({
      where: {
        id: { notIn: employeeIds },
        is_active: true,
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        employee_code: true,
      },
      orderBy: { full_name: 'asc' },
    });
  }
}
