export class CustomerLoyaltyDto {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  tier: {
    id: string;
    code: string;
    name: string;
    pointsMultiplier: number;
    minPoints: number;
  } | null;
  pointsBalance: number;
  pointsEarnedLifetime: number;
  pointsRedeemedLifetime: number;
  totalSpend: number;
  pointsToNextTier?: number;
  nextTierName?: string;
  tierUpdatedAt?: Date;
  createdAt: Date;
}

export class LoyaltyTransactionDto {
  id: string;
  transactionType: string;
  points: number;
  pointsBalanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  orderAmount?: number;
  reason?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: Date;
}

export class LoyaltyHistoryResponseDto {
  transactions: LoyaltyTransactionDto[];
  total: number;
  page: number;
  limit: number;
}
