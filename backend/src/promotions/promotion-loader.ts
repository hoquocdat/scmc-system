import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DiscountKind,
  EnginePromotion,
  EngineTarget,
  promotionEligible,
  PromotionType,
  VoucherRule,
} from './promotion-engine';

type Db = Prisma.TransactionClient;

const num = (v: Prisma.Decimal | number | null | undefined) =>
  v == null ? null : Number(v);
/** TIME columns arrive as 1970-01-01T…Z dates. */
const hhmm = (d: Date | null) => (d ? d.toISOString().slice(11, 16) : null);

export class VoucherRejectedException extends UnprocessableEntityException {
  constructor(code: string, reason: string) {
    super({
      code: 'VOUCHER_REJECTED',
      message: `Mã ${code}: ${reason}`,
      voucher_code: code,
      reason,
    });
  }
}

export class TotalChangedException extends ConflictException {
  constructor(
    expected: number,
    total: number,
    breakdown: Record<string, unknown>,
  ) {
    super({
      code: 'TOTAL_CHANGED',
      message: `Tổng tiền đã thay đổi: ${expected.toLocaleString('vi-VN')} → ${total.toLocaleString('vi-VN')} đ`,
      expected_total: expected,
      total,
      breakdown,
    });
  }
}

export interface SaleScope {
  at: Date;
  storeId?: string | null;
  customerId?: string | null;
  channel?: string | null;
}

export async function activeGroupsOf(
  db: Db,
  customerId?: string | null,
): Promise<string[]> {
  if (!customerId) return [];
  const rows = await db.customer_group_members.findMany({
    where: { customer_id: customerId, customer_groups: { is_active: true } },
    select: { group_id: true },
  });
  return rows.map((r) => r.group_id);
}

/** Promotions eligible for this sale (D3 conditions). */
export async function loadPromotions(
  db: Db,
  scope: SaleScope,
): Promise<EnginePromotion[]> {
  const rows = await db.promotions.findMany({
    where: {
      is_active: true,
      AND: [
        { OR: [{ start_at: null }, { start_at: { lte: scope.at } }] },
        { OR: [{ end_at: null }, { end_at: { gte: scope.at } }] },
      ],
    },
    include: {
      promotion_targets: true,
      promotion_stores: { select: { store_id: true } },
      promotion_customer_groups: {
        select: {
          group_id: true,
          customer_groups: { select: { is_active: true } },
        },
      },
    },
  });
  if (!rows.length) return [];
  const customerGroupIds = await activeGroupsOf(db, scope.customerId);
  return rows
    .filter((r) =>
      promotionEligible(
        {
          is_active: r.is_active,
          start_at: r.start_at,
          end_at: r.end_at,
          days_of_week: r.days_of_week?.length ? r.days_of_week : null,
          time_from: hhmm(r.time_from),
          time_to: hhmm(r.time_to),
          all_stores: r.all_stores,
          store_ids: r.promotion_stores.map((s) => s.store_id),
          all_customers: r.all_customers,
          group_ids: r.promotion_customer_groups
            .filter((g) => g.customer_groups.is_active)
            .map((g) => g.group_id),
          channels: r.channels?.length ? r.channels : null,
        },
        {
          at: scope.at,
          storeId: scope.storeId,
          customerGroupIds,
          channel: scope.channel,
        },
      ),
    )
    .map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type as PromotionType,
      priority: r.priority,
      combinable: r.combinable,
      discountKind: r.discount_kind as DiscountKind | null,
      discountValue: num(r.discount_value),
      maxDiscount: num(r.max_discount),
      minOrderAmount: num(r.min_order_amount),
      buyQuantity: r.buy_quantity,
      getQuantity: r.get_quantity,
      getDiscountPercent: num(r.get_discount_percent),
      bundlePrice: num(r.bundle_price),
      targets: r.promotion_targets.map((t) => ({
        role: t.role as EngineTarget['role'],
        type: t.target_type as EngineTarget['type'],
        id: t.target_id,
        quantity: t.quantity,
      })),
    }));
}

