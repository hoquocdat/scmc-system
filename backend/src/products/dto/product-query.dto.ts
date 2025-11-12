import { IsOptional, IsString, IsBoolean, IsUUID, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { ProductType } from './create-product.dto';

export class ProductQueryDto {
  @ApiPropertyOptional({ description: 'Search term (name, SKU, description)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsUUID()
  @IsOptional()
  category_id?: string;

  @ApiPropertyOptional({ description: 'Filter by brand ID' })
  @IsUUID()
  @IsOptional()
  brand_id?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsUUID()
  @IsOptional()
  supplier_id?: string;

  @ApiPropertyOptional({ description: 'Filter by product type', enum: ProductType })
  @IsEnum(ProductType)
  @IsOptional()
  product_type?: ProductType;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Filter by featured status' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_featured?: boolean;

  @ApiPropertyOptional({ description: 'Filter by created date start (ISO 8601)' })
  @IsString()
  @IsOptional()
  created_from?: string;

  @ApiPropertyOptional({ description: 'Filter by created date end (ISO 8601)' })
  @IsString()
  @IsOptional()
  created_to?: string;

  @ApiPropertyOptional({
    description: 'Filter by stock status',
    enum: ['in_stock', 'out_of_stock', 'below_reorder', 'above_reorder']
  })
  @IsEnum(['in_stock', 'out_of_stock', 'below_reorder', 'above_reorder'])
  @IsOptional()
  stock_status?: 'in_stock' | 'out_of_stock' | 'below_reorder' | 'above_reorder';

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
