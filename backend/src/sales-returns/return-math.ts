/**
 * Refund and loyalty arithmetic for sales returns (change sales-returns,
 * design D3 and D6). Pure functions, amounts in whole đồng.
 */

export interface AllocLine {
  id: string;
  unit_price: number;
  /** Per-unit line discount. */
  discount_amount: number;
  /** Per-unit tax. */
  tax_amount: number;
  quantity: number;
}

/** Value of a line before order-level reductions. */
export const lineNet = (l: AllocLine) =>
  Math.round((l.unit_price - l.discount_amount + l.tax_amount) * l.quantity);

/**
 * What the customer paid for each line: its value minus its share of the
 * order-level reductions (order discount, loyalty discount; later promotions
 * and vouchers), split in proportion to line value with the largest-remainder
 * method so the shares add up exactly.
 */
export function allocateOrderReductions(
  lines: AllocLine[],
  reductions: number,
): Map<string, number> {
  const nets = lines.map(lineNet);
  const total = nets.reduce((s, n) => s + n, 0);
  const cut = Math.max(0, Math.min(Math.round(reductions), total));
  const out = new Map<string, number>();
  if (total <= 0 || cut === 0) {
    lines.forEach((l, i) => out.set(l.id, nets[i]));
    return out;
  }
  const exact = nets.map((n) => (cut * n) / total);
  const shares = exact.map(Math.floor);
  let left = cut - shares.reduce((s, x) => s + x, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }
  lines.forEach((l, i) => out.set(l.id, nets[i] - shares[i]));
  return out;
}

export interface RefundableLine {
  /** What was paid for the whole line (allocateOrderReductions). */
  paidValue: number;
  quantity: number;
  returnedQuantity: number;
  returnedAmount: number;
}

export class ReturnQuantityError extends Error {}

/**
 * Refund for returning `k` more units. The last remaining units take the
 * line's remaining value so that rounding never refunds more than was paid.
 */
export function refundFor(line: RefundableLine, k: number): number {
  const remaining = line.quantity - line.returnedQuantity;
  if (!Number.isInteger(k) || k <= 0 || k > remaining)
    throw new ReturnQuantityError(`Chỉ còn ${remaining} sản phẩm có thể trả`);
  const left = Math.max(0, line.paidValue - line.returnedAmount);
  if (k === remaining) return left;
  return Math.min(left, Math.round((line.paidValue * k) / line.quantity));
}

/**
 * Points to reverse (earned) or restore (redeemed) for a return: in proportion
 * to the returned value, never beyond what is left; a full return takes the
 * remainder.
 */
export function proportionalPoints(
  total: number,
  alreadyApplied: number,
  returnedValue: number,
  orderValue: number,
  fullyReturned: boolean,
): number {
  const left = Math.max(0, total - alreadyApplied);
  if (fullyReturned) return left;
  if (orderValue <= 0 || total <= 0) return 0;
  return Math.min(left, Math.round((total * returnedValue) / orderValue));
}
