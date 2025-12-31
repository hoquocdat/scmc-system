import { IsOptional, IsString, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum PurchaseOrderPaymentStatus {
  UNPAID = 'unpaid',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
}

export class PurchaseOrderQueryDto {
  @ApiPropertyOptional({ description: 'Search query (order number, supplier name)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Supplier UUID' })
  @IsUUID()
  @IsOptional()
  supplier_id?: string;

  @ApiPropertyOptional({
    description: 'Purchase order status',
    enum: PurchaseOrderStatus,
  })
  @IsEnum(PurchaseOrderStatus)
  @IsOptional()
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({
    description: 'Payment status',
    enum: PurchaseOrderPaymentStatus,
  })
  @IsEnum(PurchaseOrderPaymentStatus)
  @IsOptional()
  payment_status?: PurchaseOrderPaymentStatus;

  @ApiPropertyOptional({ description: 'Filter by order date from' })
  @IsDateString()
  @IsOptional()
  order_date_from?: string;

  @ApiPropertyOptional({ description: 'Filter by order date to' })
  @IsDateString()
  @IsOptional()
  order_date_to?: string;

  @ApiPropertyOptional({ description: 'Filter by expected delivery date from' })
  @IsDateString()
  @IsOptional()
  expected_delivery_from?: string;

  @ApiPropertyOptional({ description: 'Filter by expected delivery date to' })
  @IsDateString()
  @IsOptional()
  expected_delivery_to?: string;
}
