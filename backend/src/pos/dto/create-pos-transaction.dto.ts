import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export enum PosTransactionType {
  CASH_IN = 'cash_in',
  CASH_OUT = 'cash_out',
  OPENING_BALANCE = 'opening_balance',
  CLOSING_BALANCE = 'closing_balance',
}

export class CreatePosTransactionDto {
  @ApiProperty({ description: 'POS Session UUID' })
  @IsUUID()
  @IsNotEmpty()
  pos_session_id: string;

  @ApiProperty({ description: 'Transaction type', enum: PosTransactionType })
  @IsEnum(PosTransactionType)
  @IsNotEmpty()
  transaction_type: PosTransactionType;

  @ApiProperty({ description: 'Transaction amount (positive for cash in, negative for cash out)' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({ description: 'Reason for transaction' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Transaction notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
