import { IsEnum, IsUUID } from 'class-validator';
import { image_entity_type } from '@prisma/client';
import { ImageEntityType } from './create-image.dto';

export class UploadImagesDto {
  @IsEnum(ImageEntityType)
  entity_type: image_entity_type;

  @IsUUID()
  entity_id: string;
}
