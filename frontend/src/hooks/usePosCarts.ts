import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product, ProductVariant } from '@/lib/api/products';

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

/** Stock on hand at the branch's selling location, when the product payload includes it. */
export function branchStock(product: Product, locationId: string): number | null {
  const row = product.inventory?.find((i) => i.location_id === locationId);
  return row ? Number(row.quantity_on_hand) : null;
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
  return { subtotal, lineDiscounts, afterLines, orderDiscount, itemCount: cart.lines.reduce((s, l) => s + l.quantity, 0) };
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

  const active = useMemo(() => state.carts.find((c) => c.id === state.activeId) ?? state.carts[0], [state]);

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
    (product: Product, variant: ProductVariant | null, stock: number | null) => {
      const key = `${product.id}:${variant?.id ?? ''}`;
      updateActive((cart) => {
        const existing = cart.lines.find((l) => l.key === key);
        if (existing) {
          return { ...cart, lines: cart.lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1, shortage: undefined } : l)) };
        }
        const line: CartLine = {
          key,
          product_id: product.id,
          product_variant_id: variant?.id ?? null,
          name: variant ? `${product.name} / ${variant.name}` : product.name,
          sku: variant?.sku ?? product.sku,
          unit_price: displayPrice(product, variant),
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

  const setLineDiscount = useCallback(
    (key: string, discount_amount: number) => updateActive((cart) => ({ ...cart, lines: cart.lines.map((l) => (l.key === key ? { ...l, discount_amount } : l)) })),
    [updateActive],
  );

  const setCustomer = useCallback(
    (customer: CartCustomer | null, new_customer: { name: string; phone: string } | null = null) =>
      updateActive((cart) => ({ ...cart, customer, new_customer, points_to_redeem: customer ? cart.points_to_redeem : 0 })),
    [updateActive],
  );

  const setOrderDiscount = useCallback((order_discount: Cart['order_discount']) => updateActive((cart) => ({ ...cart, order_discount })), [updateActive]);
  const setPoints = useCallback((points_to_redeem: number) => updateActive((cart) => ({ ...cart, points_to_redeem })), [updateActive]);
  const setNotes = useCallback((notes: string) => updateActive((cart) => ({ ...cart, notes }), false), [updateActive]);
  const setApprovalToken = useCallback((approval_token: string) => updateActive((cart) => ({ ...cart, approval_token }), false), [updateActive]);

  /** Applies server prices after a PRICE_CHANGED error (renews the request id). */
  const applyPriceChanges = useCallback(
    (changes: { product_id: string; product_variant_id: string | null; unit_price: number }[]) =>
      updateActive((cart) => ({
        ...cart,
        lines: cart.lines.map((l) => {
          const change = changes.find((c) => c.product_id === l.product_id && (c.product_variant_id ?? null) === l.product_variant_id);
          return change ? { ...l, unit_price: change.unit_price } : l;
        }),
      })),
    [updateActive],
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
    totals: active ? cartTotals(active) : cartTotals(newCart(0)),
    addLine,
    setQuantity,
    setLineDiscount,
    setCustomer,
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
