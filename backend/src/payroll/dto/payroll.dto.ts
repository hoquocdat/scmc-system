import {
  IsUUID,
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

// Payroll Period DTOs
export class CreatePayrollPeriodDto {
  @ApiProperty({ description: 'Period year', example: 2026 })
  @IsNumber()
  @Min(2020)
  @Max(2100)
  period_year: number;

  @ApiProperty({ description: 'Period month (1-12)', example: 1 })
  @IsNumber()
  @Min(1)
  @Max(12)
  period_month: number;

  @ApiPropertyOptional({
    description: 'Period name (auto-generated if not provided)',
  })
  @IsOptional()
  @IsString()
  period_name?: string;

  @ApiPropertyOptional({ description: 'Confirmation deadline' })
  @IsOptional()
  @IsDateString()
  confirmation_deadline?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayrollPeriodDto {
  @ApiPropertyOptional({ description: 'Period name' })
  @IsOptional()
  @IsString()
  period_name?: string;

  @ApiPropertyOptional({ description: 'Confirmation deadline' })
  @IsOptional()
  @IsDateString()
  confirmation_deadline?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  internal_notes?: string;
}

export class PayrollPeriodQueryDto {
  @ApiPropertyOptional({ description: 'Filter by year' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['draft', 'published', 'finalized', 'paid'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  limit?: number;
}

// Payroll Slip DTOs
export class AdjustPayrollSlipDto {
  @ApiProperty({
    description: 'Adjustment type',
    enum: ['bonus', 'deduction', 'correction', 'allowance'],
  })
  @IsString()
  @IsIn(['bonus', 'deduction', 'correction', 'allowance'])
  adjustment_type: string;

  @ApiProperty({ description: 'Adjustment amount (positive or negative)' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Reason for adjustment' })
  @IsString()
  reason: string;
}

export class ConfirmPayrollDto {
  @ApiPropertyOptional({ description: 'Comment' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class DisputePayrollDto {
  @ApiProperty({ description: 'Reason for dispute' })
  @IsString()
  reason: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ description: 'Resolution details' })
  @IsString()
  resolution: string;

  @ApiPropertyOptional({
    description: 'Adjustment amount if any (positive or negative)',
  })
  @IsOptional()
  @IsNumber()
  adjustment_amount?: number;
}

export class FinalizePeriodDto {
  @ApiPropertyOptional({
    description: 'Reason for override (required if not all employees confirmed)',
  })
  @IsOptional()
  @IsString()
  override_reason?: string;
}

export class MarkPaidDto {
  @ApiProperty({ description: 'Payment method' })
  @IsString()
  payment_method: string;

  @ApiPropertyOptional({ description: 'Payment reference (e.g., bank transfer ID)' })
  @IsOptional()
  @IsString()
  payment_reference?: string;
}

export class MyPayrollQueryDto {
  @ApiPropertyOptional({ description: 'Filter by year' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;
}
