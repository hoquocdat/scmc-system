import axios from 'axios';
import { apiClient } from './client';
import type { ReportResult } from './reports';

export type CashDirection = 'in' | 'out';
export type CashAccountType = 'cash' | 'bank' | 'ewallet';
export type CounterpartyType = 'customer' | 'supplier' | 'employee' | 'other';
export type CashBookMethod = 'cash' | 'card' | 'bank_transfer' | 'ewallet_momo' | 'ewallet_zalopay' | 'ewallet_vnpay';

export const CASH_BOOK_METHODS: CashBookMethod[] = ['cash', 'card', 'bank_transfer', 'ewallet_momo', 'ewallet_zalopay', 'ewallet_vnpay'];
export const METHOD_LABELS: Record<CashBookMethod, string> = {
  cash: 'Tiền mặt',
  card: 'Thẻ',
  bank_transfer: 'Chuyển khoản',
  ewallet_momo: 'MoMo',
  ewallet_zalopay: 'ZaloPay',
  ewallet_vnpay: 'VNPay',
};
export const ACCOUNT_TYPE_LABELS: Record<CashAccountType, string> = { cash: 'Tiền mặt', bank: 'Ngân hàng', ewallet: 'Ví điện tử' };
export const COUNTERPARTY_LABELS: Record<CounterpartyType, string> = { customer: 'Khách hàng', supplier: 'Nhà cung cấp', employee: 'Nhân viên', other: 'Khác' };
export const SOURCE_LABELS: Record<string, string> = {
  manual: 'Phiếu nhập tay',
  sales_order_payment: 'Thanh toán đơn hàng',
  service_payment: 'Thanh toán dịch vụ',
  supplier_payment: 'Trả nhà cung cấp',
  payroll_slip: 'Lương',
  pos_session: 'Ca bán hàng',
  pos_session_transaction: 'Ca bán hàng (cũ)',
};

export interface CashAccount {
  id: string;
  store_id: string;
  code: string;
  name: string;
  type: CashAccountType;
  is_pos_drawer: boolean;
  bank_name: string | null;
  account_number: string | null;
  is_active: boolean;
  notes: string | null;
  stores?: { id: string; name: string; code: string } | null;
  balance: number;
  opening_date: string | null;
}

export interface CashCategory {
  id: string;
  code: string;
  name: string;
  direction: CashDirection;
  is_system: boolean;
  is_active: boolean;
}

export interface MethodMapping {
  store_id: string;
  payment_method: CashBookMethod;
  account_id: string;
  cash_book_accounts: { id: string; name: string; type: CashAccountType };
  stores: { id: string; name: string };
}

export interface CashEntry {
  id: string;
  entry_number: string;
  account_id: string;
  store_id: string;
  direction: CashDirection;
  amount: number | string;
  entry_date: string;
  counterparty_type: CounterpartyType | null;
  counterparty_name: string | null;
  source_type: string | null;
  source_id: string | null;
  pos_session_id: string | null;
  transfer_group_id: string | null;
  reverses_entry_id: string | null;
  is_automatic: boolean;
  is_opening: boolean;
  status: 'posted' | 'cancelled';
  cancelled_at: string | null;
  cancel_reason: string | null;
  note: string | null;
  created_at: string;
  cash_book_accounts: { id: string; code: string; name: string; type: CashAccountType; is_pos_drawer: boolean };
  cash_book_categories: { id: string; code: string; name: string; direction: CashDirection };
  stores: { id: string; name: string };
  user_profiles_cash_book_entries_created_byTouser_profiles: { id: string; full_name: string } | null;
  user_profiles_cash_book_entries_cancelled_byTouser_profiles: { id: string; full_name: string } | null;
  attachments?: { id: string; public_url: string; file_name: string; mime_type?: string | null }[];
}

export interface CashEntryRow extends Record<string, unknown> {
  id: string;
  entryDate: string;
  entryNumber: string;
  account: string;
  accountId: string;
  store: string;
  category: string;
  categoryCode: string;
  direction: CashDirection;
  counterparty: string;
  note: string;
  receipt: number | null;
  payment: number | null;
  runningBalance: number | null;
  status: string;
  isCancelled: boolean;
  isAutomatic: boolean;
  sourceType: string | null;
  transferGroupId: string | null;
  createdBy: string | null;
}

