import { PartialType } from '@nestjs/mapped-types';
import { CreateProductCategoryDto } from './create-product-category.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateProductCategoryDto extends PartialType(CreateProductCategoryDto) {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
