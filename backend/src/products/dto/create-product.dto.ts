import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductType {
  PHYSICAL = 'physical',
  SERVICE = 'service',
  DIGITAL = 'digital',
}

export class CreateProductDto {
  @ApiProperty({ description: 'Product SKU (Stock Keeping Unit)', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku: string;

  @ApiProperty({ description: 'Product name', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Category UUID' })
  @IsUUID()
  @IsOptional()
  category_id?: string;

  @ApiPropertyOptional({ description: 'Brand UUID' })
  @IsUUID()
  @IsOptional()
  brand_id?: string;

  @ApiPropertyOptional({ description: 'Supplier UUID' })
  @IsUUID()
  @IsOptional()
  supplier_id?: string;

  @ApiPropertyOptional({ description: 'Cost price', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  cost_price?: number;

  @ApiProperty({ description: 'Retail price' })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  retail_price: number;

  @ApiPropertyOptional({ description: 'Sale price (if on sale)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  sale_price?: number;

  @ApiPropertyOptional({ description: 'Sale price start date' })
  @IsDateString()
  @IsOptional()
  sale_price_start_date?: string;

  @ApiPropertyOptional({ description: 'Sale price end date' })
  @IsDateString()
  @IsOptional()
  sale_price_end_date?: string;

  @ApiPropertyOptional({ description: 'Reorder point threshold', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  reorder_point?: number;

  @ApiPropertyOptional({ description: 'Reorder quantity', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  reorder_quantity?: number;

  @ApiPropertyOptional({ description: 'Product type', enum: ProductType, default: ProductType.PHYSICAL })
  @IsEnum(ProductType)
  @IsOptional()
  product_type?: ProductType;

  @ApiPropertyOptional({ description: 'Is product active', default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Is product featured', default: false })
  @IsBoolean()
  @IsOptional()
  is_featured?: boolean;

  @ApiPropertyOptional({ description: 'Weight in kg' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ description: 'Length in cm' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  dimensions_length?: number;

  @ApiPropertyOptional({ description: 'Width in cm' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  dimensions_width?: number;

  @ApiPropertyOptional({ description: 'Height in cm' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  dimensions_height?: number;
}
