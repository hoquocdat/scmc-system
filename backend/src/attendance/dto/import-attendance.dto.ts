import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportAttendanceDto {
  @ApiProperty({ description: 'Payroll period ID to import attendance for' })
  @IsUUID()
  payroll_period_id: string;

  @ApiPropertyOptional({
    description: 'Whether to clear existing attendance before import',
    default: true,
  })
  @IsOptional()
  clear_existing?: boolean;
}

export class AttendanceRecordQueryDto {
  @ApiPropertyOptional({ description: 'Filter by payroll period ID' })
  @IsOptional()
  @IsUUID()
  payroll_period_id?: string;

  @ApiPropertyOptional({ description: 'Filter by employee ID' })
  @IsOptional()
  @IsUUID()
  employee_id?: string;

  @ApiPropertyOptional({ description: 'Filter by date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  work_date?: string;

  @ApiPropertyOptional({ description: 'Filter by validation status' })
  @IsOptional()
  @IsString()
  validation_status?: string;
}

export class ManualAttendanceDto {
  @ApiProperty({ description: 'Payroll period ID' })
  @IsUUID()
  payroll_period_id: string;

  @ApiProperty({ description: 'Employee ID' })
  @IsUUID()
  employee_id: string;

  @ApiProperty({ description: 'Work date (YYYY-MM-DD)' })
  @IsString()
  work_date: string;

  @ApiProperty({
    description: 'Attendance type',
    enum: [
      'regular',
      'check_in_only',
      'check_out_only',
      'leave_paid',
      'leave_unpaid',
      'holiday',
      'absent',
      'day_off',
    ],
  })
  @IsString()
  attendance_type: string;

  @ApiPropertyOptional({ description: 'Regular hours worked' })
  @IsOptional()
  regular_hours?: number;

  @ApiPropertyOptional({ description: 'Overtime hours' })
  @IsOptional()
  overtime_hours?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAttendanceDto {
  @ApiPropertyOptional({
    description: 'Attendance type',
    enum: [
      'regular',
      'check_in_only',
      'check_out_only',
      'leave_paid',
      'leave_unpaid',
      'holiday',
      'absent',
      'day_off',
    ],
  })
  @IsOptional()
  @IsString()
  attendance_type?: string;

  @ApiPropertyOptional({ description: 'Regular hours worked' })
  @IsOptional()
  regular_hours?: number;

  @ApiPropertyOptional({ description: 'Overtime hours' })
  @IsOptional()
  overtime_hours?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
