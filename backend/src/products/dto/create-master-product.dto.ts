import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateProductDto } from './create-product.dto';

export class CreateMasterProductDto extends CreateProductDto {
  @ApiProperty({
    description: 'Variant attributes for automatic generation',
    example: { color: ['red', 'blue'], size: ['M', 'L'] },
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: { type: 'string' },
    },
  })
  @IsObject()
  @IsNotEmpty()
  variantAttributes: Record<string, string[]>;
}

/**
 * DTO for adding new variants to an existing master product
 */
export class AddVariantsDto {
  @ApiProperty({
    description: 'Master product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  master_product_id: string;

  @ApiProperty({
    description: 'Variant attributes to add',
    example: { color: ['green'], size: ['XL'] },
  })
  @IsObject()
  @IsNotEmpty()
  variantAttributes: Record<string, string[]>;
}

/**
 * DTO for finding a specific variant by attributes
 */
export class FindVariantDto {
  @ApiProperty({
    description: 'Attribute key-value pairs',
    example: { color: 'red', size: 'M' },
  })
  @IsObject()
  @IsNotEmpty()
  attributes: Record<string, string>;
}
