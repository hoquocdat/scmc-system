import { IsUUID, IsInt, IsOptional, IsString, IsEnum } from 'class-validator';

export enum AdjustmentType {
  MANUAL_CREDIT = 'manual_credit',
  MANUAL_DEBIT = 'manual_debit',
  CORRECTION = 'correction',
  PROMOTION = 'promotion',
  EXPIRATION = 'expiration',
}

export class AdjustPointsDto {
  @IsUUID()
  customerId: string;

  @IsInt()
  points: number; // Positive for credit, negative for debit

  @IsEnum(AdjustmentType)
  adjustmentType: AdjustmentType;

  @IsString()
  reason: string;

  @IsUUID()
  @IsOptional()
  createdBy?: string;
}

export class AdjustPointsResultDto {
  pointsAdjusted: number;
  pointsBalance: number;
  transactionId: string;
}
