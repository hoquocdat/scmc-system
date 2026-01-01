import { apiClient } from './client';

// Types
export interface LoyaltyTier {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  minPoints: number;
  minTotalSpend?: number;
  pointsMultiplier: number;
  benefits?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerLoyalty {
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
  tierUpdatedAt?: string;
  createdAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  transactionType: 'earn' | 'redeem' | 'reverse' | 'adjust' | 'expire';
  points: number;
  pointsBalanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  orderAmount?: number;
  reason?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface LoyaltyHistoryResponse {
  transactions: LoyaltyTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface RedemptionPreview {
  pointsAvailable: number;
  maxRedeemablePoints: number;
  maxDiscountAmount: number;
  minRedemptionPoints: number;
  redemptionRate: number;
  maxRedemptionPercent: number;
  tierName: string;
  tierMultiplier: number;
}

export interface LoyaltyRules {
  id: string;
  versionNumber: number;
  pointsPerCurrency: number;
  earningRoundMode: string;
  redemptionRate: number;
  maxRedemptionPercent: number;
  minRedemptionPoints: number;
  allowTierDowngrade: boolean;
  tierEvaluationBasis: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
}

// Admin types
export interface LoyaltyStats {
  totalMembers: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  totalPointsBalance: number;
  membersByTier: { tierName: string; count: number }[];
  recentTransactions: number;
}

export interface LoyaltyMember {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  tier: { id: string; code: string; name: string } | null;
  pointsBalance: number;
  pointsEarnedLifetime: number;
  pointsRedeemedLifetime: number;
  totalSpend: number;
  createdAt: string;
}

export interface LoyaltyMembersResponse {
  data: LoyaltyMember[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateTierDto {
  code: string;
  name: string;
  displayOrder: number;
  minPoints: number;
  minTotalSpend?: number;
  pointsMultiplier: number;
  benefits?: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpdateTierDto {
  name?: string;
  displayOrder?: number;
  minPoints?: number;
  minTotalSpend?: number;
  pointsMultiplier?: number;
  benefits?: Record<string, unknown>;
  isActive?: boolean;
}

export interface CreateRuleVersionDto {
  pointsPerCurrency: number;
  earningRoundMode?: 'floor' | 'round' | 'ceil';
  redemptionRate: number;
  maxRedemptionPercent?: number;
  minRedemptionPoints?: number;
  allowTierDowngrade?: boolean;
  tierEvaluationBasis?: 'lifetime_points' | 'total_spend';
  isActive?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
}

export interface AdjustPointsDto {
  points: number;
  adjustmentType: 'manual_credit' | 'manual_debit' | 'correction' | 'promotion' | 'expiration';
  reason: string;
}

// Customer-facing API
export const loyaltyApi = {
  // Get customer loyalty info
  getCustomerLoyalty: async (customerId: string): Promise<CustomerLoyalty> => {
    const response = await apiClient.get(`/loyalty/customer/${customerId}`);
    return response.data;
  },

  // Get customer transaction history
  getTransactionHistory: async (
    customerId: string,
    params?: { page?: number; limit?: number }
  ): Promise<LoyaltyHistoryResponse> => {
    const response = await apiClient.get(`/loyalty/customer/${customerId}/history`, { params });
    return response.data;
  },

  // Calculate redemption preview for checkout
  calculateRedemption: async (
    customerId: string,
    orderAmount: number,
    pointsToRedeem?: number
  ): Promise<RedemptionPreview> => {
    const response = await apiClient.post('/loyalty/calculate-redemption', {
      customerId,
      orderAmount,
      pointsToRedeem,
    });
    return response.data;
  },

  // Get all active tiers
  getTiers: async (): Promise<LoyaltyTier[]> => {
    const response = await apiClient.get('/loyalty/tiers');
    return response.data;
  },

  // Get active loyalty rules
  getRules: async (): Promise<LoyaltyRules> => {
    const response = await apiClient.get('/loyalty/rules');
    return response.data;
  },
};

// Admin API
export const loyaltyAdminApi = {
  // Get loyalty program statistics
  getStats: async (): Promise<LoyaltyStats> => {
    const response = await apiClient.get('/admin/loyalty/stats');
    return response.data;
  },

  // List all loyalty members
  getMembers: async (params?: {
    search?: string;
    tierId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<LoyaltyMembersResponse> => {
    const response = await apiClient.get('/admin/loyalty/members', { params });
    return response.data;
  },

  // Get tier change history for a customer
  getTierHistory: async (customerId: string) => {
    const response = await apiClient.get(`/admin/loyalty/members/${customerId}/tier-history`);
    return response.data;
  },

  // Adjust customer points
  adjustPoints: async (customerId: string, data: AdjustPointsDto) => {
    const response = await apiClient.post(`/admin/loyalty/members/${customerId}/adjust-points`, data);
    return response.data;
  },

  // Tier management
  createTier: async (data: CreateTierDto): Promise<LoyaltyTier> => {
    const response = await apiClient.post('/admin/loyalty/tiers', data);
    return response.data;
  },

  updateTier: async (id: string, data: UpdateTierDto): Promise<LoyaltyTier> => {
    const response = await apiClient.patch(`/admin/loyalty/tiers/${id}`, data);
    return response.data;
  },

  deleteTier: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/loyalty/tiers/${id}`);
  },

  // Rule version management
  getRuleVersions: async (): Promise<LoyaltyRules[]> => {
    const response = await apiClient.get('/admin/loyalty/rules');
    return response.data;
  },

  createRuleVersion: async (data: CreateRuleVersionDto): Promise<LoyaltyRules> => {
    const response = await apiClient.post('/admin/loyalty/rules', data);
    return response.data;
  },

  activateRuleVersion: async (id: string): Promise<LoyaltyRules> => {
    const response = await apiClient.post(`/admin/loyalty/rules/${id}/activate`);
    return response.data;
  },
};

// Helper constants for UI
export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  earn: 'Tích điểm',
  redeem: 'Đổi điểm',
  reverse: 'Hoàn điểm',
  adjust: 'Điều chỉnh',
  expire: 'Hết hạn',
};

export const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  manual_credit: 'Cộng điểm thủ công',
  manual_debit: 'Trừ điểm thủ công',
  correction: 'Điều chỉnh sửa lỗi',
  promotion: 'Khuyến mãi',
  expiration: 'Hết hạn điểm',
};

export const TIER_LABELS: Record<string, string> = {
  iron: 'Iron Rider',
  silver: 'Silver Rider',
  gold: 'Golden Legend',
};

// Format points for display
export const formatPoints = (points: number): string => {
  return points.toLocaleString('vi-VN');
};

// Format currency equivalent of points
export const formatPointsValue = (points: number, redemptionRate: number = 1000): string => {
  const value = points * redemptionRate;
  return value.toLocaleString('vi-VN') + ' ₫';
};
