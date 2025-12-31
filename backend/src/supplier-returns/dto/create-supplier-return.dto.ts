import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ReturnItemDto {
  @ApiProperty({ description: 'Purchase order item UUID' })
  @IsUUID()
  @IsNotEmpty()
  purchase_order_item_id: string;

  @ApiProperty({ description: 'Quantity to return', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity_returned: number;

  @ApiPropertyOptional({ description: 'Reason for return' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateSupplierReturnDto {
  @ApiProperty({ description: 'Supplier UUID' })
  @IsUUID()
  @IsNotEmpty()
  supplier_id: string;

  @ApiProperty({ description: 'Purchase Order UUID' })
  @IsUUID()
  @IsNotEmpty()
  purchase_order_id: string;

  @ApiPropertyOptional({ description: 'Return date (defaults to now)' })
  @IsDateString()
  @IsOptional()
  return_date?: string;

  @ApiPropertyOptional({ description: 'General reason for return' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'Items to return',
    type: [ReturnItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  @IsNotEmpty()
  items: ReturnItemDto[];
}
