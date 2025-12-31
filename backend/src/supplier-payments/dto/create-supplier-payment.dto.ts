import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SupplierPaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
  BANK_TRANSFER = 'bank_transfer',
  EWALLET_MOMO = 'ewallet_momo',
  EWALLET_ZALOPAY = 'ewallet_zalopay',
  EWALLET_VNPAY = 'ewallet_vnpay',
}

export class PaymentAllocationDto {
  @ApiProperty({ description: 'Purchase Order UUID to allocate payment to' })
  @IsUUID()
  @IsNotEmpty()
  purchase_order_id: string;

  @ApiProperty({ description: 'Amount to allocate to this purchase order', minimum: 0 })
  @IsNumber()
  @Min(0)
  amount_allocated: number;
}

export class CreateSupplierPaymentDto {
  @ApiProperty({ description: 'Supplier UUID' })
  @IsUUID()
  @IsNotEmpty()
  supplier_id: string;

  @ApiProperty({ description: 'Payment amount', minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Payment method',
    enum: SupplierPaymentMethod,
  })
  @IsEnum(SupplierPaymentMethod)
  @IsNotEmpty()
  payment_method: SupplierPaymentMethod;

  @ApiPropertyOptional({ description: 'Payment date (defaults to now)' })
  @IsDateString()
  @IsOptional()
  payment_date?: string;

  @ApiPropertyOptional({ description: 'Transaction ID from payment processor', maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  transaction_id?: string;

  @ApiPropertyOptional({ description: 'Reference number', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  reference_number?: string;

  @ApiPropertyOptional({ description: 'Payment notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Manual payment allocations (if not provided, auto-allocate to oldest unpaid POs)',
    type: [PaymentAllocationDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  @IsOptional()
  allocations?: PaymentAllocationDto[];
}
