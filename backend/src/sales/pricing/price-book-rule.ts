/**
 * Price book rule (change price-books, design D3). Pure functions so the rule
 * is unit-tested without a database; PriceResolverService loads the data.
 */

export type PriceBookMode = 'fixed' | 'percent_off' | 'amount_off';

export interface PriceBookEntryRule {
  product_id: string;
  product_variant_id: string | null;
  mode: PriceBookMode;
  value: number;
}

export interface PriceBookRule {
  id: string;
  code: string;
  name: string;
  priority: number;
  is_active: boolean;
  start_at: Date | null;
  end_at: Date | null;
  all_stores: boolean;
  all_customers: boolean;
  allow_manual: boolean;
  store_ids: string[];
  /** Target groups (active ones only). */
  group_ids: string[];
  entries: PriceBookEntryRule[];
}

export interface PriceBookContext {
  at: Date;
  storeId?: string | null;
  /** Active groups of the customer; empty for a walk-in sale. */
  customerGroupIds: string[];
}

const inDates = (book: PriceBookRule, at: Date) =>
  (book.start_at == null || book.start_at <= at) &&
  (book.end_at == null || book.end_at >= at);

const storeOk = (book: PriceBookRule, storeId?: string | null) =>
  book.all_stores || (!!storeId && book.store_ids.includes(storeId));

/** Book applies automatically: active, in dates, branch and customer conditions met. */
export function bookApplies(
  book: PriceBookRule,
  ctx: PriceBookContext,
): boolean {
  if (!book.is_active || !inDates(book, ctx.at) || !storeOk(book, ctx.storeId))
    return false;
  return (
    book.all_customers ||
    book.group_ids.some((g) => ctx.customerGroupIds.includes(g))
  );
}

/** Book may be chosen manually: active, in dates, manual allowed, branch ok; customer condition waived. */
export function bookChoosable(
  book: PriceBookRule,
  ctx: Pick<PriceBookContext, 'at' | 'storeId'>,
): boolean {
  return (
    book.is_active &&
    book.allow_manual &&
    inDates(book, ctx.at) &&
    storeOk(book, ctx.storeId)
  );
}

/** The book's entry for an item: the variant's own entry first, else the product's. */
export function entryFor(
  book: PriceBookRule,
  productId: string,
  variantId: string | null,
): PriceBookEntryRule | null {
  if (variantId) {
    const own = book.entries.find((e) => e.product_variant_id === variantId);
    if (own) return own;
  }
  return (
    book.entries.find(
      (e) => e.product_id === productId && e.product_variant_id == null,
    ) ?? null
  );
}

/** Price from an entry and the base price, in whole đồng. */
export function applyEntry(base: number, entry: PriceBookEntryRule): number {
  switch (entry.mode) {
    case 'fixed':
      return Math.round(entry.value);
    case 'percent_off':
      return Math.round((base * (100 - entry.value)) / 100);
    case 'amount_off':
      return Math.max(0, Math.round(base - entry.value));
  }
}

/** Highest priority, then later start, then code. */
export function compareBooks(a: PriceBookRule, b: PriceBookRule): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const as = a.start_at?.getTime() ?? -Infinity;
  const bs = b.start_at?.getTime() ?? -Infinity;
  if (as !== bs) return bs - as;
  return a.code.localeCompare(b.code);
}

export interface BookPrice {
  book: PriceBookRule;
  entry: PriceBookEntryRule;
  unitPrice: number;
}

/**
 * Price of one item from already-applicable books (automatic mode), or from
 * the one chosen book (manual mode: no fallback to other books). Null = base.
 */
export function priceFromBooks(
  books: PriceBookRule[],
  base: number,
  productId: string,
  variantId: string | null,
): BookPrice | null {
  for (const book of [...books].sort(compareBooks)) {
    const entry = entryFor(book, productId, variantId);
    if (entry) return { book, entry, unitPrice: applyEntry(base, entry) };
  }
  return null;
}
