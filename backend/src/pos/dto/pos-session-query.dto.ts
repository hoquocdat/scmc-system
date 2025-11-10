import { IsOptional, IsString, IsUUID, IsEnum, IsNumber, Min, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum PosSessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export class PosSessionQueryDto {
  @ApiPropertyOptional({ description: 'Filter by location ID' })
  @IsUUID()
  @IsOptional()
  location_id?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: PosSessionStatus })
  @IsEnum(PosSessionStatus)
  @IsOptional()
  status?: PosSessionStatus;

  @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  from_date?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  to_date?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'opened_at' })
  @IsString()
  @IsOptional()
  sort_by?: string = 'opened_at';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sort_order?: 'asc' | 'desc' = 'desc';
}
