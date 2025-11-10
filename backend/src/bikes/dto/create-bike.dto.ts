import { IsString, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';

export class CreateBikeDto {
  @IsUUID('all')
  owner_id: string;

  @IsString()
  brand: string;

  @IsString()
  model: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsString()
  license_plate: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  engine_number?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
