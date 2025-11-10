import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreatePartDto {
  @IsOptional()
  @IsString()
  part_number?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  quantity_in_stock: number;

  @IsNumber()
  @Min(0)
  minimum_stock_level: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unit_cost?: number;

  @IsOptional()
  @IsString()
  supplier?: string;
}
