import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const REPORT_FORMATS = ['json', 'xlsx', 'csv'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

/**
 * Query parameters shared by every report endpoint.
 * Dates are calendar days in Vietnam time; the end date is inclusive.
 */
export class ReportQueryDto {
  @ApiPropertyOptional({
    description:
      'First day (YYYY-MM-DD, Vietnam time). Default: first day of the current month',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    description:
      'Last day, inclusive (YYYY-MM-DD, Vietnam time). Default: today',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({ description: 'Branch (store) UUID' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily',
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  interval?: 'daily' | 'weekly' | 'monthly';

  @ApiPropertyOptional({
    description: 'Page number (1-based) for paged reports',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Rows per page for paged reports',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Maximum rows for ranked reports (top products)',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ description: 'Ranking column for ranked reports' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Product UUID filter' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Stock location UUID filter' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({
    description:
      'Movement type filter (SALE, RECEIVE, ADJUST, RETURN, TRANSFER_IN, TRANSFER_OUT)',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    enum: REPORT_FORMATS,
    default: 'json',
    description: 'xlsx or csv downloads the report as a file',
  })
  @IsOptional()
  @IsIn(REPORT_FORMATS)
  format?: ReportFormat;

  @ApiPropertyOptional({
    enum: ['vi', 'en'],
    default: 'vi',
    description: 'Header language for exported files',
  })
  @IsOptional()
  @IsIn(['vi', 'en'])
  lang?: 'vi' | 'en';
}

/** True when the request asks for a file instead of JSON. */
export const isExport = (q: ReportQueryDto): boolean =>
  q.format === 'xlsx' || q.format === 'csv';
