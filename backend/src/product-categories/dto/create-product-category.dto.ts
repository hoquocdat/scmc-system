import { IsNotEmpty, IsOptional, IsString, IsInt, IsUUID } from 'class-validator';

export class CreateProductCategoryDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @IsOptional()
  @IsInt()
  display_order?: number;
}
