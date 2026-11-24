import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Product, ProductVariant } from '@/lib/api/products';
import { promotionsApi, type CartBreakdown } from '@/lib/api/promotions';

export interface CartCustomer {
  id: string;
  full_name: string;
  phone: string;
}

export interface CartLine {
  key: string;
  product_id: string;
  product_variant_id: string | null;
  name: string;
  sku: string;
  /** Price shown to the customer; the server verifies it at checkout. */
  unit_price: number;
  quantity: number;
  /** Per-unit discount (VND). */
  discount_amount: number;
  /** Stock at the branch when the line was added (display only). */
  stock: number | null;
  /** Set from an INSUFFICIENT_STOCK error so the line can be highlighted. */
  shortage?: number;
  /** Price book that priced the line (from the server quote); null = base price. */
  price_book_name?: string | null;
  /** Price before the price book. */
  base_price?: number;
  /** Selling unit (box of 10…); absent = base unit. */
  unit_id?: string | null;
  unit_name?: string | null;
  unit_factor?: number;
  /** Line promotions on this line (whole line) and their names (server). */
  promotion_discount?: number;
  promotion_names?: string[];
}

export interface Cart {
  id: string;
  /** Idempotency key: stays the same across retries, changes when the cart changes. */
  client_request_id: string;
  label: string;
  lines: CartLine[];
  customer: CartCustomer | null;
  new_customer: { name: string; phone: string } | null;
  order_discount: { type: 'fixed' | 'percent'; value: number } | null;
  points_to_redeem: number;
  notes: string;
  /** Manually chosen price book for the whole sale; null = automatic. */
  price_book_id?: string | null;
  /** Voucher code entered by the cashier. */
  voucher_code?: string | null;
  /** Discount approval bound to client_request_id; dropped when the cart changes. */
  approval_token?: string;
  created_at: number;
}

interface CartsState {
  carts: Cart[];
  activeId: string;
}

const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const newCart = (n: number): Cart => ({
  id: uuid(),
  client_request_id: uuid(),
  label: `Đơn ${n}`,
  lines: [],
  customer: null,
  new_customer: null,
  order_discount: null,
  points_to_redeem: 0,
  notes: '',
  created_at: Date.now(),
});

function load(key: string): CartsState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CartsState;
    if (!Array.isArray(parsed.carts) || parsed.carts.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function save(key: string, state: CartsState) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // storage unavailable: carts live in memory only
  }
}

/** Available stock (on hand − reserved by pending orders) at the branch's selling location. */
export function branchStock(product: Product, locationId: string): number | null {
  const row = product.inventory?.find((i) => i.location_id === locationId);
  return row ? Number(row.quantity_on_hand) - Number(row.quantity_reserved ?? 0) : null;
}

/** Client-side mirror of the server price rule (the server is authoritative). */
export function displayPrice(product: Product, variant?: ProductVariant | null, at: Date = new Date()): number {
  const p = product as Product & { sale_price_start_date?: string | null; sale_price_end_date?: string | null };
  const saleActive =
    p.sale_price != null &&
    (!p.sale_price_start_date || new Date(p.sale_price_start_date) <= at) &&
    (!p.sale_price_end_date || new Date(p.sale_price_end_date) >= at);
  const base = saleActive ? Number(p.sale_price) : Number(product.retail_price);
  if (variant) {
    const v = variant as ProductVariant & { retail_price_override?: number | null };
    if (v.retail_price_override != null) return Number(v.retail_price_override);
    return base + Number(variant.price_adjustment ?? 0);
  }
  return base;
}

export interface CartTotals {
  subtotal: number;
  lineDiscounts: number;
  afterLines: number;
  orderDiscount: number;
  itemCount: number;
  /** From the server breakdown (0 when computed locally). */
  linePromotion: number;
  orderPromotion: number;
  voucherDiscount: number;
  loyaltyDiscount: number;
  /** What the customer pays. */
  total: number;
  promotions: CartBreakdown['promotions'];
  voucher: CartBreakdown['voucher'];
  /** True when the figures come from the server for the current cart. */
  server: boolean;
}

