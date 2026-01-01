import { IsOptional, IsString, IsUUID, IsEnum, IsNumber, Min, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentStatus, SalesChannel } from './create-sales-order.dto';

export class SalesOrderQueryDto {
  @ApiPropertyOptional({ description: 'Search term (order number, customer name)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsUUID()
  @IsOptional()
  customer_id?: string;

  @ApiPropertyOptional({ description: 'Filter by store ID' })
  @IsUUID()
  @IsOptional()
  store_id?: string;

  @ApiPropertyOptional({ description: 'Filter by created_by user ID' })
  @IsUUID()
  @IsOptional()
  created_by?: string;

  @ApiPropertyOptional({ description: 'Filter by processed_by user ID' })
  @IsUUID()
  @IsOptional()
  processed_by?: string;

  @ApiPropertyOptional({ description: 'Filter by order status', enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Filter by payment status', enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Filter by channel', enum: SalesChannel })
  @IsEnum(SalesChannel)
  @IsOptional()
  channel?: SalesChannel;

  @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  from_date?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  to_date?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'created_at' })
  @IsString()
  @IsOptional()
  sort_by?: string = 'created_at';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sort_order?: 'asc' | 'desc' = 'desc';
}
