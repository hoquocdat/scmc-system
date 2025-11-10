import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBrandDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  country_of_origin?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
