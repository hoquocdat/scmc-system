import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  EarnPointsDto,
  EarnPointsResultDto,
  RedeemPointsDto,
  CalculateRedemptionDto,
  RedemptionPreviewDto,
  AdjustPointsDto,
  AdjustPointsResultDto,
  CustomerLoyaltyDto,
  LoyaltyTransactionDto,
  LoyaltyHistoryResponseDto,
} from './dto';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get customer loyalty information including tier and balance
   */
  async getCustomerLoyalty(customerId: string): Promise<CustomerLoyaltyDto> {
    const loyalty = await this.prisma.customer_loyalty.findUnique({
      where: { customer_id: customerId },
      include: {
        loyalty_tiers: true,
        customers: {
          select: {
            id: true,
            full_name: true,
            phone: true,
          },
        },
      },
    });

    if (!loyalty) {
      // Try to create loyalty record for existing customer
      const customer = await this.prisma.customers.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // Create loyalty record with default tier
      const defaultTier = await this.prisma.loyalty_tiers.findFirst({
        where: { is_active: true },
        orderBy: { min_points: 'asc' },
      });

      const newLoyalty = await this.prisma.customer_loyalty.create({
        data: {
          customer_id: customerId,
          current_tier_id: defaultTier?.id,
          points_balance: 0,
          points_earned_lifetime: 0,
          points_redeemed_lifetime: 0,
          total_spend: 0,
        },
        include: {
          loyalty_tiers: true,
          customers: {
            select: {
              id: true,
              full_name: true,
              phone: true,
            },
          },
        },
      });

      return this.mapToCustomerLoyaltyDto(newLoyalty);
    }

    return this.mapToCustomerLoyaltyDto(loyalty);
  }

  /**
   * Get the currently active loyalty rules
   */
  async getActiveRules() {
    const rules = await this.prisma.loyalty_rule_versions.findFirst({
      where: {
        is_active: true,
        effective_from: { lte: new Date() },
        OR: [{ effective_to: null }, { effective_to: { gte: new Date() } }],
      },
      orderBy: { version_number: 'desc' },
    });

    if (!rules) {
      throw new NotFoundException('No active loyalty rules found');
    }

    return rules;
  }

  /**
   * Earn points from a purchase
   */
  async earnPoints(dto: EarnPointsDto): Promise<EarnPointsResultDto> {
    const { customerId, orderId, orderType, amount, createdBy } = dto;

    // Get customer loyalty
    const loyalty = await this.getOrCreateLoyalty(customerId);
    const rules = await this.getActiveRules();

    // Get tier multiplier
    const tier = await this.prisma.loyalty_tiers.findUnique({
      where: { id: loyalty.current_tier_id ?? undefined },
    });
    const tierMultiplier = tier
      ? Number(tier.points_multiplier)
      : 1.0;

    // Calculate points: floor(amount * points_per_currency * tier_multiplier)
    const basePoints = Math.floor(
      amount * Number(rules.points_per_currency),
    );
    const pointsEarned = Math.floor(basePoints * tierMultiplier);

    if (pointsEarned <= 0) {
      return {
        pointsEarned: 0,
        pointsBalance: loyalty.points_balance,
        tierMultiplier,
        transactionId: '',
        tierUpgraded: false,
      };
    }

    const newBalance = loyalty.points_balance + pointsEarned;
    const newLifetimeEarned = loyalty.points_earned_lifetime + pointsEarned;
    const newTotalSpend = Number(loyalty.total_spend || 0) + amount;

    // Create transaction and update balance
    const transaction = await this.prisma.loyalty_point_transactions.create({
      data: {
        customer_loyalty_id: loyalty.id,
        transaction_type: 'earn',
        points: pointsEarned,
        points_balance_after: newBalance,
        reference_type: orderType || 'sales_order',
        reference_id: orderId,
        rule_version_id: rules.id,
        order_amount: amount,
        reason: `Earned from ${orderType || 'sales_order'} ${orderId ? `#${orderId.slice(0, 8)}` : ''}`,
        created_by: createdBy,
      },
    });

    // Update customer loyalty
    await this.prisma.customer_loyalty.update({
      where: { id: loyalty.id },
      data: {
        points_balance: newBalance,
        points_earned_lifetime: newLifetimeEarned,
        total_spend: newTotalSpend,
      },
    });

    // Evaluate tier upgrade
    const tierResult = await this.evaluateTier(customerId, transaction.id);

    return {
      pointsEarned,
      pointsBalance: newBalance,
      tierMultiplier,
      transactionId: transaction.id,
      tierUpgraded: tierResult.upgraded,
      newTierName: tierResult.newTierName,
    };
  }

  /**
   * Calculate redemption preview for an order
   */
  async calculateRedemption(
    dto: CalculateRedemptionDto,
  ): Promise<RedemptionPreviewDto> {
    const { customerId, orderAmount, pointsToRedeem } = dto;

    const loyalty = await this.getOrCreateLoyalty(customerId);
    const rules = await this.getActiveRules();
    const tier = loyalty.current_tier_id
      ? await this.prisma.loyalty_tiers.findUnique({
          where: { id: loyalty.current_tier_id },
        })
      : null;

    const redemptionRate = Number(rules.redemption_rate);
    const maxRedemptionPercent = Number(rules.max_redemption_percent) / 100;
    const minRedemptionPoints = rules.min_redemption_points ?? 100;

    // Calculate max redeemable based on order amount
    const maxDiscountAmount = Math.floor(orderAmount * maxRedemptionPercent);
    const maxPointsFromOrder = Math.floor(maxDiscountAmount / redemptionRate);
    const maxRedeemablePoints = Math.min(
      maxPointsFromOrder,
      loyalty.points_balance,
    );

    return {
      pointsAvailable: loyalty.points_balance,
      maxRedeemablePoints,
      maxDiscountAmount: maxRedeemablePoints * redemptionRate,
      minRedemptionPoints,
      redemptionRate,
      tierName: tier?.name || 'Iron Rider',
      tierMultiplier: tier ? Number(tier.points_multiplier) : 1.0,
    };
  }

  /**
   * Redeem points for a discount
   */
  async redeemPoints(dto: RedeemPointsDto): Promise<{
    discountAmount: number;
    pointsRedeemed: number;
    pointsBalance: number;
    transactionId: string;
  }> {
    const { customerId, points, orderId, orderType } = dto;

    const loyalty = await this.getOrCreateLoyalty(customerId);
    const rules = await this.getActiveRules();

    const minRedemptionPoints = rules.min_redemption_points ?? 100;
    const redemptionRate = Number(rules.redemption_rate);

    // Validate
    if (points < minRedemptionPoints) {
      throw new BadRequestException(
        `Minimum redemption is ${minRedemptionPoints} points`,
      );
    }

    if (points > loyalty.points_balance) {
      throw new BadRequestException('Insufficient points balance');
    }

    const discountAmount = points * redemptionRate;
    const newBalance = loyalty.points_balance - points;
    const newLifetimeRedeemed = loyalty.points_redeemed_lifetime + points;

    // Create transaction
    const transaction = await this.prisma.loyalty_point_transactions.create({
      data: {
        customer_loyalty_id: loyalty.id,
        transaction_type: 'redeem',
        points: -points,
        points_balance_after: newBalance,
        reference_type: orderType || 'sales_order',
        reference_id: orderId,
        rule_version_id: rules.id,
        order_amount: discountAmount,
        reason: `Redeemed for ${orderType || 'sales_order'} ${orderId ? `#${orderId.slice(0, 8)}` : ''}`,
      },
    });

    // Update balance
    await this.prisma.customer_loyalty.update({
      where: { id: loyalty.id },
      data: {
        points_balance: newBalance,
        points_redeemed_lifetime: newLifetimeRedeemed,
      },
    });

    return {
      discountAmount,
      pointsRedeemed: points,
      pointsBalance: newBalance,
      transactionId: transaction.id,
    };
  }

  /**
   * Reverse points from a cancelled order
   */
  async reversePoints(
    customerId: string,
    orderId: string,
    orderType: string = 'sales_order',
  ): Promise<void> {
    const loyalty = await this.prisma.customer_loyalty.findUnique({
      where: { customer_id: customerId },
    });

    if (!loyalty) return;

    // Find all transactions for this order
    const transactions = await this.prisma.loyalty_point_transactions.findMany({
      where: {
        customer_loyalty_id: loyalty.id,
        reference_id: orderId,
        reference_type: orderType,
        reversed_transaction_id: null, // Not already reversed
      },
    });

    for (const tx of transactions) {
      // Skip if already a reversal
      if (tx.transaction_type === 'reverse') continue;

      const reversePoints = -tx.points; // Opposite of original
      const newBalance = loyalty.points_balance + reversePoints;

      // Create reversal transaction
      await this.prisma.loyalty_point_transactions.create({
        data: {
          customer_loyalty_id: loyalty.id,
          transaction_type: 'reverse',
          points: reversePoints,
          points_balance_after: newBalance,
          reference_type: orderType,
          reference_id: orderId,
          reversed_transaction_id: tx.id,
          reason: `Reversed: Order cancelled`,
        },
      });

      // Update balance
      await this.prisma.customer_loyalty.update({
        where: { id: loyalty.id },
        data: {
          points_balance: newBalance,
          points_earned_lifetime:
            tx.transaction_type === 'earn'
              ? loyalty.points_earned_lifetime - tx.points
              : loyalty.points_earned_lifetime,
          points_redeemed_lifetime:
            tx.transaction_type === 'redeem'
              ? loyalty.points_redeemed_lifetime + tx.points
              : loyalty.points_redeemed_lifetime,
        },
      });
    }
  }

  /**
   * Manually adjust points (admin function)
   */
  async adjustPoints(dto: AdjustPointsDto): Promise<AdjustPointsResultDto> {
    const { customerId, points, adjustmentType, reason, createdBy } = dto;

    const loyalty = await this.getOrCreateLoyalty(customerId);
    const newBalance = loyalty.points_balance + points;

    if (newBalance < 0) {
      throw new BadRequestException(
        'Adjustment would result in negative balance',
      );
    }

    const transaction = await this.prisma.loyalty_point_transactions.create({
      data: {
        customer_loyalty_id: loyalty.id,
        transaction_type: 'adjust',
        points,
        points_balance_after: newBalance,
        reason: `[${adjustmentType}] ${reason}`,
        created_by: createdBy,
      },
    });

    await this.prisma.customer_loyalty.update({
      where: { id: loyalty.id },
      data: {
        points_balance: newBalance,
        points_earned_lifetime:
          points > 0
            ? loyalty.points_earned_lifetime + points
            : loyalty.points_earned_lifetime,
      },
    });

    // Evaluate tier if points were added
    if (points > 0) {
      await this.evaluateTier(customerId, transaction.id);
    }

    return {
      pointsAdjusted: points,
      pointsBalance: newBalance,
      transactionId: transaction.id,
    };
  }

  /**
   * Get loyalty transaction history
   */
  async getTransactionHistory(
    customerId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<LoyaltyHistoryResponseDto> {
    const loyalty = await this.prisma.customer_loyalty.findUnique({
      where: { customer_id: customerId },
    });

    if (!loyalty) {
      return { transactions: [], total: 0, page, limit };
    }

    const [transactions, total] = await Promise.all([
      this.prisma.loyalty_point_transactions.findMany({
        where: { customer_loyalty_id: loyalty.id },
        include: {
          user_profiles: {
            select: { full_name: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.loyalty_point_transactions.count({
        where: { customer_loyalty_id: loyalty.id },
      }),
    ]);

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        transactionType: tx.transaction_type,
        points: tx.points,
        pointsBalanceAfter: tx.points_balance_after,
        referenceType: tx.reference_type ?? undefined,
        referenceId: tx.reference_id ?? undefined,
        orderAmount: tx.order_amount ? Number(tx.order_amount) : undefined,
        reason: tx.reason ?? undefined,
        createdBy: tx.created_by ?? undefined,
        createdByName: tx.user_profiles?.full_name ?? undefined,
        createdAt: tx.created_at!,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Get all loyalty tiers
   */
  async getTiers() {
    return this.prisma.loyalty_tiers.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
    });
  }

  // Private helpers

  private async getOrCreateLoyalty(customerId: string) {
    let loyalty = await this.prisma.customer_loyalty.findUnique({
      where: { customer_id: customerId },
    });

    if (!loyalty) {
      const defaultTier = await this.prisma.loyalty_tiers.findFirst({
        where: { is_active: true },
        orderBy: { min_points: 'asc' },
      });

      loyalty = await this.prisma.customer_loyalty.create({
        data: {
          customer_id: customerId,
          current_tier_id: defaultTier?.id,
          points_balance: 0,
          points_earned_lifetime: 0,
          points_redeemed_lifetime: 0,
          total_spend: 0,
        },
      });
    }

    return loyalty;
  }

  private async evaluateTier(
    customerId: string,
    triggeringTransactionId?: string,
  ): Promise<{ upgraded: boolean; newTierName?: string }> {
    const loyalty = await this.prisma.customer_loyalty.findUnique({
      where: { customer_id: customerId },
      include: { loyalty_tiers: true },
    });

    if (!loyalty) return { upgraded: false };

    const rules = await this.getActiveRules();
    const tiers = await this.prisma.loyalty_tiers.findMany({
      where: { is_active: true },
      orderBy: { min_points: 'desc' },
    });

    // Determine evaluation basis
    const evaluationValue =
      rules.tier_evaluation_basis === 'total_spend'
        ? Number(loyalty.total_spend || 0)
        : loyalty.points_earned_lifetime;

    // Find appropriate tier
    let newTier = tiers.find(
      (t) =>
        evaluationValue >=
        (rules.tier_evaluation_basis === 'total_spend'
          ? Number(t.min_total_spend || 0)
          : t.min_points),
    );

    if (!newTier) {
      newTier = tiers[tiers.length - 1]; // Default to lowest tier
    }

    // Check if tier changed
    if (newTier && newTier.id !== loyalty.current_tier_id) {
      const isUpgrade =
        newTier.min_points > (loyalty.loyalty_tiers?.min_points || 0);

      // Only allow downgrade if rules permit
      if (!isUpgrade && !rules.allow_tier_downgrade) {
        return { upgraded: false };
      }

      // Record tier change
      await this.prisma.loyalty_tier_history.create({
        data: {
          customer_loyalty_id: loyalty.id,
          old_tier_id: loyalty.current_tier_id,
          new_tier_id: newTier.id,
          change_reason: isUpgrade ? 'earned_points' : 'downgrade',
          triggered_by_transaction_id: triggeringTransactionId,
        },
      });

      // Update customer tier
      await this.prisma.customer_loyalty.update({
        where: { id: loyalty.id },
        data: {
          current_tier_id: newTier.id,
          tier_updated_at: new Date(),
        },
      });

      return { upgraded: isUpgrade, newTierName: newTier.name };
    }

    return { upgraded: false };
  }

  private async mapToCustomerLoyaltyDto(loyalty: any): Promise<CustomerLoyaltyDto> {
    const tiers = await this.prisma.loyalty_tiers.findMany({
      where: { is_active: true },
      orderBy: { min_points: 'asc' },
    });

    const currentTier = loyalty.loyalty_tiers;
    const nextTier = currentTier
      ? tiers.find((t) => t.min_points > currentTier.min_points)
      : tiers[0];

    const pointsToNextTier = nextTier
      ? Math.max(0, nextTier.min_points - loyalty.points_earned_lifetime)
      : undefined;

    return {
      id: loyalty.id,
      customerId: loyalty.customer_id,
      customerName: loyalty.customers.full_name,
      customerPhone: loyalty.customers.phone,
      tier: currentTier
        ? {
            id: currentTier.id,
            code: currentTier.code,
            name: currentTier.name,
            pointsMultiplier: Number(currentTier.points_multiplier),
            minPoints: currentTier.min_points,
          }
        : null,
      pointsBalance: loyalty.points_balance,
      pointsEarnedLifetime: loyalty.points_earned_lifetime,
      pointsRedeemedLifetime: loyalty.points_redeemed_lifetime,
      totalSpend: Number(loyalty.total_spend || 0),
      pointsToNextTier,
      nextTierName: nextTier?.name,
      tierUpdatedAt: loyalty.tier_updated_at ?? undefined,
      createdAt: loyalty.created_at!,
    };
  }
}
