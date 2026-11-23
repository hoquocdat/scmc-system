import axios from 'axios';

export type PosErrorCode = 'PRICE_CHANGED' | 'INSUFFICIENT_STOCK' | 'DISCOUNT_APPROVAL_REQUIRED' | 'SHIFT_NOT_OPEN' | 'PAYMENT_RULE' | 'NETWORK' | 'OTHER';

export interface PriceChange {
  product_id: string;
  product_variant_id: string | null;
  sku: string;
  name: string;
  expected_unit_price: number;
  unit_price: number;
}

export interface StockShortage {
  product_id: string;
  product_variant_id: string | null;
  sku: string;
  name: string;
  requested: number;
  available: number;
}

export interface PosError {
  code: PosErrorCode;
  status?: number;
  message: string;
  changes?: PriceChange[];
  shortages?: StockShortage[];
  requestedPercent?: number;
  maxPercent?: number;
}

/** Turns an axios error from /pos/checkout into something the UI can switch on. */
export function parsePosError(error: unknown): PosError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return { code: 'NETWORK', message: 'Không kết nối được máy chủ. Giao dịch chưa được ghi nhận, giỏ hàng vẫn được giữ.' };
    }
    const data = (error.response.data ?? {}) as Record<string, unknown>;
    const code = (data.code as PosErrorCode) ?? 'OTHER';
    const message = Array.isArray(data.message) ? (data.message as string[]).join('; ') : ((data.message as string) ?? error.message);
    return {
      code: ['PRICE_CHANGED', 'INSUFFICIENT_STOCK', 'DISCOUNT_APPROVAL_REQUIRED', 'SHIFT_NOT_OPEN', 'PAYMENT_RULE'].includes(code) ? code : 'OTHER',
      status: error.response.status,
      message,
      changes: data.changes as PriceChange[] | undefined,
      shortages: data.shortages as StockShortage[] | undefined,
      requestedPercent: data.requestedPercent as number | undefined,
      maxPercent: data.maxPercent as number | undefined,
    };
  }
  return { code: 'OTHER', message: error instanceof Error ? error.message : 'Lỗi không xác định' };
}
