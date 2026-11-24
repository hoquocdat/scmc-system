/**
 * Promotion and voucher rules (change promotions-vouchers, design D3–D5).
 * Pure functions, amounts in whole đồng.
 */

export type PromotionType =
  | 'line_discount'
  | 'order_discount'
  | 'buy_x_get_y'
  | 'bundle';
export type DiscountKind = 'percent' | 'amount' | 'fixed_price';

export interface EngineLine {
  key: string;
  productId: string;
  variantId: string | null;
  categoryId: string | null;
  brandId: string | null;
  /** Unit price after price books. */
  unitPrice: number;
  /** Manual per-unit line discount. */
  manualDiscount: number;
  quantity: number;
}

export interface EngineTarget {
  role: 'target' | 'buy' | 'get' | 'bundle';
  type: 'product' | 'variant' | 'category' | 'brand';
  id: string;
  quantity: number;
}

export interface EnginePromotion {
  id: string;
  code: string;
  name: string;
  type: PromotionType;
  priority: number;
  combinable: boolean;
  discountKind: DiscountKind | null;
  discountValue: number | null;
  maxDiscount: number | null;
  minOrderAmount: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  getDiscountPercent: number | null;
  bundlePrice: number | null;
  targets: EngineTarget[];
}

export interface AppliedPromotion {
  promotion: EnginePromotion;
  total: number;
  /** Discount per line key; empty for an order promotion. */
  perLine: Map<string, number>;
}

export interface EngineResult {
  line: AppliedPromotion[];
  order: AppliedPromotion | null;
  /** Total line promotion discount per line key. */
  byLine: Map<string, number>;
  lineTotal: number;
  orderTotal: number;
}

const unitNet = (l: EngineLine) => Math.max(0, l.unitPrice - l.manualDiscount);
const lineValue = (l: EngineLine) => Math.round(unitNet(l) * l.quantity);

export function matches(l: EngineLine, t: EngineTarget): boolean {
  switch (t.type) {
    case 'product':
      return l.productId === t.id;
    case 'variant':
      return l.variantId === t.id;
    case 'category':
      return l.categoryId === t.id;
    case 'brand':
      return l.brandId === t.id;
  }
}

