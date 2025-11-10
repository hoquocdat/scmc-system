import {
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInventoryDto {
  @ApiPropertyOptional({ description: 'Quantity on hand' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  quantity_on_hand?: number;

  @ApiPropertyOptional({ description: 'Quantity reserved for orders' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  quantity_reserved?: number;

  @ApiPropertyOptional({ description: 'Quantity on order from suppliers' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  quantity_on_order?: number;

  @ApiPropertyOptional({ description: 'Safety stock level' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  safety_stock?: number;
}
