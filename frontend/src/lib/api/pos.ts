import axios from 'axios';
import { apiClient } from './client';
import type { Customer } from './customers';

// ==================== SHIFTS ====================

export type PosShiftStatus = 'open' | 'closed';

export interface PosShift {
  id: string;
  session_number: string;
  store_id: string | null;
  location_id: string;
  user_id: string;
  status: PosShiftStatus;
  opening_cash: number | string;
  closing_cash?: number | string | null;
  expected_cash?: number | string | null;
  cash_difference?: number | string | null;
  opened_at: string;
  closed_at?: string | null;
  closed_by?: string | null;
  notes?: string | null;
  stores?: { id: string; name: string; code: string; address?: string | null; phone?: string | null } | null;
  stock_locations?: { id: string; name: string } | null;
  user_profiles?: { id: string; full_name: string; email?: string | null } | null;
  pos_session_transactions?: PosCashMovement[];
}

export interface PosCashMovement {
  id: string;
  pos_session_id: string;
  transaction_type: 'cash_in' | 'cash_out';
  amount: number | string;
  reason?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface PosShiftSummary {
  session_id: string;
  session_number: string;
  status: PosShiftStatus;
  store: { id: string; name: string } | null;
  cashier: { id: string; full_name: string } | null;
  opened_at: string;
  closed_at: string | null;
  closed_by: { id: string; full_name: string } | null;
  sales_count: number;
  sales_total: number;
  paid_total: number;
  credit_given: number;
  by_payment_method: { method: string; amount: number; payments: number }[];
  opening_cash: number;
  cash_received: number;
  cash_in: number;
  cash_out: number;
  movements: PosCashMovement[];
  expected_cash: number;
  closing_cash: number | null;
  cash_difference: number | null;
}

export interface OpenShiftDto {
  store_id: string;
  opening_cash: number;
  notes?: string;
}

export interface CloseShiftDto {
  closing_cash: number;
  notes?: string;
}

export interface CashMovementDto {
  pos_session_id: string;
  transaction_type: 'cash_in' | 'cash_out';
  amount: number;
  reason: string;
  notes?: string;
  /** Move the cash to this account of the same branch (e.g. the safe) instead of out of the books. */
  target_account_id?: string;
}

export interface PosShiftQueryParams {
  store_id?: string;
  user_id?: string;
  status?: PosShiftStatus;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

// ==================== CHECKOUT ====================

export type PosPaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'ewallet_momo' | 'ewallet_zalopay' | 'ewallet_vnpay' | 'store_credit';

export const POS_PAYMENT_METHOD_LABELS: Record<PosPaymentMethod, string> = {
  cash: 'Tiền mặt',
  card: 'Thẻ',
  bank_transfer: 'Chuyển khoản',
  ewallet_momo: 'MoMo',
  ewallet_zalopay: 'ZaloPay',
  ewallet_vnpay: 'VNPay',
  store_credit: 'Tiền trả hàng (số dư)',
};

export interface CheckoutLineDto {
  product_id: string;
  product_variant_id?: string;
  quantity: number;
  expected_unit_price: number;
  discount_amount?: number;
  notes?: string;
}

export interface CheckoutPaymentDto {
  method: PosPaymentMethod;
  amount: number;
  amount_tendered?: number;
  reference?: string;
}

export interface CheckoutDto {
  client_request_id: string;
  customer_id?: string;
  new_customer?: { name: string; phone: string };
  lines: CheckoutLineDto[];
  order_discount?: { type: 'fixed' | 'percent'; value: number };
  points_to_redeem?: number;
  /** Manually chosen price book (needs price_books:apply). */
  price_book_id?: string;
  payments: CheckoutPaymentDto[];
  discount_approval_token?: string;
  notes?: string;
}

export interface PosReceiptLine {
  id: string;
  product_id: string | null;
  product_variant_id: string | null;
  product_name: string;
  product_sku: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number | string;
  discount_amount: number | string | null;
  tax_amount: number | string | null;
  total_amount: number | string;
}

export interface PosReceiptPayment {
  id: string;
  payment_method: string;
  amount: number | string;
  amount_tendered: number | string | null;
  change_given: number | string | null;
  transaction_id: string | null;
  status: string | null;
}

/** What POST /pos/checkout and /pos/orders/:id/reprint return: the order with everything the receipt needs. */
export interface PosReceipt {
  id: string;
  order_number: string;
  order_date: string | null;
  created_at: string | null;
  channel: string;
  status: string | null;
  payment_status: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  subtotal: number | string | null;
  discount_amount: number | string | null;
  discount_percent: number | string | null;
  loyalty_points_redeemed: number | null;
  loyalty_discount_amount: number | string | null;
  loyalty_points_earned: number | null;
  tax_amount: number | string | null;
  total_amount: number | string;
  paid_amount: number | string | null;
  notes: string | null;
  pos_session_id: string | null;
  discount_approved_by: string | null;
  idempotent_replay: boolean;
  reprint?: boolean;
  customers: Customer | null;
  stores: { id: string; name: string; address?: string | null; city?: string | null; phone?: string | null } | null;
  user_profiles_sales_orders_created_byTouser_profiles: { id: string; full_name: string } | null;
  user_profiles_sales_orders_discount_approved_byTouser_profiles: { id: string; full_name: string } | null;
  pos_sessions: { id: string; session_number: string } | null;
  sales_order_items: PosReceiptLine[];
  sales_order_payments: PosReceiptPayment[];
  loyalty: { points_balance: number; tier: string | null } | null;
}

export interface DiscountApprovalResult {
  token: string;
  expires_at: string;
  approved_by: string;
  discount_percent: number;
}

export const posApi = {
  // shifts
  getShifts: async (params?: PosShiftQueryParams) => {
    const response = await apiClient.get<{ data: PosShift[]; meta: { total: number; page: number; limit: number; totalPages: number } }>('/pos/sessions', { params });
    return response.data;
  },
  getCurrentShift: async (): Promise<PosShift> => {
    const response = await apiClient.get('/pos/sessions/current');
    return response.data;
  },
  getShift: async (id: string): Promise<PosShift> => {
    const response = await apiClient.get(`/pos/sessions/${id}`);
    return response.data;
  },
  getShiftSummary: async (id: string): Promise<PosShiftSummary> => {
    const response = await apiClient.get(`/pos/sessions/${id}/summary`);
    return response.data;
  },
  openShift: async (dto: OpenShiftDto): Promise<PosShift> => {
    const response = await apiClient.post('/pos/sessions', dto);
    return response.data;
  },
  closeShift: async (id: string, dto: CloseShiftDto): Promise<PosShift> => {
    const response = await apiClient.patch(`/pos/sessions/${id}/close`, dto);
    return response.data;
  },
  addCashMovement: async (dto: CashMovementDto): Promise<PosCashMovement> => {
    const response = await apiClient.post('/pos/transactions', dto);
    return response.data;
  },

  // checkout
  checkout: async (dto: CheckoutDto): Promise<PosReceipt> => {
    const response = await apiClient.post('/pos/checkout', dto);
    return response.data;
  },
  reprint: async (orderId: string): Promise<PosReceipt> => {
    const response = await apiClient.post(`/pos/orders/${orderId}/reprint`);
    return response.data;
  },

  /**
   * Discount approval is granted by a user with pos:approve using THEIR OWN
   * access token (they sign in on the POS device), so this call bypasses the
   * cashier's session interceptor.
   */
  approveDiscount: async (approverAccessToken: string, dto: { client_request_id: string; discount_percent: number }): Promise<DiscountApprovalResult> => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const response = await axios.post(`${baseURL}/pos/discount-approvals`, dto, {
      headers: { Authorization: `Bearer ${approverAccessToken}`, 'Content-Type': 'application/json' },
    });
    return response.data;
  },
};

export const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));

/** TanStack Query key of the cashier's current open shift. */
export const CURRENT_SHIFT_KEY = ['pos', 'shift', 'current'] as const;
