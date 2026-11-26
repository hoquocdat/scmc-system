import type { ReturnReason } from '@/lib/api/sales-returns';

/** What staff chose for one order line. */
export interface LineChoice {
  quantity: number;
  reason: ReturnReason;
  restock: boolean;
}

export const emptyChoice: LineChoice = { quantity: 0, reason: 'changed_mind', restock: true };
