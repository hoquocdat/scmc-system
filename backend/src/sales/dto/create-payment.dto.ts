import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
  EWALLET_MOMO = 'ewallet_momo',
  EWALLET_ZALOPAY = 'ewallet_zalopay',
  EWALLET_VNPAY = 'ewallet_vnpay',
  BANK_TRANSFER = 'bank_transfer',
}

export class CreatePaymentDto {
  @ApiProperty({ description: 'Sales Order UUID' })
  @IsUUID()
  @IsNotEmpty()
  sales_order_id: string;

  @ApiProperty({ description: 'Payment method', enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  payment_method: PaymentMethod;

  @ApiProperty({ description: 'Payment amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Transaction ID (from payment gateway, bank, etc.)' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  transaction_id?: string;

  @ApiPropertyOptional({ description: 'Authorization code (from card payment, etc.)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  authorization_code?: string;

  @ApiPropertyOptional({ description: 'Amount tendered by customer' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  amount_tendered?: number;

  @ApiPropertyOptional({ description: 'Change given to customer' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  change_given?: number;

  @ApiPropertyOptional({ description: 'Payment notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'User who received the payment' })
  @IsUUID()
  @IsOptional()
  received_by?: string;
}
