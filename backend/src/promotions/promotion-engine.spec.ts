import {
  checkVoucher,
  EngineLine,
  EnginePromotion,
  evaluatePromotions,
  promotionEligible,
  PromotionConditions,
  VoucherRule,
} from './promotion-engine';

const line = (
  key: string,
  unitPrice: number,
  quantity: number,
  over: Partial<EngineLine> = {},
): EngineLine => ({
  key,
  productId: key,
  variantId: null,
  categoryId: null,
  brandId: null,
  unitPrice,
  manualDiscount: 0,
  quantity,
  ...over,
});

const promo = (over: Partial<EnginePromotion>): EnginePromotion => ({
  id: over.code ?? 'p',
  code: 'P',
  name: 'P',
  type: 'line_discount',
  priority: 0,
  combinable: true,
  discountKind: null,
  discountValue: null,
  maxDiscount: null,
  minOrderAmount: null,
  buyQuantity: null,
  getQuantity: null,
  getDiscountPercent: null,
  bundlePrice: null,
  targets: [],
  ...over,
});

const gloves20 = promo({
  code: 'GLOVES20',
  discountKind: 'percent',
  discountValue: 20,
  targets: [
    { role: 'target', type: 'category', id: 'cat-gloves', quantity: 1 },
  ],
});
const buy2get1 = promo({
  code: 'B2G1',
  type: 'buy_x_get_y',
  buyQuantity: 2,
  getQuantity: 1,
  getDiscountPercent: 100,
  targets: [{ role: 'target', type: 'product', id: 'sticker', quantity: 1 }],
});
const order300 = promo({
  code: 'ORDER300',
  type: 'order_discount',
  discountKind: 'amount',
  discountValue: 300_000,
  minOrderAmount: 5_000_000,
});

describe('promotion engine', () => {
  it('category percent: gloves 500,000 −20% = 100,000', () => {
    const r = evaluatePromotions(
      [line('gloves', 500_000, 1, { categoryId: 'cat-gloves' })],
      [gloves20],
    );
    expect(r.byLine.get('gloves')).toBe(100_000);
  });

  it('order minimum: 5,200,000 → 300,000 off; 4,900,000 → nothing', () => {
    expect(
      evaluatePromotions([line('a', 5_200_000, 1)], [order300]).orderTotal,
    ).toBe(300_000);
    expect(
      evaluatePromotions([line('a', 4_900_000, 1)], [order300]).orderTotal,
    ).toBe(0);
  });

  it('buy 2 get 1: 3 → 1 free, 5 → 1, 6 → 2', () => {
    const free = (n: number) =>
      evaluatePromotions([line('sticker', 50_000, n)], [buy2get1]).lineTotal;
    expect([free(2), free(3), free(5), free(6)]).toEqual([
      0, 50_000, 50_000, 100_000,
    ]);
  });

  it('buy X get Y across sets rewards the cheapest get units', () => {
    const p = promo({
      code: 'HELMET_GLOVE',
      type: 'buy_x_get_y',
      buyQuantity: 1,
      getQuantity: 1,
      getDiscountPercent: 50,
      targets: [
        { role: 'buy', type: 'product', id: 'helmet', quantity: 1 },
        { role: 'get', type: 'category', id: 'cat-gloves', quantity: 1 },
      ],
    });
    const r = evaluatePromotions(
      [
        line('helmet', 2_000_000, 1),
        line('g1', 500_000, 1, { categoryId: 'cat-gloves' }),
        line('g2', 300_000, 1, { categoryId: 'cat-gloves' }),
      ],
      [p],
    );
    expect([...r.byLine.entries()]).toEqual([['g2', 150_000]]);
  });

  it('bundle helmet + gloves at 2,200,000 with 1 helmet and 2 gloves: 300,000 shared by value', () => {
    const p = promo({
      code: 'COMBO',
      type: 'bundle',
      bundlePrice: 2_200_000,
      targets: [
        { role: 'bundle', type: 'product', id: 'helmet', quantity: 1 },
        { role: 'bundle', type: 'product', id: 'gloves', quantity: 1 },
      ],
    });
    const r = evaluatePromotions(
      [line('helmet', 2_000_000, 1), line('gloves', 500_000, 2)],
      [p],
    );
    expect(r.lineTotal).toBe(300_000);
    expect(r.byLine.get('helmet')).toBe(240_000);
    expect(r.byLine.get('gloves')).toBe(60_000);
  });

  it('one line promotion per line: jeans 10% vs 150,000 off → 150,000', () => {
    const t = [
      {
        role: 'target' as const,
        type: 'product' as const,
        id: 'jeans',
        quantity: 1,
      },
    ];
    const r = evaluatePromotions(
      [line('jeans', 1_000_000, 1)],
      [
        promo({
          code: 'A',
          discountKind: 'percent',
          discountValue: 10,
          targets: t,
        }),
        promo({
          code: 'B',
          discountKind: 'amount',
          discountValue: 150_000,
          targets: t,
        }),
      ],
    );
    expect(r.line.map((a) => a.promotion.code)).toEqual(['B']);
    expect(r.lineTotal).toBe(150_000);
  });

  it('non-combinable order promotion of 300,000 beats 200,000 of line promotions', () => {
    const lines = [line('jeans', 2_000_000, 1), line('helmet', 3_500_000, 1)];
    const linePromo = promo({
      code: 'L',
      discountKind: 'amount',
      discountValue: 200_000,
      targets: [{ role: 'target', type: 'product', id: 'jeans', quantity: 1 }],
    });
    const r = evaluatePromotions(lines, [
      linePromo,
      { ...order300, combinable: false },
    ]);
    expect([r.lineTotal, r.orderTotal]).toEqual([0, 300_000]);
    const both = evaluatePromotions(lines, [linePromo, order300]);
    expect([both.lineTotal, both.orderTotal]).toEqual([200_000, 300_000]);
  });

  it('max discount caps a percent promotion', () => {
    const p = promo({
      code: 'CAP',
      discountKind: 'percent',
      discountValue: 50,
      maxDiscount: 100_000,
      targets: [{ role: 'target', type: 'brand', id: 'b', quantity: 1 }],
    });
    const r = evaluatePromotions(
      [
        line('a', 300_000, 1, { brandId: 'b' }),
        line('c', 100_000, 1, { brandId: 'b' }),
      ],
      [p],
    );
    expect(r.lineTotal).toBe(100_000);
    expect(r.byLine.get('a')).toBe(75_000);
  });

  it('fixed price and manual line discount come first', () => {
    const p = promo({
      code: 'FIX',
      discountKind: 'fixed_price',
      discountValue: 700_000,
      targets: [{ role: 'target', type: 'product', id: 'jeans', quantity: 1 }],
    });
    const r = evaluatePromotions(
      [line('jeans', 1_000_000, 2, { manualDiscount: 100_000 })],
      [p],
    );
    expect(r.lineTotal).toBe(400_000);
  });
});

