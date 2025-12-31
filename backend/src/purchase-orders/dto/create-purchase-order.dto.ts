import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({ description: 'Product UUID (use either product_id or product_variant_id)' })
  @IsUUID()
  @IsOptional()
  product_id?: string;

  @ApiProperty({ description: 'Product variant UUID (use either product_id or product_variant_id)' })
  @IsUUID()
  @IsOptional()
  product_variant_id?: string;

  @ApiProperty({ description: 'Product name (snapshot)', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  product_name: string;

  @ApiPropertyOptional({ description: 'Product SKU (snapshot)', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  product_sku?: string;

  @ApiPropertyOptional({ description: 'Variant name (snapshot)', maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  variant_name?: string;

  @ApiProperty({ description: 'Quantity ordered', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity_ordered: number;

  @ApiProperty({ description: 'Unit cost per item', minimum: 0 })
  @IsNumber()
  @Min(0)
  unit_cost: number;

  @ApiPropertyOptional({ description: 'Item notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier UUID' })
  @IsUUID()
  @IsNotEmpty()
  supplier_id: string;

  @ApiPropertyOptional({ description: 'Expected delivery date' })
  @IsDateString()
  @IsOptional()
  expected_delivery_date?: string;

  @ApiPropertyOptional({ description: 'Tax amount', minimum: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Shipping cost', minimum: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  shipping_cost?: number;

  @ApiPropertyOptional({ description: 'Discount amount', minimum: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  discount_amount?: number;

  @ApiPropertyOptional({ description: 'Purchase order notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Internal notes (not visible to supplier)' })
  @IsString()
  @IsOptional()
  internal_notes?: string;

  @ApiProperty({
    description: 'Purchase order items',
    type: [CreatePurchaseOrderItemDto],
    required: false
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  @IsOptional()
  items?: CreatePurchaseOrderItemDto[];
}