export function cartTotals(cart: Cart): CartTotals {
  const subtotal = cart.lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const lineDiscounts = cart.lines.reduce((s, l) => s + l.discount_amount * l.quantity, 0);
  const afterLines = subtotal - lineDiscounts;
  const orderDiscount = !cart.order_discount
    ? 0
    : cart.order_discount.type === 'percent'
      ? Math.round((afterLines * cart.order_discount.value) / 100)
      : Math.min(cart.order_discount.value, afterLines);
  return {
    subtotal, lineDiscounts, afterLines, orderDiscount, itemCount: cart.lines.reduce((s, l) => s + l.quantity, 0),
    linePromotion: 0, orderPromotion: 0, voucherDiscount: 0, loyaltyDiscount: 0, total: Math.max(0, afterLines - orderDiscount),
    promotions: [], voucher: null, server: false,
  };
}

/** Cart line key: product, variant and (when not the base unit) the selling unit. */
export const lineKey = (productId: string, variantId: string | null | undefined, unitId?: string | null) =>
  `${productId}:${variantId ?? ''}${unitId ? `:${unitId}` : ''}`;
const keyOf = lineKey;

/** Server totals for a cart, when the breakdown matches its lines. */
function serverTotals(cart: Cart, b: CartBreakdown): CartTotals | null {
  const keys = b.lines.map((l) => keyOf(l.product_id, l.product_variant_id, l.unit_id)).join(','); 
  if (keys !== cart.lines.map((l) => l.key).join(',')) return null;
  return {
    subtotal: b.subtotal,
    lineDiscounts: b.line_discounts,
    afterLines: b.subtotal - b.line_discounts,
    orderDiscount: b.order_discount,
    itemCount: cart.lines.reduce((s, l) => s + l.quantity, 0),
    linePromotion: b.line_promotion_discount,
    orderPromotion: b.order_promotion_discount,
    voucherDiscount: b.voucher_discount,
    loyaltyDiscount: b.loyalty_discount,
    total: b.total,
    promotions: b.promotions,
    voucher: b.voucher,
    server: true,
  };
}

/**
 * Several open carts (tabs) kept on this device only, per cashier and branch.
 * Any change to a cart's content renews its client_request_id and clears its
 * approval token; a checkout retry keeps the same id.
 */
