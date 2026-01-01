import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  IsUUID,
} from 'class-validator';

export class CreateTierDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  displayOrder: number;

  @IsInt()
  @Min(0)
  minPoints: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minTotalSpend?: number;

  @IsNumber()
  @Min(1)
  @Max(10)
  pointsMultiplier: number;

  @IsOptional()
  benefits?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTierDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  minPoints?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minTotalSpend?: number;

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  pointsMultiplier?: number;

  @IsOptional()
  benefits?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateRuleVersionDto {
  @IsNumber()
  @Min(0)
  pointsPerCurrency: number;

  @IsEnum(['floor', 'round', 'ceil'])
  @IsOptional()
  earningRoundMode?: 'floor' | 'round' | 'ceil';

  @IsNumber()
  @Min(1)
  redemptionRate: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  maxRedemptionPercent?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  minRedemptionPoints?: number;

  @IsBoolean()
  @IsOptional()
  allowTierDowngrade?: boolean;

  @IsEnum(['lifetime_points', 'total_spend'])
  @IsOptional()
  tierEvaluationBasis?: 'lifetime_points' | 'total_spend';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class LoyaltyStatsDto {
  totalMembers: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  totalPointsBalance: number;
  membersByTier: { tierName: string; count: number }[];
  recentTransactions: number;
}

export class LoyaltyMemberQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  tierId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: 'points_balance' | 'points_earned_lifetime' | 'total_spend' | 'created_at';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
