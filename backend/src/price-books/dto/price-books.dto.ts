import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const PRICE_BOOK_MODES = ['fixed', 'percent_off', 'amount_off'] as const;
export type PriceBookModeDto = (typeof PRICE_BOOK_MODES)[number];

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

// ---------- customer groups ----------

export class CreateCustomerGroupDto {
  @ApiProperty({ example: 'WHOLESALE' })
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,30}$/, { message: 'Mã chỉ gồm chữ, số, - và _' })
  code: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdateCustomerGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_active?: boolean;
}

export class SetCustomerGroupsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  group_ids: string[];
}

// ---------- price books ----------

export class CreatePriceBookDto {
  @ApiProperty({ example: 'GIA-SI' })
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,30}$/, { message: 'Mã chỉ gồm chữ, số, - và _' })
  code: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(150) name: string;

  @ApiPropertyOptional({ description: 'Higher wins' })
  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_active?: boolean;

  @ApiPropertyOptional({ description: 'ISO time; null = open' })
  @IsOptional()
  @IsDateString()
  start_at?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsDateString() end_at?: string | null;

  @ApiPropertyOptional({ description: 'Empty or absent = all branches' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  store_ids?: string[];

  @ApiPropertyOptional({ description: 'Empty or absent = all customers' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  group_ids?: string[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean() allow_manual?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdatePriceBookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() start_at?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() end_at?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  store_ids?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  group_ids?: string[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean() allow_manual?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class EntryRuleDto {
  @ApiProperty({ enum: PRICE_BOOK_MODES })
  @IsIn(PRICE_BOOK_MODES)
  mode: PriceBookModeDto;

  @ApiProperty({ description: 'Price, percent (0–100) or amount' })
  @IsNumber()
  @Min(0)
  value: number;
}

export class UpsertEntryDto extends EntryRuleDto {
  @ApiProperty() @IsUUID() product_id: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() product_variant_id?: string;
}

export class BulkAddEntriesDto extends EntryRuleDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('4', { each: true })
  product_ids?: string[];

  @ApiPropertyOptional() @IsOptional() @IsUUID() category_id?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() brand_id?: string;
}

export class EntryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

// ---------- quote ----------

export class QuoteItemDto {
  @ApiProperty() @IsUUID() product_id: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() product_variant_id?: string;
}

export class QuoteDto {
  @ApiProperty() @IsUUID() store_id: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customer_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() price_book_id?: string;

  @ApiProperty({ type: [QuoteItemDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];
}

export class ApplicableBooksQueryDto {
  @ApiProperty() @IsUUID() store_id: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customer_id?: string;
}
