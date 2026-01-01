import { IsUUID, IsInt, IsOptional, Min, IsString } from 'class-validator';

export class RedeemPointsDto {
  @IsUUID()
  customerId: string;

  @IsInt()
  @Min(1)
  points: number;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  orderType?: 'sales_order' | 'service_order';
}

export class CalculateRedemptionDto {
  @IsUUID()
  customerId: string;

  @IsInt()
  @Min(0)
  orderAmount: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  pointsToRedeem?: number;
}

export class RedemptionPreviewDto {
  pointsAvailable: number;
  maxRedeemablePoints: number;
  maxDiscountAmount: number;
  minRedemptionPoints: number;
  redemptionRate: number;
  tierName: string;
  tierMultiplier: number;
}