describe('promotion conditions', () => {
  const base: PromotionConditions = {
    is_active: true,
    start_at: null,
    end_at: null,
    days_of_week: null,
    time_from: null,
    time_to: null,
    all_stores: true,
    store_ids: [],
    all_customers: true,
    group_ids: [],
    channels: null,
  };
  // Saturday 2027-01-09 16:30 and 17:30 Vietnam time
  const sat1630 = new Date('2027-01-09T09:30:00Z');
  const sat1730 = new Date('2027-01-09T10:30:00Z');

  it('happy hour Saturday 17:00–20:00', () => {
    const c = {
      ...base,
      days_of_week: [6],
      time_from: '17:00',
      time_to: '20:00',
    };
    expect(promotionEligible(c, { at: sat1630, customerGroupIds: [] })).toBe(
      false,
    );
    expect(promotionEligible(c, { at: sat1730, customerGroupIds: [] })).toBe(
      true,
    );
    expect(
      promotionEligible(
        { ...c, days_of_week: [0] },
        { at: sat1730, customerGroupIds: [] },
      ),
    ).toBe(false);
  });

  it('customer group, branch and channel', () => {
    const vip = { ...base, all_customers: false, group_ids: ['vip'] };
    expect(promotionEligible(vip, { at: sat1730, customerGroupIds: [] })).toBe(
      false,
    );
    expect(
      promotionEligible(vip, { at: sat1730, customerGroupIds: ['vip'] }),
    ).toBe(true);
    expect(
      promotionEligible(
        { ...base, all_stores: false, store_ids: ['hn'] },
        { at: sat1730, storeId: 'hcm', customerGroupIds: [] },
      ),
    ).toBe(false);
    expect(
      promotionEligible(
        { ...base, channels: ['pos'] },
        { at: sat1730, channel: 'retail_store', customerGroupIds: [] },
      ),
    ).toBe(false);
  });
});

describe('vouchers', () => {
  const v: VoucherRule = {
    code: 'TET27ABC',
    voucherActive: true,
    campaignActive: true,
    start_at: null,
    end_at: null,
    all_stores: true,
    store_ids: [],
    channels: null,
    min_order_amount: 1_000_000,
    uses_per_code: 1,
    used_count: 0,
    uses_per_customer: null,
    customer_uses: 0,
    combinable_with_promotions: true,
    discount_kind: 'percent',
    discount_value: 10,
    max_discount: 200_000,
  };
  const ctx = { at: new Date(), base: 3_000_000, promotionsApplied: false };

  it('capped percent: 10% of 3,000,000 capped at 200,000', () => {
    expect(checkVoucher(v, ctx)).toEqual({ ok: true, amount: 200_000 });
  });

  it('reasons: minimum, used, promotions, customer, expired', () => {
    expect(checkVoucher(v, { ...ctx, base: 800_000 })).toEqual({
      ok: false,
      reason: 'Đơn tối thiểu 1.000.000 đ',
    });
    expect(checkVoucher({ ...v, used_count: 1 }, ctx)).toMatchObject({
      ok: false,
      reason: 'Mã đã được sử dụng hết lượt',
    });
    expect(
      checkVoucher(
        { ...v, combinable_with_promotions: false },
        { ...ctx, promotionsApplied: true },
      ),
    ).toMatchObject({ ok: false });
    expect(checkVoucher({ ...v, uses_per_customer: 1 }, ctx)).toMatchObject({
      ok: false,
      reason: 'Mã cần chọn khách hàng',
    });
    expect(
      checkVoucher({ ...v, end_at: new Date(Date.now() - 1000) }, ctx),
    ).toMatchObject({ ok: false, reason: 'Mã đã hết hạn' });
  });

  it('fixed amount never exceeds the base', () => {
    expect(
      checkVoucher(
        {
          ...v,
          discount_kind: 'amount',
          discount_value: 500_000,
          min_order_amount: null,
          max_discount: null,
        },
        { ...ctx, base: 300_000 },
      ),
    ).toEqual({ ok: true, amount: 300_000 });
  });
});
