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

export enum InventoryTransactionType {
  RECEIVE = 'RECEIVE',
  ADJUST = 'ADJUST',
  TRANSFER_OUT = 'TRANSFER_OUT',
  TRANSFER_IN = 'TRANSFER_IN',
  SALE = 'SALE',
  RETURN = 'RETURN',
}

export class CreateInventoryTransactionDto {
  @ApiProperty({ description: 'Transaction type', enum: InventoryTransactionType })
  @IsEnum(InventoryTransactionType)
  @IsNotEmpty()
  transaction_type: InventoryTransactionType;

  @ApiProperty({ description: 'Location UUID' })
  @IsUUID()
  @IsNotEmpty()
  location_id: string;

  @ApiPropertyOptional({ description: 'Product UUID (required if no variant)' })
  @IsUUID()
  @IsOptional()
  product_id?: string;

  @ApiPropertyOptional({ description: 'Product Variant UUID (required if no product)' })
  @IsUUID()
  @IsOptional()
  product_variant_id?: string;

  @ApiProperty({ description: 'Quantity (positive for receive/return, negative for sale/transfer out)' })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit cost at time of transaction' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  unit_cost?: number;

  @ApiPropertyOptional({ description: 'Reference to related order (Sales Order, Transfer Order, etc.)' })
  @IsUUID()
  @IsOptional()
  reference_id?: string;

  @ApiPropertyOptional({ description: 'Reference type (e.g., "sales_order", "transfer_order")' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  reference_type?: string;

  @ApiPropertyOptional({ description: 'Notes or reason for transaction' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'User who performed the transaction' })
  @IsUUID()
  @IsOptional()
  performed_by?: string;
}
