import {
  IsUUID,
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSalaryConfigDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsUUID()
  employee_id: string;

  @ApiProperty({
    description: 'Salary type',
    enum: ['monthly', 'daily', 'hourly'],
    default: 'monthly',
  })
  @IsString()
  @IsIn(['monthly', 'daily', 'hourly'])
  salary_type: string;

  @ApiProperty({ description: 'Base salary amount (VND)' })
  @IsNumber()
  @Min(0)
  base_salary: number;

  @ApiPropertyOptional({ description: 'Standard work days per month', default: 26 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  standard_work_days_per_month?: number;

  @ApiPropertyOptional({ description: 'Standard hours per day', default: 8 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  standard_hours_per_day?: number;

  @ApiPropertyOptional({ description: 'Overtime rate for weekdays (multiplier)', default: 1.5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  overtime_rate_weekday?: number;

  @ApiPropertyOptional({ description: 'Overtime rate for weekends (multiplier)', default: 2.0 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  overtime_rate_weekend?: number;

  @ApiPropertyOptional({ description: 'Overtime rate for holidays (multiplier)', default: 3.0 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  overtime_rate_holiday?: number;

  @ApiPropertyOptional({ description: 'Lunch allowance (VND)', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lunch_allowance?: number;

  @ApiPropertyOptional({ description: 'Transport allowance (VND)', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transport_allowance?: number;

  @ApiPropertyOptional({ description: 'Phone allowance (VND)', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  phone_allowance?: number;

  @ApiPropertyOptional({ description: 'Other allowances (JSON object)' })
  @IsOptional()
  @IsObject()
  other_allowances?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Social insurance rate (decimal)', default: 0.08 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  social_insurance_rate?: number;

  @ApiPropertyOptional({ description: 'Health insurance rate (decimal)', default: 0.015 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  health_insurance_rate?: number;

  @ApiPropertyOptional({ description: 'Unemployment insurance rate (decimal)', default: 0.01 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  unemployment_insurance_rate?: number;

  @ApiPropertyOptional({ description: 'Effective from date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effective_from?: string;

  @ApiPropertyOptional({ description: 'Effective to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effective_to?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
