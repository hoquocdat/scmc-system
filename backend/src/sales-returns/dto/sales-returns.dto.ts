import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const RETURN_REASONS = [
  'changed_mind',
  'wrong_size',
  'defective',
  'wrong_item',
  'other',
] as const;

export const REFUND_METHODS = [
  'cash',
  'card',
  'bank_transfer',
  'ewallet_momo',
  'ewallet_zalopay',
  'ewallet_vnpay',
  'store_credit',
] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];

@ApiSchema({ name: 'SalesReturnItemDto' })
export class ReturnItemDto {
  @ApiProperty() @IsUUID() sales_order_item_id: string;

  @ApiProperty() @IsInt() @Min(1) quantity: number;

  @ApiPropertyOptional({
    description: 'false = damaged, not back in stock',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  restock?: boolean;

  @ApiPropertyOptional({
    description: "Stock location; default the order's location",
  })
  @IsOptional()
  @IsUUID()
  location_id?: string;

  @ApiPropertyOptional({ enum: RETURN_REASONS })
  @IsOptional()
  @IsIn(RETURN_REASONS)
  reason_code?: (typeof RETURN_REASONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason_note?: string;
}

export class RefundLineDto {
  @ApiProperty({ enum: REFUND_METHODS })
  @IsIn(REFUND_METHODS)
  method: RefundMethod;

  @ApiProperty() @IsNumber() @Min(1) amount: number;

  @ApiPropertyOptional({
    description: 'Cash book account; default the branch mapping',
  })
  @IsOptional()
  @IsUUID()
  cash_account_id?: string;
}

export class ExchangeLineDto {
  @ApiProperty() @IsUUID() product_id: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() product_variant_id?: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10_000) quantity: number;

  @ApiPropertyOptional({
    description:
      'Price the screen showed; refused with PRICE_CHANGED when different',
  })
  @IsOptional()
  @IsNumber()
  expected_unit_price?: number;
}

export class ExchangePaymentDto {
  @ApiProperty({ enum: REFUND_METHODS })
  @IsIn(REFUND_METHODS)
  method: RefundMethod;
  @ApiProperty() @IsNumber() @Min(1) amount: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() amount_tendered?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
}

export class ExchangeDto {
  @ApiProperty({ type: [ExchangeLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ExchangeLineDto)
  lines: ExchangeLineDto[];

  @ApiPropertyOptional({
    type: [ExchangePaymentDto],
    description: 'What the customer pays on top of the returned value',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExchangePaymentDto)
  payments?: ExchangePaymentDto[];
}

export class ReturnRequestDto {
  @ApiProperty() @IsUUID() sales_order_id: string;

  @ApiProperty({ type: [ReturnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @ApiPropertyOptional({
    type: [RefundLineDto],
    description: 'Must add up to the refund due',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundLineDto)
  refunds?: RefundLineDto[];

  @ApiPropertyOptional({ type: ExchangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExchangeDto)
  exchange?: ExchangeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class LookupQueryDto {
  @ApiProperty({ description: 'Order number or id' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ReturnListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() storeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional({
    description: 'Returns of one order (ignores the period)',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: ['return', 'exchange'] })
  @IsOptional()
  @IsIn(['return', 'exchange'])
  kind?: 'return' | 'exchange';
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
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
