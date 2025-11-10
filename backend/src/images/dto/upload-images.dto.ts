import { IsEnum, IsUUID } from 'class-validator';
import { image_entity_type } from '@prisma/client';

export class UploadImagesDto {
  @IsEnum(image_entity_type)
  entity_type: image_entity_type;

  @IsUUID()
  entity_id: string;
}
