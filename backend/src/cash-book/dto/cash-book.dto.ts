import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CASH_BOOK_METHODS } from '../cash-book-posting.service';

export const COUNTERPARTY_TYPES = [
  'customer',
  'supplier',
  'employee',
  'other',
] as const;

/** Manual receipt (phiếu thu) or payment (phiếu chi) voucher. */
export class CreateVoucherDto {
  @ApiProperty({ description: 'Cash book account' })
  @IsUUID()
  account_id: string;

  @ApiProperty({ minimum: 1 }) @IsNumber() @IsPositive() amount: number;

  @ApiProperty({
    description: 'Category id (must match the voucher direction)',
  })
  @IsUUID()
  category_id: string;

  @ApiPropertyOptional({ enum: COUNTERPARTY_TYPES })
  @IsOptional()
  @IsIn(COUNTERPARTY_TYPES)
  counterparty_type?: (typeof COUNTERPARTY_TYPES)[number];

  @ApiPropertyOptional() @IsOptional() @IsUUID() counterparty_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  counterparty_name?: string;

  @ApiPropertyOptional({
    description: 'Date and time of the voucher (ISO 8601); default now',
  })
  @IsOptional()
  @IsDateString()
  entry_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateTransferDto {
  @ApiProperty() @IsUUID() from_account_id: string;

  @ApiProperty() @IsUUID() to_account_id: string;

  @ApiProperty({ minimum: 1 }) @IsNumber() @IsPositive() amount: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString() entry_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateOpeningBalanceDto {
  @ApiProperty() @IsUUID() account_id: string;

  @ApiProperty({ minimum: 1 }) @IsNumber() @IsPositive() amount: number;

  @ApiProperty({
    description:
      'Opening date (YYYY-MM-DD, Vietnam time); balances count from the start of this day',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CancelEntryDto {
  @ApiProperty({ description: 'Why the entry is cancelled' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class CreateAccountDto {
  @ApiProperty() @IsUUID() store_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'code: A-Z, 0-9, _ or -' })
  code: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(150) name: string;

  @ApiProperty({ enum: ['cash', 'bank', 'ewallet'] })
  @IsIn(['cash', 'bank', 'ewallet'])
  type: 'cash' | 'bank' | 'ewallet';

  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_pos_drawer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  bank_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  account_number?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_active?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_pos_drawer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  bank_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  account_number?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class SetMethodAccountDto {
  @ApiProperty() @IsUUID() store_id: string;

  @ApiProperty({ enum: CASH_BOOK_METHODS })
  @IsIn(CASH_BOOK_METHODS)
  payment_method: (typeof CASH_BOOK_METHODS)[number];

  @ApiProperty() @IsUUID() account_id: string;
}

export class CreateCategoryDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) name: string;

  @ApiProperty({ enum: ['in', 'out'] }) @IsIn(['in', 'out']) direction:
    | 'in'
    | 'out';
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_active?: boolean;
}

export class EntryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() storeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() accountId?: string;

  @ApiPropertyOptional({ enum: ['in', 'out'] })
  @IsOptional()
  @IsIn(['in', 'out'])
  direction?: 'in' | 'out';

  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ enum: COUNTERPARTY_TYPES })
  @IsOptional()
  @IsIn(COUNTERPARTY_TYPES)
  counterpartyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  counterparty?: string;

  @ApiPropertyOptional({
    description:
      'sales_order_payment, service_payment, supplier_payment, payroll_slip, pos_session, manual',
  })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ enum: ['posted', 'cancelled'] })
  @IsOptional()
  @IsIn(['posted', 'cancelled'])
  status?: 'posted' | 'cancelled';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;

  @ApiPropertyOptional({ enum: ['json', 'xlsx', 'csv'] })
  @IsOptional()
  @IsIn(['json', 'xlsx', 'csv'])
  format?: 'json' | 'xlsx' | 'csv';

  @ApiPropertyOptional({ enum: ['vi', 'en'] })
  @IsOptional()
  @IsIn(['vi', 'en'])
  lang?: 'vi' | 'en';
}

export class BalanceQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() storeId?: string;

  @ApiPropertyOptional({
    description:
      'Balance at the end of this day (YYYY-MM-DD, Vietnam time); default now',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
