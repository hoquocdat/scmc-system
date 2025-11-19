import { IsEnum, IsOptional, IsString, IsBoolean, IsInt, IsUUID } from 'class-validator';
import { image_entity_type } from '@prisma/client';

// Create runtime enum for validation (Prisma enums are types only)
export enum ImageEntityType {
  bike = 'bike',
  service_order = 'service_order',
  customer = 'customer',
  part = 'part',
  comment = 'comment',
}

export class CreateImageDto {
  @IsEnum(ImageEntityType)
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
