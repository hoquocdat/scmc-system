import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePurchaseOrderItemDto {
  @ApiPropertyOptional({ description: 'Product name (snapshot)', maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  product_name?: string;

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

  @ApiPropertyOptional({ description: 'Quantity ordered', minimum: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  quantity_ordered?: number;

  @ApiPropertyOptional({ description: 'Unit cost per item', minimum: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  unit_cost?: number;

  @ApiPropertyOptional({ description: 'Item notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
