import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddPurchaseOrderItemDto {
  @ApiPropertyOptional({ description: 'Product UUID (use either product_id or product_variant_id)' })
  @IsUUID()
  @IsOptional()
  product_id?: string;

  @ApiPropertyOptional({ description: 'Product variant UUID (use either product_id or product_variant_id)' })
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