export function usePosCarts(userId: string | undefined, storeId: string | undefined) {
  const storageKey = `pos:carts:${userId ?? 'anon'}:${storeId ?? 'none'}`;
  const [state, setState] = useState<CartsState>(() => load(storageKey) ?? { carts: [newCart(1)], activeId: '' });

  useEffect(() => {
    const loaded = load(storageKey);
    setState(loaded ?? (() => { const c = newCart(1); return { carts: [c], activeId: c.id }; })());
  }, [storageKey]);

  useEffect(() => {
    if (!state.activeId && state.carts[0]) setState((s) => ({ ...s, activeId: s.carts[0].id }));
  }, [state.activeId, state.carts]);

  useEffect(() => save(storageKey, state), [storageKey, state]);

  const rawActive = useMemo(() => state.carts.find((c) => c.id === state.activeId) ?? state.carts[0], [state]);

  // Server prices, promotions, voucher and totals for the active cart (promotions-vouchers D8)
  const queryClient = useQueryClient();
  const request = rawActive && storeId && rawActive.lines.length > 0
    ? {
        store_id: storeId,
        customer_id: rawActive.customer?.id ?? null,
        price_book_id: rawActive.price_book_id ?? null,
        channel: 'pos',
        discount_type: rawActive.order_discount?.type ?? 'fixed',
        discount_value: rawActive.order_discount?.value ?? 0,
        voucher_code: rawActive.voucher_code ?? null,
        points_to_redeem: rawActive.points_to_redeem || 0,
        lines: rawActive.lines.map((l) => ({ product_id: l.product_id, product_variant_id: l.product_variant_id, unit_id: l.unit_id ?? null, quantity: l.quantity, discount_amount: l.discount_amount || 0 })),
      } as const
    : null;
  const quote = useQuery({
    queryKey: ['pos', 'cart', request],
    queryFn: () => promotionsApi.cart(request!),
    enabled: !!request,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
  const active = useMemo(() => {
    if (!rawActive || !quote.data) return rawActive;
    const b = quote.data;
    const byKey = new Map(b.lines.map((q) => [keyOf(q.product_id, q.product_variant_id, q.unit_id), q]));
    const names = new Map<number, string[]>();
    for (const p of b.promotions) for (const l of p.lines) names.set(l.index, [...(names.get(l.index) ?? []), p.name]);
    return {
      ...rawActive,
      lines: rawActive.lines.map((l) => {
        const q = byKey.get(l.key);
        return q
          ? { ...l, unit_price: q.unit_price, price_book_name: q.price_book_name, promotion_discount: q.promotion_discount, promotion_names: names.get(q.index) ?? [] }
          : l;
      }),
    };
  }, [rawActive, quote.data]);

  const updateActive = useCallback((fn: (cart: Cart) => Cart, contentChanged = true) => {
    setState((s) => ({
      ...s,
      carts: s.carts.map((c) => {
        if (c.id !== (s.activeId || s.carts[0]?.id)) return c;
        const next = fn(c);
        return contentChanged ? { ...next, client_request_id: uuid(), approval_token: undefined } : next;
      }),
    }));
  }, []);

  const addLine = useCallback(
    (product: Product, variant: ProductVariant | null, stock: number | null, unit?: { id: string; name: string; factor: number; price: number | null } | null) => {
      const key = lineKey(product.id, variant?.id, unit?.id);
      updateActive((cart) => {
        const existing = cart.lines.find((l) => l.key === key);
        if (existing) {
          return { ...cart, lines: cart.lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1, shortage: undefined } : l)) };
        }
        const line: CartLine = {
          key,
          product_id: product.id,
          product_variant_id: variant?.id ?? null,
          name: variant ? `${product.name} / ${variant.name}` : unit ? `${product.name} (${unit.name})` : product.name,
          sku: variant?.sku ?? product.sku,
          unit_price: unit ? (unit.price ?? displayPrice(product, null) * unit.factor) : displayPrice(product, variant),
          unit_id: unit?.id ?? null,
          unit_name: unit?.name ?? null,
          unit_factor: unit?.factor ?? 1,
          quantity: 1,
          discount_amount: 0,
          stock,
        };
        return { ...cart, lines: [...cart.lines, line] };
      });
    },
    [updateActive],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) =>
      updateActive((cart) => ({
        ...cart,
        lines: quantity <= 0 ? cart.lines.filter((l) => l.key !== key) : cart.lines.map((l) => (l.key === key ? { ...l, quantity, shortage: undefined } : l)),
      })),
    [updateActive],
  );

  /** Switches a line between the base unit and a conversion unit (merges with an existing line of that unit). */
  const setLineUnit = useCallback(
    (key: string, unit: { id: string; name: string; factor: number; price: number | null } | null) =>
      updateActive((cart) => {
        const line = cart.lines.find((l) => l.key === key);
        if (!line) return cart;
        const baseName = line.unit_name ? line.name.replace(` (${line.unit_name})`, '') : line.name;
        const basePrice = line.unit_factor && line.unit_factor > 1 ? line.unit_price / line.unit_factor : line.unit_price;
        const nextKey = lineKey(line.product_id, line.product_variant_id, unit?.id);
        const next: CartLine = {
          ...line,
          key: nextKey,
          name: unit ? `${baseName} (${unit.name})` : baseName,
          unit_id: unit?.id ?? null,
          unit_name: unit?.name ?? null,
          unit_factor: unit?.factor ?? 1,
          unit_price: unit ? (unit.price ?? basePrice * unit.factor) : basePrice,
          discount_amount: 0,
        };
        const other = cart.lines.find((l) => l.key === nextKey && l.key !== key);
        const lines = other
          ? cart.lines.filter((l) => l.key !== key).map((l) => (l.key === nextKey ? { ...l, quantity: l.quantity + line.quantity } : l))
          : cart.lines.map((l) => (l.key === key ? next : l));
        return { ...cart, lines };
      }),
    [updateActive],
  );

  const setLineDiscount = useCallback(
    (key: string, discount_amount: number) => updateActive((cart) => ({ ...cart, lines: cart.lines.map((l) => (l.key === key ? { ...l, discount_amount } : l)) })),
    [updateActive],
  );

  const setCustomer = useCallback(
    (customer: CartCustomer | null, new_customer: { name: string; phone: string } | null = null) =>
      updateActive((cart) => ({ ...cart, customer, new_customer, points_to_redeem: customer ? cart.points_to_redeem : 0 })),
    [updateActive],
  );

  const setVoucher = useCallback((voucher_code: string | null) => updateActive((cart) => ({ ...cart, voucher_code })), [updateActive]);
  const setPriceBook = useCallback((price_book_id: string | null) => updateActive((cart) => ({ ...cart, price_book_id })), [updateActive]);
  const setOrderDiscount = useCallback((order_discount: Cart['order_discount']) => updateActive((cart) => ({ ...cart, order_discount })), [updateActive]);
  const setPoints = useCallback((points_to_redeem: number) => updateActive((cart) => ({ ...cart, points_to_redeem })), [updateActive]);
  const setNotes = useCallback((notes: string) => updateActive((cart) => ({ ...cart, notes }), false), [updateActive]);
  const setApprovalToken = useCallback((approval_token: string) => updateActive((cart) => ({ ...cart, approval_token }), false), [updateActive]);

  /** Applies server prices after a PRICE_CHANGED error (renews the request id). */
  const applyPriceChanges = useCallback(
    (changes: { product_id: string; product_variant_id: string | null; unit_price: number }[]) =>
    {
      updateActive((cart) => ({
        ...cart,
        lines: cart.lines.map((l) => {
          const change = changes.find((c) => c.product_id === l.product_id && (c.product_variant_id ?? null) === l.product_variant_id);
          return change ? { ...l, unit_price: change.unit_price } : l;
        }),
      }));
      void queryClient.invalidateQueries({ queryKey: ['pos', 'cart'] });
    },
    [updateActive, queryClient],
  );

  /** Marks lines short on stock (no request id change: the cart content is the same). */
  const markShortages = useCallback(
    (shortages: { product_id: string; product_variant_id: string | null; available: number }[]) =>
      updateActive(
        (cart) => ({
          ...cart,
          lines: cart.lines.map((l) => {
            const s = shortages.find((x) => x.product_id === l.product_id && (x.product_variant_id ?? null) === l.product_variant_id);
            return s ? { ...l, shortage: s.available, stock: s.available } : l;
          }),
        }),
        false,
      ),
    [updateActive],
  );

  const newTab = useCallback(() => {
    setState((s) => {
      const c = newCart(s.carts.length + 1);
      return { carts: [...s.carts, c], activeId: c.id };
    });
  }, []);

  const switchTab = useCallback((id: string) => setState((s) => ({ ...s, activeId: id })), []);

  const closeTab = useCallback((id: string) => {
    setState((s) => {
      const remaining = s.carts.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const c = newCart(1);
        return { carts: [c], activeId: c.id };
      }
      return { carts: remaining, activeId: s.activeId === id ? remaining[0].id : s.activeId };
    });
  }, []);

  /** After a successful checkout: drop the sold cart. */
  const finishActive = useCallback(() => active && closeTab(active.id), [active, closeTab]);

  return {
    carts: state.carts,
    active,
    totals: active ? ((quote.data && serverTotals(active, quote.data)) || cartTotals(active)) : cartTotals(newCart(0)),
    addLine,
    setQuantity,
    setLineDiscount,
    setLineUnit,
    setCustomer,
    setPriceBook,
    setVoucher,
    /** True while server prices for the active cart are being fetched. */
    pricing: quote.isFetching,
    /** Why the server could not price the cart (e.g. points below the minimum). */
    pricingError: quote.error,
    setOrderDiscount,
    setPoints,
    setNotes,
    setApprovalToken,
    applyPriceChanges,
    markShortages,
    newTab,
    switchTab,
    closeTab,
    finishActive,
  };
}
