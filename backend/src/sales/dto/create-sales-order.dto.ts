import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SalesChannel {
  RETAIL_STORE = 'retail_store',
  WORKSHOP = 'workshop',
  ONLINE = 'online',
  PHONE = 'phone',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  READY = 'ready',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

export class SalesOrderItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID()
  @IsNotEmpty()
  product_id: string;

  @ApiPropertyOptional({ description: 'Product Variant UUID' })
  @IsUUID()
  @IsOptional()
  product_variant_id?: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Unit price at time of sale' })
  @IsNumber()
  @Min(0)
  unit_price: number;

  @ApiPropertyOptional({ description: 'Discount amount per item' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  discount_amount?: number;

  @ApiPropertyOptional({ description: 'Tax amount per item' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Notes for this item' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateSalesOrderDto {
  @ApiPropertyOptional({ description: 'Customer UUID (if existing customer)' })
  @IsUUID()
  @IsOptional()
  customer_id?: string;

  @ApiProperty({ description: 'Customer name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  customer_name: string;

  @ApiPropertyOptional({ description: 'Customer phone' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  customer_phone?: string;

  @ApiPropertyOptional({ description: 'Customer email' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  customer_email?: string;

  @ApiProperty({ description: 'Sales channel', enum: SalesChannel })
  @IsEnum(SalesChannel)
  @IsNotEmpty()
  channel: SalesChannel;

  @ApiProperty({ description: 'Location UUID where sale is made' })
  @IsUUID()
  @IsNotEmpty()
  location_id: string;

  @ApiPropertyOptional({ description: 'Order status', enum: OrderStatus, default: OrderStatus.PENDING })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Payment status', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @ApiProperty({ description: 'Order items', type: [SalesOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items: SalesOrderItemDto[];

  @ApiPropertyOptional({ description: 'Subtotal (calculated if not provided)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({ description: 'Total discount amount' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  discount_amount?: number;

  @ApiPropertyOptional({ description: 'Total tax amount' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Shipping cost' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  shipping_cost?: number;

  @ApiPropertyOptional({ description: 'Total amount (calculated if not provided)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  total_amount?: number;

  @ApiPropertyOptional({ description: 'Shipping address' })
  @IsString()
  @IsOptional()
  shipping_address?: string;

  @ApiPropertyOptional({ description: 'Shipping city' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  shipping_city?: string;

  @ApiPropertyOptional({ description: 'Order notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Created by user UUID' })
  @IsUUID()
  @IsOptional()
  created_by?: string;
}
