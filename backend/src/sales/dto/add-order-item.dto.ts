import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddOrderItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID()
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