/** Category and brand of each product, for promotion targets. */
export async function productAttributes(db: Db, productIds: string[]) {
  const rows = await db.products.findMany({
    where: { id: { in: productIds } },
    select: { id: true, category_id: true, brand_id: true },
  });
  return new Map(
    rows.map((r) => [r.id, { categoryId: r.category_id, brandId: r.brand_id }]),
  );
}

export interface LoadedVoucher {
  voucherId: string;
  campaignId: string;
  code: string;
  campaignName: string;
  rule: VoucherRule;
}

/** A voucher and its campaign as a rule for `checkVoucher`; null when the code does not exist. */
export async function loadVoucher(
  db: Db,
  rawCode: string,
  customerId?: string | null,
): Promise<LoadedVoucher | null> {
  const code = rawCode.trim().toUpperCase();
  const v = await db.vouchers.findFirst({
    where: { code },
    include: {
      voucher_campaigns: {
        include: { voucher_campaign_stores: { select: { store_id: true } } },
      },
    },
  });
  if (!v) return null;
  const c = v.voucher_campaigns;
  const customerUses = customerId
    ? await db.voucher_redemptions.count({
        where: {
          campaign_id: c.id,
          customer_id: customerId,
          status: 'applied',
        },
      })
    : 0;
  return {
    voucherId: v.id,
    campaignId: c.id,
    code,
    campaignName: c.name,
    rule: {
      code,
      voucherActive: v.is_active,
      campaignActive: c.is_active,
      start_at: c.start_at,
      end_at: c.end_at,
      all_stores: c.all_stores,
      store_ids: c.voucher_campaign_stores.map((s) => s.store_id),
      channels: c.channels?.length ? c.channels : null,
      min_order_amount: num(c.min_order_amount),
      uses_per_code: c.uses_per_code,
      used_count: v.used_count,
      uses_per_customer: c.uses_per_customer,
      customer_uses: customerUses,
      combinable_with_promotions: c.combinable_with_promotions,
      discount_kind: c.discount_kind as 'percent' | 'amount',
      discount_value: Number(c.discount_value),
      max_discount: num(c.max_discount),
    },
  };
}

/** Records a voucher use in the posting transaction; the voucher row lock serialises concurrent uses (D5). */
export async function redeemVoucher(
  tx: Db,
  input: {
    voucherId: string;
    campaignId: string;
    orderId: string;
    customerId: string | null;
    amount: number;
    code: string;
  },
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM vouchers WHERE id = ${input.voucherId}::uuid FOR UPDATE`;
  const v = await tx.vouchers.findFirstOrThrow({
    where: { id: input.voucherId },
    include: { voucher_campaigns: true },
  });
  if (v.used_count >= v.voucher_campaigns.uses_per_code)
    throw new VoucherRejectedException(
      input.code,
      'Mã đã được sử dụng hết lượt',
    );
  const perCustomer = v.voucher_campaigns.uses_per_customer;
  if (perCustomer != null && input.customerId) {
    const used = await tx.voucher_redemptions.count({
      where: {
        campaign_id: input.campaignId,
        customer_id: input.customerId,
        status: 'applied',
      },
    });
    if (used >= perCustomer)
      throw new VoucherRejectedException(
        input.code,
        'Khách đã dùng hết lượt của chương trình này',
      );
  }
  await tx.voucher_redemptions.create({
    data: {
      voucher_id: input.voucherId,
      campaign_id: input.campaignId,
      sales_order_id: input.orderId,
      customer_id: input.customerId,
      amount: new Prisma.Decimal(input.amount),
    },
  });
  await tx.vouchers.update({
    where: { id: input.voucherId },
    data: { used_count: { increment: 1 } },
  });
}

/** Cancelling an order gives its voucher use back (D5). */
export async function releaseVouchers(tx: Db, orderId: string): Promise<void> {
  const used = await tx.voucher_redemptions.findMany({
    where: { sales_order_id: orderId, status: 'applied' },
  });
  for (const r of used) {
    await tx.voucher_redemptions.update({
      where: { id: r.id },
      data: { status: 'released', released_at: new Date() },
    });
    await tx.vouchers.update({
      where: { id: r.voucher_id },
      data: { used_count: { decrement: 1 } },
    });
  }
}
