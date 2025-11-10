import { IsString, IsUUID, IsOptional, IsObject } from 'class-validator';
import type { ActivityAction, EntityType } from '../activity-log.entity';

export class CreateActivityLogDto {
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @IsString()
  entity_type: EntityType;

  @IsUUID()
  entity_id: string;

  @IsString()
  action: ActivityAction;

  @IsObject()
  @IsOptional()
  old_values?: Record<string, any>;

  @IsObject()
  @IsOptional()
  new_values?: Record<string, any>;

  @IsString()
  @IsOptional()
  ip_address?: string;

  @IsString()
  @IsOptional()
  user_agent?: string;
}