export interface CashEntriesMeta {
  page: number;
  pageSize: number;
  total: number;
  opening: number | null;
  closing: number | null;
  receipts: number;
  payments: number;
  net: number;
}

export interface EntryQuery {
  from?: string;
  to?: string;
  storeId?: string;
  accountId?: string;
  direction?: CashDirection;
  categoryId?: string;
  counterpartyType?: CounterpartyType;
  counterparty?: string;
  sourceType?: string;
  status?: 'posted' | 'cancelled';
  page?: number;
  pageSize?: number;
}

export interface VoucherInput {
  account_id: string;
  amount: number;
  category_id: string;
  counterparty_type?: CounterpartyType;
  counterparty_id?: string;
  counterparty_name?: string;
  entry_date?: string;
  note?: string;
}

const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;

export const cashBookApi = {
  entries: async (q: EntryQuery) => {
    const r = await apiClient.get<ReportResult<CashEntryRow>>('/cash-book/entries', { params: clean(q) });
    return r.data as ReportResult<CashEntryRow> & { meta: CashEntriesMeta };
  },
  entry: async (id: string): Promise<CashEntry> => (await apiClient.get(`/cash-book/entries/${id}`)).data,
  balances: async (storeId?: string) =>
    (await apiClient.get<{ at: string; accounts: CashAccount[]; stores: { store_id: string; store_name: string; balance: number }[]; total: number }>('/cash-book/balances', { params: clean({ storeId }) })).data,
  accounts: async (storeId?: string): Promise<CashAccount[]> => (await apiClient.get('/cash-book/accounts', { params: clean({ storeId }) })).data,
  createAccount: async (dto: Partial<CashAccount> & { store_id: string; code: string; name: string; type: CashAccountType }) => (await apiClient.post('/cash-book/accounts', dto)).data,
  updateAccount: async (id: string, dto: Partial<Pick<CashAccount, 'name' | 'is_active' | 'is_pos_drawer' | 'bank_name' | 'account_number' | 'notes'>>) =>
    (await apiClient.patch(`/cash-book/accounts/${id}`, dto)).data,
  methodMap: async (storeId?: string): Promise<MethodMapping[]> => (await apiClient.get('/cash-book/accounts/method-map', { params: clean({ storeId }) })).data,
  setMethodAccount: async (dto: { store_id: string; payment_method: CashBookMethod; account_id: string }) => (await apiClient.put('/cash-book/accounts/method-map', dto)).data,
  categories: async (direction?: CashDirection): Promise<CashCategory[]> => (await apiClient.get('/cash-book/categories', { params: clean({ direction }) })).data,
  createCategory: async (dto: { name: string; direction: CashDirection }) => (await apiClient.post('/cash-book/categories', dto)).data,
  updateCategory: async (id: string, dto: { name?: string; is_active?: boolean }) => (await apiClient.patch(`/cash-book/categories/${id}`, dto)).data,
  deleteCategory: async (id: string) => (await apiClient.delete(`/cash-book/categories/${id}`)).data,
  createReceipt: async (dto: VoucherInput): Promise<CashEntry> => (await apiClient.post('/cash-book/receipts', dto)).data,
  createPayment: async (dto: VoucherInput): Promise<CashEntry> => (await apiClient.post('/cash-book/payments', dto)).data,
  createTransfer: async (dto: { from_account_id: string; to_account_id: string; amount: number; entry_date?: string; note?: string }) =>
    (await apiClient.post('/cash-book/transfers', dto)).data,
  createOpeningBalance: async (dto: { account_id: string; amount: number; date: string; note?: string }) => (await apiClient.post('/cash-book/opening-balances', dto)).data,
  cancel: async (id: string, reason: string): Promise<CashEntry> => (await apiClient.post(`/cash-book/entries/${id}/cancel`, { reason })).data,
};

/** Server message of a failed cash book call. */
export function cashBookError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const m = (error.response?.data as { message?: string | string[] } | undefined)?.message;
    return Array.isArray(m) ? m.join('; ') : (m ?? error.message);
  }
  return error instanceof Error ? error.message : 'Lỗi không xác định';
}

export const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));
