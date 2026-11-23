import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export enum CashMovementType {
  CASH_IN = 'cash_in',
  CASH_OUT = 'cash_out',
}

/** Cash put into or taken out of the drawer during a shift. */
export class CashMovementDto {
  @ApiProperty({ description: 'Shift (POS session) UUID' })
  @IsUUID()
  @IsNotEmpty()
  pos_session_id: string;

  @ApiProperty({ enum: CashMovementType })
  @IsEnum(CashMovementType)
  transaction_type: CashMovementType;

  @ApiProperty({ description: 'Amount moved (positive)', minimum: 1 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Why the cash was moved (e.g. "move to safe")' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
