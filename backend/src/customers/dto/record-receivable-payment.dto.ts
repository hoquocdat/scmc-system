import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  EWALLET_MOMO = 'ewallet_momo',
  EWALLET_ZALOPAY = 'ewallet_zalopay',
  EWALLET_VNPAY = 'ewallet_vnpay',
}

export class RecordReceivablePaymentDto {
  @ApiProperty({ description: 'Customer UUID' })
  @IsUUID()
  customer_id: string;

  @ApiPropertyOptional({
    description:
      'Specific sales order UUID to apply payment to. If not provided, payment will be applied using FIFO to oldest unpaid orders.',
  })
  @IsUUID()
  @IsOptional()
  sales_order_id?: string;

  @ApiProperty({ description: 'Payment amount', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
  })
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ApiPropertyOptional({ description: 'Transaction ID or reference number' })
  @IsString()
  @IsOptional()
  transaction_id?: string;

  @ApiPropertyOptional({ description: 'Payment notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
