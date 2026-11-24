import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export class StockLineDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() product_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() product_variant_id?: string;
  @ApiProperty() @IsInt() @Min(1) @Max(1_000_000) quantity: number;
}

export class CreateTransferDto {
  @ApiProperty() @IsUUID() from_location_id: string;
  @ApiProperty() @IsUUID() to_location_id: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ type: [StockLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  items: StockLineDto[];
}

export class TransferLineQtyDto {
  @ApiProperty() @IsUUID() item_id: string;
  @ApiProperty() @IsInt() @Min(0) quantity: number;
}

export class ShipTransferDto {
  @ApiPropertyOptional({
    type: [TransferLineQtyDto],
    description: 'Shipped per line; default = requested',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferLineQtyDto)
  items?: TransferLineQtyDto[];
}

export class ReceiveTransferDto {
  @ApiProperty({
    type: [TransferLineQtyDto],
    description: 'Received now per line (added to earlier receipts)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferLineQtyDto)
  items: TransferLineQtyDto[];

  @ApiPropertyOptional({
    description: 'Close the transfer; unreceived units become a discrepancy',
  })
  @IsOptional()
  @IsBoolean()
  close?: boolean;
}

export class CancelDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason: string;
}

export class TransferQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    'pending',
    'in_transit',
    'partially_received',
    'received',
    'cancelled',
  ])
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
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

export class CountScopeDto {
  @ApiProperty({ enum: ['all', 'category', 'brand', 'products'] })
  @IsIn(['all', 'category', 'brand', 'products'])
  type: 'all' | 'category' | 'brand' | 'products';
  @ApiPropertyOptional() @IsOptional() @IsUUID() category_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() brand_id?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  product_ids?: string[];
}

export class StartCountDto {
  @ApiProperty() @IsUUID() location_id: string;
  @ApiProperty({ type: CountScopeDto })
  @ValidateNested()
  @Type(() => CountScopeDto)
  scope: CountScopeDto;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CountEntryDto {
  @ApiPropertyOptional({ description: 'Count line' })
  @IsOptional()
  @IsUUID()
  item_id?: string;
  @ApiPropertyOptional({ description: 'Barcode or SKU (scan)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;
  @ApiPropertyOptional({ description: 'Set the counted quantity' })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;
  @ApiPropertyOptional({
    description: 'Add to the counted quantity (scan = 1)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  increment?: number;
}

export const WRITE_OFF_REASONS = [
  'damaged',
  'lost',
  'internal_use',
  'expired',
  'other',
] as const;

export class CreateWriteOffDto {
  @ApiProperty() @IsUUID() location_id: string;
  @ApiProperty({ enum: WRITE_OFF_REASONS })
  @IsIn(WRITE_OFF_REASONS)
  reason: (typeof WRITE_OFF_REASONS)[number];
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiProperty({ type: [StockLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  items: StockLineDto[];
}

export class WriteOffQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(WRITE_OFF_REASONS) reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['json', 'xlsx', 'csv']) format?:
    | 'json'
    | 'xlsx'
    | 'csv';
  @ApiPropertyOptional() @IsOptional() @IsIn(['vi', 'en']) lang?: 'vi' | 'en';
}

const BARCODE_RE = /^[0-9A-Za-z\-.]{4,64}$/;

export class SetBarcodeDto {
  @ApiPropertyOptional({ description: 'Empty or null removes the barcode' })
  @IsOptional()
  @Matches(BARCODE_RE, { message: 'Mã vạch 4–64 ký tự chữ, số, - hoặc .' })
  barcode?: string | null;
}

export class UnitDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) name: string;
  @ApiProperty() @IsInt() @Min(2) @Max(100_000) factor: number;
  @ApiPropertyOptional() @IsOptional() @Matches(BARCODE_RE) barcode?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) price?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_active?: boolean;
}

export class BaseUnitDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) base_unit: string;
}

export class ReorderPoDto {
  @ApiProperty() @IsUUID() supplier_id: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiProperty({ type: [StockLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  items: StockLineDto[];
}
