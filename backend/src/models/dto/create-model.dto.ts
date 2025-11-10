import { IsNotEmpty, IsString, IsUUID, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

export class CreateModelDto {
  @IsNotEmpty()
  @IsUUID()
  brand_id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  year_from?: number;

  @IsOptional()
  @IsInt()
  @Min(1900)
  year_to?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