/** Splits `total` over keys in proportion to weights (largest remainder; exact sum). */
export function spread(
  total: number,
  weights: Map<string, number>,
): Map<string, number> {
  const entries = [...weights.entries()].filter(([, w]) => w > 0);
  const sum = entries.reduce((s, [, w]) => s + w, 0);
  const out = new Map<string, number>();
  if (sum <= 0 || total <= 0) return out;
  const exact = entries.map(([k, w]) => ({ k, x: (total * w) / sum }));
  const floors = exact.map((e) => Math.floor(e.x));
  let left = Math.round(total) - floors.reduce((s, x) => s + x, 0);
  const order = exact
    .map((e, i) => ({ i, f: e.x - Math.floor(e.x) }))
    .sort((a, b) => b.f - a.f || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  exact.forEach((e, i) => floors[i] > 0 && out.set(e.k, floors[i]));
  return out;
}

const sumMap = (m: Map<string, number>) =>
  [...m.values()].reduce((s, x) => s + x, 0);

function capped(
  p: EnginePromotion,
  perLine: Map<string, number>,
): Map<string, number> {
  const total = sumMap(perLine);
  if (p.maxDiscount == null || total <= p.maxDiscount) return perLine;
  return spread(p.maxDiscount, perLine);
}

function lineDiscount(
  p: EnginePromotion,
  lines: EngineLine[],
): Map<string, number> {
  const targets = p.targets.filter((t) => t.role === 'target');
  const v = p.discountValue ?? 0;
  const perLine = new Map<string, number>();
  for (const l of lines) {
    if (!targets.some((t) => matches(l, t))) continue;
    const net = unitNet(l);
    let d = 0;
    if (p.discountKind === 'percent') d = Math.round((lineValue(l) * v) / 100);
    else if (p.discountKind === 'amount')
      d = Math.round(Math.min(v, net) * l.quantity);
    else if (p.discountKind === 'fixed_price')
      d = Math.round(Math.max(0, net - v) * l.quantity);
    if (d > 0) perLine.set(l.key, Math.min(d, lineValue(l)));
  }
  return capped(p, perLine);
}

function buyXGetY(
  p: EnginePromotion,
  lines: EngineLine[],
): Map<string, number> {
  const x = p.buyQuantity ?? 0;
  const y = p.getQuantity ?? 0;
  const pct = p.getDiscountPercent ?? 0;
  if (x <= 0 || y <= 0 || pct <= 0) return new Map();
  const buyT = p.targets.filter((t) => t.role === 'buy' || t.role === 'target');
  const getT = p.targets.filter((t) => t.role === 'get');
  const inBuy = lines.filter((l) => buyT.some((t) => matches(l, t)));
  const inGet = getT.length
    ? lines.filter((l) => getT.some((t) => matches(l, t)))
    : inBuy;
  const same =
    !getT.length ||
    (inGet.length === inBuy.length && inGet.every((l) => inBuy.includes(l)));
  const nBuy = inBuy.reduce((s, l) => s + l.quantity, 0);
  const nGet = inGet.reduce((s, l) => s + l.quantity, 0);
  const rewards = same
    ? Math.floor(nBuy / (x + y)) * y
    : Math.min(Math.floor(nBuy / x) * y, nGet);
  if (rewards <= 0) return new Map();
  const units = inGet
    .flatMap((l) =>
      Array.from({ length: l.quantity }, () => ({
        key: l.key,
        price: unitNet(l),
      })),
    )
    .sort((a, b) => a.price - b.price);
  const perLine = new Map<string, number>();
  for (const u of units.slice(0, rewards)) {
    perLine.set(
      u.key,
      (perLine.get(u.key) ?? 0) + Math.round((u.price * pct) / 100),
    );
  }
  return perLine;
}

function bundle(p: EnginePromotion, lines: EngineLine[]): Map<string, number> {
  const comps = p.targets.filter((t) => t.role === 'bundle');
  if (!comps.length || p.bundlePrice == null) return new Map();
  const matchesOf = comps.map((c) => lines.filter((l) => matches(l, c)));
  const k = Math.min(
    ...comps.map((c, i) =>
      Math.floor(matchesOf[i].reduce((s, l) => s + l.quantity, 0) / c.quantity),
    ),
  );
  if (!(k > 0)) return new Map();
  const consumed = new Map<string, number>();
  let value = 0;
  comps.forEach((c, i) => {
    let need = c.quantity * k;
    for (const l of [...matchesOf[i]].sort((a, b) => unitNet(a) - unitNet(b))) {
      if (need <= 0) break;
      const take = Math.min(need, l.quantity);
      need -= take;
      consumed.set(l.key, (consumed.get(l.key) ?? 0) + take * unitNet(l));
      value += take * unitNet(l);
    }
  });
  const discount = Math.round(Math.max(0, value - p.bundlePrice * k));
  return spread(discount, consumed);
}

/** One line-level promotion evaluated alone on the cart. */
export function evaluateLinePromotion(
  p: EnginePromotion,
  lines: EngineLine[],
): AppliedPromotion | null {
  const perLine =
    p.type === 'line_discount'
      ? lineDiscount(p, lines)
      : p.type === 'buy_x_get_y'
        ? buyXGetY(p, lines)
        : p.type === 'bundle'
          ? bundle(p, lines)
          : new Map<string, number>();
  const total = sumMap(perLine);
  return total > 0 ? { promotion: p, total, perLine } : null;
}

/** Order promotion on an amount (after line promotions). */
export function evaluateOrderPromotion(
  p: EnginePromotion,
  amount: number,
): AppliedPromotion | null {
  if (p.type !== 'order_discount' || amount <= 0) return null;
  if (p.minOrderAmount != null && amount < p.minOrderAmount) return null;
  const v = p.discountValue ?? 0;
  let total =
    p.discountKind === 'percent'
      ? Math.round((amount * v) / 100)
      : Math.round(v);
  if (p.maxDiscount != null) total = Math.min(total, p.maxDiscount);
  total = Math.min(total, amount);
  return total > 0 ? { promotion: p, total, perLine: new Map() } : null;
}

const better = (a: AppliedPromotion, b: AppliedPromotion) =>
  b.total - a.total ||
  b.promotion.priority - a.promotion.priority ||
  a.promotion.code.localeCompare(b.promotion.code);

function bestOrder(
  promotions: EnginePromotion[],
  amount: number,
): AppliedPromotion | null {
  const c = promotions
    .map((p) => evaluateOrderPromotion(p, amount))
    .filter((x): x is AppliedPromotion => !!x);
  return c.sort(better)[0] ?? null;
}

/**
 * Applies eligible promotions (D3): each line gets its best line promotion
 * (best first, one per line), then the best order promotion on what is left;
 * a non-combinable promotion keeps only the better side.
 */
export function evaluatePromotions(
  lines: EngineLine[],
  promotions: EnginePromotion[],
): EngineResult {
  const lineCandidates = promotions
    .filter((p) => p.type !== 'order_discount')
    .map((p) => evaluateLinePromotion(p, lines))
    .filter((x): x is AppliedPromotion => !!x)
    .sort(better);
  const used = new Set<string>();
  const applied: AppliedPromotion[] = [];
  for (const c of lineCandidates) {
    if ([...c.perLine.keys()].some((k) => used.has(k))) continue;
    applied.push(c);
    c.perLine.forEach((_, k) => used.add(k));
  }
  const gross = lines.reduce((s, l) => s + lineValue(l), 0);
  const lineTotal = applied.reduce((s, a) => s + a.total, 0);
  const orderPromos = promotions.filter((p) => p.type === 'order_discount');
  let order = bestOrder(orderPromos, gross - lineTotal);
  let line = applied;
  if (
    order &&
    (!order.promotion.combinable ||
      applied.some((a) => !a.promotion.combinable))
  ) {
    const alone = bestOrder(orderPromos, gross);
    if (alone && alone.total > lineTotal) {
      line = [];
      order = alone;
    } else {
      order = null;
    }
  }
  const byLine = new Map<string, number>();
  for (const a of line)
    a.perLine.forEach((v, k) => byLine.set(k, (byLine.get(k) ?? 0) + v));
  return {
    line,
    order,
    byLine,
    lineTotal: line.reduce((s, a) => s + a.total, 0),
    orderTotal: order?.total ?? 0,
  };
}

// ---------- conditions ----------

export interface PromotionConditions {
  is_active: boolean;
  start_at: Date | null;
  end_at: Date | null;
  days_of_week: number[] | null;
  /** "HH:MM" or "HH:MM:SS" Vietnam time. */
  time_from: string | null;
  time_to: string | null;
  all_stores: boolean;
  store_ids: string[];
  all_customers: boolean;
  /** Active target groups. */
  group_ids: string[];
  channels: string[] | null;
}

export interface SaleContext {
  at: Date;
  storeId?: string | null;
  customerGroupIds: string[];
  channel?: string | null;
}

const VN_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Day of week (0 = Sunday) and minutes since midnight in Vietnam time. */
export function vnClock(at: Date): { day: number; minutes: number } {
  const parts = Object.fromEntries(
    VN_PARTS.formatToParts(at).map((p) => [p.type, p.value]),
  );
  return {
    day: DAYS.indexOf(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function promotionEligible(
  c: PromotionConditions,
  ctx: SaleContext,
): boolean {
  if (!c.is_active) return false;
  if (c.start_at && c.start_at > ctx.at) return false;
  if (c.end_at && c.end_at < ctx.at) return false;
  const { day, minutes } = vnClock(ctx.at);
  if (c.days_of_week?.length && !c.days_of_week.includes(day)) return false;
  if (c.time_from && minutes < toMinutes(c.time_from)) return false;
  if (c.time_to && minutes > toMinutes(c.time_to)) return false;
  if (!c.all_stores && !(ctx.storeId && c.store_ids.includes(ctx.storeId)))
    return false;
  if (
    !c.all_customers &&
    !c.group_ids.some((g) => ctx.customerGroupIds.includes(g))
  )
    return false;
  if (c.channels?.length && !(ctx.channel && c.channels.includes(ctx.channel)))
    return false;
  return true;
}

// ---------- vouchers ----------

export interface VoucherRule {
  code: string;
  voucherActive: boolean;
  campaignActive: boolean;
  start_at: Date | null;
  end_at: Date | null;
  all_stores: boolean;
  store_ids: string[];
  channels: string[] | null;
  min_order_amount: number | null;
  uses_per_code: number;
  used_count: number;
  uses_per_customer: number | null;
  /** Applied uses of this campaign by the customer. */
  customer_uses: number;
  combinable_with_promotions: boolean;
  discount_kind: 'percent' | 'amount';
  discount_value: number;
  max_discount: number | null;
}

export type VoucherCheck =
  | { ok: true; amount: number }
  | { ok: false; reason: string };

const vnd = (n: number) => `${n.toLocaleString('vi-VN')} đ`;

/** Validation reasons and value of a voucher on `base` (amount after promotions and manual discount). */
export function checkVoucher(
  v: VoucherRule,
  ctx: {
    at: Date;
    storeId?: string | null;
    channel?: string | null;
    customerId?: string | null;
    base: number;
    promotionsApplied: boolean;
  },
): VoucherCheck {
  if (!v.voucherActive || !v.campaignActive)
    return { ok: false, reason: 'Mã đã ngừng sử dụng' };
  if (v.start_at && v.start_at > ctx.at)
    return { ok: false, reason: 'Mã chưa đến ngày sử dụng' };
  if (v.end_at && v.end_at < ctx.at)
    return { ok: false, reason: 'Mã đã hết hạn' };
  if (!v.all_stores && !(ctx.storeId && v.store_ids.includes(ctx.storeId)))
    return { ok: false, reason: 'Mã không dùng tại chi nhánh này' };
  if (v.channels?.length && !(ctx.channel && v.channels.includes(ctx.channel)))
    return { ok: false, reason: 'Mã không dùng cho kênh bán này' };
  if (v.used_count >= v.uses_per_code)
    return { ok: false, reason: 'Mã đã được sử dụng hết lượt' };
  if (v.uses_per_customer != null) {
    if (!ctx.customerId) return { ok: false, reason: 'Mã cần chọn khách hàng' };
    if (v.customer_uses >= v.uses_per_customer)
      return {
        ok: false,
        reason: 'Khách đã dùng hết lượt của chương trình này',
      };
  }
  if (!v.combinable_with_promotions && ctx.promotionsApplied)
    return {
      ok: false,
      reason: 'Mã không dùng chung với khuyến mãi đang áp dụng',
    };
  if (v.min_order_amount != null && ctx.base < v.min_order_amount)
    return { ok: false, reason: `Đơn tối thiểu ${vnd(v.min_order_amount)}` };
  let amount =
    v.discount_kind === 'percent'
      ? Math.round((ctx.base * v.discount_value) / 100)
      : Math.round(v.discount_value);
  if (v.max_discount != null) amount = Math.min(amount, v.max_discount);
  amount = Math.min(amount, Math.max(0, ctx.base));
  if (amount <= 0)
    return { ok: false, reason: 'Mã không tạo ra giảm giá cho đơn này' };
  return { ok: true, amount };
}
