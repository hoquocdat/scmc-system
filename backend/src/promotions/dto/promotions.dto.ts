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

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const CODE_RE = /^[A-Z0-9_-]{2,30}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const PROMOTION_TYPES = [
  'line_discount',
  'order_discount',
  'buy_x_get_y',
  'bundle',
] as const;
export const TARGET_TYPES = [
  'product',
  'variant',
  'category',
  'brand',
] as const;
export const TARGET_ROLES = ['target', 'buy', 'get', 'bundle'] as const;
/** POS and back-office channels (e-commerce promotions are out of scope). */
export const CHANNELS = ['pos', 'retail_store', 'workshop', 'phone'] as const;

export class PromotionTargetDto {
  @ApiProperty({ enum: TARGET_ROLES })
  @IsIn(TARGET_ROLES)
  role: (typeof TARGET_ROLES)[number];
  @ApiProperty({ enum: TARGET_TYPES })
  @IsIn(TARGET_TYPES)
  target_type: (typeof TARGET_TYPES)[number];
  @ApiProperty() @IsUUID() target_id: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;
}

export class PromotionInputDto {
  @ApiPropertyOptional({ example: 'MUA2TANG1' })
  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(CODE_RE, { message: 'Mã chỉ gồm chữ, số, - và _' })
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;
  @ApiPropertyOptional({ enum: PROMOTION_TYPES })
  @IsOptional()
  @IsIn(PROMOTION_TYPES)
  type?: (typeof PROMOTION_TYPES)[number];
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  priority?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() start_at?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() end_at?: string | null;

  @ApiPropertyOptional({
    description: '0 = Sunday … 6 = Saturday; empty = every day',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days_of_week?: number[];

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @Matches(TIME_RE)
  time_from?: string | null;
  @ApiPropertyOptional({ example: '20:00' })
  @IsOptional()
  @Matches(TIME_RE)
  time_to?: string | null;
  @ApiPropertyOptional({ description: 'Empty = all branches' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  store_ids?: string[];
  @ApiPropertyOptional({ description: 'Empty = all customers' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  group_ids?: string[];
  @ApiPropertyOptional({
    enum: CHANNELS,
    isArray: true,
    description: 'Empty = all channels',
  })
  @IsOptional()
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() combinable?: boolean;
  @ApiPropertyOptional({ enum: ['percent', 'amount', 'fixed_price'] })
  @IsOptional()
  @IsIn(['percent', 'amount', 'fixed_price'])
  discount_kind?: 'percent' | 'amount' | 'fixed_price' | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discount_value?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) max_discount?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) min_order_amount?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) buy_quantity?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) get_quantity?:
    | number
    | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  get_discount_percent?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) bundle_price?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ type: [PromotionTargetDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PromotionTargetDto)
  targets?: PromotionTargetDto[];
}

export class CampaignInputDto {
  @ApiPropertyOptional({ example: 'TET27' })
  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(CODE_RE, { message: 'Mã chỉ gồm chữ, số, - và _' })
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;
  @ApiPropertyOptional({ enum: ['percent', 'amount'] })
  @IsOptional()
  @IsIn(['percent', 'amount'])
  discount_kind?: 'percent' | 'amount';
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  discount_value?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) max_discount?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) min_order_amount?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() start_at?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() end_at?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  store_ids?: string[];
  @ApiPropertyOptional({ enum: CHANNELS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) uses_per_code?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) uses_per_customer?:
    | number
    | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  combinable_with_promotions?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class GenerateCodesDto {
  @ApiPropertyOptional({ description: 'One specific code' })
  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z0-9-]{3,40}$/, { message: 'Mã gồm 3–40 chữ, số hoặc -' })
  code?: string;

  @ApiPropertyOptional({ description: 'Number of random codes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  count?: number;

  @ApiPropertyOptional({ description: 'Prefix of random codes' })
  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z0-9-]{0,20}$/)
  prefix?: string;
}

export class CodesQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: ['all', 'used', 'unused'] })
  @IsOptional()
  @IsIn(['all', 'used', 'unused'])
  status?: 'all' | 'used' | 'unused';
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
  @Max(500)
  pageSize?: number;
}

export class UpdateCodeDto {
  @ApiProperty() @IsBoolean() is_active: boolean;
}

export class VoucherCheckQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() code: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() store_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customer_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(CHANNELS) channel?: string;
  @ApiPropertyOptional({
    description: 'Order amount after promotions and manual discount',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;
}

export class CartLineDto {
  @ApiProperty() @IsUUID() product_id: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() product_variant_id?: string;
  @ApiProperty() @IsInt() @Min(1) quantity: number;
  @ApiPropertyOptional({ description: 'Manual per-unit discount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;
}

export class CartDto {
  @ApiProperty() @IsUUID() store_id: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customer_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() price_book_id?: string;
  @ApiPropertyOptional({ enum: CHANNELS })
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: string;
  @ApiPropertyOptional({ enum: ['fixed', 'percent'] })
  @IsOptional()
  @IsIn(['fixed', 'percent'])
  discount_type?: 'fixed' | 'percent';
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_value?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  voucher_code?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  points_to_redeem?: number;

  @ApiProperty({ type: [CartLineDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  lines: CartLineDto[];
}
