import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class EarnPointsDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  orderType?: 'sales_order' | 'service_order';

  @IsNumber()
  @Min(0)
  amount: number;

  @IsUUID()
  @IsOptional()
  createdBy?: string;
}

export class EarnPointsResultDto {
  pointsEarned: number;
  pointsBalance: number;
  tierMultiplier: number;
  transactionId: string;
  tierUpgraded: boolean;
  newTierName?: string;
}
