import { IsEnum, IsOptional, IsString, IsBoolean, IsInt, IsUUID } from 'class-validator';
import { image_entity_type } from '@prisma/client';

export class CreateImageDto {
  @IsEnum(image_entity_type)
  entity_type: image_entity_type;

  @IsUUID()
  entity_id: string;

  @IsString()
  file_path: string;

  @IsString()
  file_name: string;

  @IsOptional()
  @IsInt()
  file_size?: number;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsString()
  storage_bucket?: string;

  @IsString()
  public_url: string;

  @IsOptional()
  @IsInt()
  display_order?: number;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsUUID()
  uploaded_by?: string;
}
