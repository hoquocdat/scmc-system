import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTierDto,
  UpdateTierDto,
  CreateRuleVersionDto,
  LoyaltyStatsDto,
  LoyaltyMemberQueryDto,
  AdjustPointsDto,
  AdjustPointsResultDto,
} from './dto';
import { LoyaltyService } from './loyalty.service';

@Injectable()
export class LoyaltyAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  /**
   * Get loyalty program statistics
   */
  async getStats(): Promise<LoyaltyStatsDto> {
    const [
      totalMembers,
      aggregates,
      membersByTier,
      recentTransactions,
    ] = await Promise.all([
      this.prisma.customer_loyalty.count(),
      this.prisma.customer_loyalty.aggregate({
        _sum: {
          points_balance: true,
          points_earned_lifetime: true,
          points_redeemed_lifetime: true,
        },
      }),
      this.prisma.$queryRaw<{ tier_name: string; count: bigint }[]>`
        SELECT
          COALESCE(lt.name, 'No Tier') as tier_name,
          COUNT(cl.id)::bigint as count
        FROM customer_loyalty cl
        LEFT JOIN loyalty_tiers lt ON cl.current_tier_id = lt.id
        GROUP BY lt.name, lt.display_order
        ORDER BY lt.display_order ASC NULLS LAST
      `,
      this.prisma.loyalty_point_transactions.count({
        where: {
          created_at: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    ]);

    return {
      totalMembers,
      totalPointsIssued: aggregates._sum.points_earned_lifetime || 0,
      totalPointsRedeemed: aggregates._sum.points_redeemed_lifetime || 0,
      totalPointsBalance: aggregates._sum.points_balance || 0,
      membersByTier: membersByTier.map((row) => ({
        tierName: row.tier_name,
        count: Number(row.count),
      })),
      recentTransactions,
    };
  }

  /**
   * List all loyalty members with filtering
   */
  async getMembers(query: LoyaltyMemberQueryDto) {
    const {
      search,
      tierId,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = query;

    const where: any = {};

    if (tierId) {
      where.current_tier_id = tierId;
    }

    if (search) {
      where.customers = {
        OR: [
          { full_name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      };
    }

    const [members, total] = await Promise.all([
      this.prisma.customer_loyalty.findMany({
        where,
        include: {
          customers: {
            select: {
              id: true,
              full_name: true,
              phone: true,
              email: true,
            },
          },
          loyalty_tiers: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer_loyalty.count({ where }),
    ]);

    return {
      data: members.map((m) => ({
        id: m.id,
        customerId: m.customer_id,
        customerName: m.customers.full_name,
        customerPhone: m.customers.phone,
        customerEmail: m.customers.email,
        tier: m.loyalty_tiers
          ? { id: m.loyalty_tiers.id, code: m.loyalty_tiers.code, name: m.loyalty_tiers.name }
          : null,
        pointsBalance: m.points_balance,
        pointsEarnedLifetime: m.points_earned_lifetime,
        pointsRedeemedLifetime: m.points_redeemed_lifetime,
        totalSpend: Number(m.total_spend || 0),
        createdAt: m.created_at,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a new tier
   */
  async createTier(dto: CreateTierDto) {
    const existing = await this.prisma.loyalty_tiers.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Tier with code "${dto.code}" already exists`);
    }

    return this.prisma.loyalty_tiers.create({
      data: {
        code: dto.code,
        name: dto.name,
        display_order: dto.displayOrder,
        min_points: dto.minPoints,
        min_total_spend: dto.minTotalSpend,
        points_multiplier: dto.pointsMultiplier,
        benefits: dto.benefits,
        is_active: dto.isActive ?? true,
      },
    });
  }

  /**
   * Update a tier
   */
  async updateTier(id: string, dto: UpdateTierDto) {
    const existing = await this.prisma.loyalty_tiers.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Tier not found');
    }

    return this.prisma.loyalty_tiers.update({
      where: { id },
      data: {
        name: dto.name,
        display_order: dto.displayOrder,
        min_points: dto.minPoints,
        min_total_spend: dto.minTotalSpend,
        points_multiplier: dto.pointsMultiplier,
        benefits: dto.benefits,
        is_active: dto.isActive,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Delete a tier (soft delete by setting is_active = false)
   */
  async deleteTier(id: string) {
    const existing = await this.prisma.loyalty_tiers.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Tier not found');
    }

    // Check if any customers are on this tier
    const customersOnTier = await this.prisma.customer_loyalty.count({
      where: { current_tier_id: id },
    });

    if (customersOnTier > 0) {
      throw new ConflictException(
        `Cannot delete tier with ${customersOnTier} active customers. Deactivate instead.`,
      );
    }

    return this.prisma.loyalty_tiers.update({
      where: { id },
      data: { is_active: false },
    });
  }

  /**
   * Get all rule versions
   */
  async getRuleVersions() {
    return this.prisma.loyalty_rule_versions.findMany({
      orderBy: { version_number: 'desc' },
      include: {
        user_profiles: {
          select: { full_name: true },
        },
      },
    });
  }

  /**
   * Create a new rule version
   */
  async createRuleVersion(dto: CreateRuleVersionDto, createdBy?: string) {
    // Get next version number
    const lastVersion = await this.prisma.loyalty_rule_versions.findFirst({
      orderBy: { version_number: 'desc' },
    });
    const nextVersion = (lastVersion?.version_number || 0) + 1;

    // If new version is active, deactivate previous active versions
    if (dto.isActive) {
      await this.prisma.loyalty_rule_versions.updateMany({
        where: { is_active: true },
        data: { is_active: false, effective_to: new Date() },
      });
    }

    return this.prisma.loyalty_rule_versions.create({
      data: {
        version_number: nextVersion,
        points_per_currency: dto.pointsPerCurrency,
        earning_round_mode: dto.earningRoundMode || 'floor',
        redemption_rate: dto.redemptionRate,
        max_redemption_percent: dto.maxRedemptionPercent ?? 50,
        min_redemption_points: dto.minRedemptionPoints ?? 100,
        allow_tier_downgrade: dto.allowTierDowngrade ?? false,
        tier_evaluation_basis: dto.tierEvaluationBasis || 'lifetime_points',
        is_active: dto.isActive ?? true,
        effective_from: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        effective_to: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        notes: dto.notes,
        created_by: createdBy,
      },
    });
  }

  /**
   * Activate a specific rule version
   */
  async activateRuleVersion(id: string) {
    const version = await this.prisma.loyalty_rule_versions.findUnique({
      where: { id },
    });

    if (!version) {
      throw new NotFoundException('Rule version not found');
    }

    // Deactivate all other versions
    await this.prisma.loyalty_rule_versions.updateMany({
      where: { is_active: true },
      data: { is_active: false, effective_to: new Date() },
    });

    // Activate this version
    return this.prisma.loyalty_rule_versions.update({
      where: { id },
      data: { is_active: true, effective_from: new Date(), effective_to: null },
    });
  }

  /**
   * Manually adjust customer points (admin function)
   */
  async adjustPoints(dto: AdjustPointsDto): Promise<AdjustPointsResultDto> {
    return this.loyaltyService.adjustPoints(dto);
  }

  /**
   * Get tier change history for a customer
   */
  async getTierHistory(customerId: string) {
    const loyalty = await this.prisma.customer_loyalty.findUnique({
      where: { customer_id: customerId },
    });

    if (!loyalty) {
      throw new NotFoundException('Customer loyalty record not found');
    }

    return this.prisma.loyalty_tier_history.findMany({
      where: { customer_loyalty_id: loyalty.id },
      include: {
        loyalty_tiers_loyalty_tier_history_old_tier_idToloyalty_tiers: {
          select: { code: true, name: true },
        },
        loyalty_tiers_loyalty_tier_history_new_tier_idToloyalty_tiers: {
          select: { code: true, name: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
