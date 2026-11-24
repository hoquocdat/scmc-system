import axios from 'axios';
import { apiClient } from './client';
import type { ReportResult } from './reports';

export type ReturnReason = 'changed_mind' | 'wrong_size' | 'defective' | 'wrong_item' | 'other';
export type RefundMethod = 'cash' | 'card' | 'bank_transfer' | 'ewallet_momo' | 'ewallet_zalopay' | 'ewallet_vnpay' | 'store_credit';

export const REASON_LABELS: Record<ReturnReason, string> = {
  changed_mind: 'Khách đổi ý',
  wrong_size: 'Sai kích cỡ',
  defective: 'Lỗi sản phẩm',
  wrong_item: 'Giao nhầm hàng',
  other: 'Khác',
};

export const REFUND_METHOD_LABELS: Record<RefundMethod | 'exchange', string> = {
  cash: 'Tiền mặt',
  card: 'Thẻ',
  bank_transfer: 'Chuyển khoản',
  ewallet_momo: 'MoMo',
  ewallet_zalopay: 'ZaloPay',
  ewallet_vnpay: 'VNPay',
  store_credit: 'Giữ cho khách (tiền trả hàng)',
  exchange: 'Trừ vào đơn đổi',
};

export interface ReturnableLine {
  id: string;
  product_id: string | null;
  product_variant_id: string | null;
  product_name: string;
  product_sku: string | null;
  variant_name: string | null;
  quantity: number;
  returned_quantity: number;
  remaining: number;
  unit_price: number;
  paid_value: number;
  refundable_amount: number;
  unit_refund: number;
}

export interface ReturnLookup {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  channel: string;
  store_id: string | null;
  store_name: string | null;
  location_id: string | null;
  customer: { id: string; full_name: string; phone: string | null; credit_balance: number } | null;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  refunded_amount: number;
  receivable_balance: number;
  return_status: 'none' | 'partial' | 'full';
  returnable: boolean;
  blocked_reason: string | null;
  lines: ReturnableLine[];
}

export interface ReturnItemInput {
  sales_order_item_id: string;
  quantity: number;
  restock?: boolean;
  location_id?: string;
  reason_code?: ReturnReason;
  reason_note?: string;
}

export interface RefundInput {
  method: RefundMethod;
  amount: number;
  cash_account_id?: string;
}

export interface ExchangeInput {
  lines: { product_id: string; product_variant_id?: string; quantity: number; expected_unit_price?: number }[];
  payments?: { method: RefundMethod; amount: number; amount_tendered?: number; reference?: string }[];
}

export interface ReturnRequest {
  sales_order_id: string;
  items: ReturnItemInput[];
  refunds?: RefundInput[];
  exchange?: ExchangeInput;
  reason?: string;
  notes?: string;
}

export interface ReturnPreview {
  goods_amount: number;
  receivable_reduction: number;
  refund_due: number;
  exchange_total: number;
  exchange_lines: { product_id: string; product_variant_id: string | null; name: string; sku: string; quantity: number; unit_price: number; price_book_name: string | null; line_total: number }[];
  exchange_applied: number;
  customer_pays: number;
  refund_after_exchange: number;
  points_reversed: number;
  points_restored: number;
  needs_approval: boolean;
  approval_reasons: string[];
  can_approve: boolean;
}

export interface SalesReturn {
  id: string;
  return_number: string;
  sales_order_id: string;
  kind: 'return' | 'exchange';
  exchange_order_id: string | null;
  goods_amount: string | number;
  receivable_reduction: string | number;
  refund_amount: string | number;
  points_reversed: number;
  points_restored: number;
  reason: string | null;
  notes: string | null;
  created_at: string;
  sales_return_items: { id: string; product_name: string; product_sku: string | null; quantity: number; unit_refund: string | number; line_refund: string | number; restock: boolean; reason_code: ReturnReason; reason_note: string | null }[];
  sales_return_refunds: { id: string; method: RefundMethod | 'exchange'; amount: string | number; cash_book_accounts: { id: string; name: string } | null }[];
  sales_orders_sales_returns_sales_order_idTosales_orders: { id: string; order_number: string; total_amount: string | number; order_date: string | null };
  sales_orders_sales_returns_exchange_order_idTosales_orders: { id: string; order_number: string; total_amount: string | number } | null;
  customers: { id: string; full_name: string; phone: string | null } | null;
  stores: { id: string; name: string; address: string | null; phone: string | null } | null;
  user_profiles_sales_returns_created_byTouser_profiles: { id: string; full_name: string } | null;
  user_profiles_sales_returns_approved_byTouser_profiles: { id: string; full_name: string } | null;
  cash_book_entries: { id: string; entry_number: string; amount: string | number }[];
}

export interface ReturnRow extends Record<string, unknown> {
  id: string;
  createdAt: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  kind: string;
  customer: string;
  store: string;
  goodsAmount: number;
  receivableReduction: number;
  refundAmount: number;
  exchangeOrder: string;
  createdBy: string;
  itemCount: number;
}

export interface ReturnListQuery {
  /** Returns of one order (the period is ignored). */
  orderId?: string;
  from?: string;
  to?: string;
  storeId?: string;
  customerId?: string;
  search?: string;
  kind?: 'return' | 'exchange';
  page?: number;
  pageSize?: number;
}

export interface CustomerCredit {
  balance: number;
  transactions: { id: string; amount: number; balance_after: number; source_type: string; source_id: string | null; note: string | null; created_at: string }[];
}

const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;

export const salesReturnsApi = {
  lookup: async (code: string): Promise<ReturnLookup> => (await apiClient.get('/sales-returns/lookup', { params: { code } })).data,
  preview: async (dto: ReturnRequest): Promise<ReturnPreview> => (await apiClient.post('/sales-returns/preview', dto)).data,
  create: async (dto: ReturnRequest): Promise<SalesReturn> => (await apiClient.post('/sales-returns', dto)).data,
  get: async (id: string): Promise<SalesReturn> => (await apiClient.get(`/sales-returns/${id}`)).data,
  list: async (q: ReturnListQuery) =>
    (await apiClient.get<ReportResult<ReturnRow>>('/sales-returns', { params: clean(q) })).data as ReportResult<ReturnRow> & {
      meta: { page: number; pageSize: number; total: number };
    },
  customerCredit: async (customerId: string): Promise<CustomerCredit> => (await apiClient.get(`/customers/${customerId}/credit`)).data,
};

/** Server message (and code) of a failed call. */
export function returnError(error: unknown): { message: string; code?: string } {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[]; code?: string } | undefined;
    const m = data?.message;
    return { message: Array.isArray(m) ? m.join('; ') : (m ?? error.message), code: data?.code };
  }
  return { message: error instanceof Error ? error.message : 'Lỗi không xác định' };
}

export const money = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));
