import type { VoucherCampaign } from '@/lib/api/vouchers';
import { formatCurrency } from '@/lib/utils';

/** "Giảm 10% (tối đa 200.000 ₫)" or "Giảm 50.000 ₫". */
export const campaignValue = (c: Pick<VoucherCampaign, 'discount_kind' | 'discount_value' | 'max_discount'>) =>
  c.discount_kind === 'percent'
    ? `Giảm ${c.discount_value}%${c.max_discount ? ` (tối đa ${formatCurrency(c.max_discount)})` : ''}`
    : `Giảm ${formatCurrency(c.discount_value)}`;
