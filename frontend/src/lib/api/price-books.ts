import axios from 'axios';
import { apiClient } from './client';

export type PriceBookMode = 'fixed' | 'percent_off' | 'amount_off';

export const MODE_LABELS: Record<PriceBookMode, string> = {
  fixed: 'Giá cố định',
  percent_off: 'Giảm %',
  amount_off: 'Giảm tiền',
};

export interface PriceBook {
  id: string;
  code: string;
  name: string;
  priority: number;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
  all_stores: boolean;
  all_customers: boolean;
  allow_manual: boolean;
  notes: string | null;
  stores: { id: string; name: string }[];
  groups: { id: string; name: string; is_active: boolean }[];
  entry_count: number;
  shares_priority?: boolean;
}

export interface PriceBookInput {
  code?: string;
  name: string;
  priority?: number;
  is_active?: boolean;
  start_at?: string | null;
  end_at?: string | null;
  store_ids?: string[];
  group_ids?: string[];
  allow_manual?: boolean;
  notes?: string;
}

export interface PriceBookEntry {
  id: string;
  product_id: string;
  product_variant_id: string | null;
  product_name: string;
  sku: string;
  variant_name: string | null;
  mode: PriceBookMode;
  value: number;
  base_price: number;
  price: number;
}

export interface EntryRule {
  mode: PriceBookMode;
  value: number;
}

export interface QuoteItem {
  product_id: string;
  product_variant_id?: string | null;
}

export interface QuotedPrice {
  product_id: string;
  product_variant_id: string | null;
  unit_price: number;
  base_price: number;
  price_book_id: string | null;
  price_book_name: string | null;
  source: string;
}

export interface BookRef {
  id: string;
  code: string;
  name: string;
  priority: number;
}

export interface ImportError {
  row: number;
  message: string;
}

const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;

export const quoteKey = (i: QuoteItem) => `${i.product_id}:${i.product_variant_id ?? ''}`;

export const priceBooksApi = {
  list: async (): Promise<PriceBook[]> => (await apiClient.get('/price-books')).data,
  get: async (id: string): Promise<PriceBook> => (await apiClient.get(`/price-books/${id}`)).data,
  create: async (dto: PriceBookInput): Promise<PriceBook> => (await apiClient.post('/price-books', dto)).data,
  update: async (id: string, dto: Partial<PriceBookInput>): Promise<PriceBook> => (await apiClient.patch(`/price-books/${id}`, dto)).data,
  remove: async (id: string) => (await apiClient.delete(`/price-books/${id}`)).data,

  entries: async (id: string, q: { search?: string; page?: number; pageSize?: number }) =>
    (await apiClient.get<{ data: PriceBookEntry[]; pagination: { page: number; pageSize: number; total: number } }>(`/price-books/${id}/entries`, { params: clean(q) })).data,
  upsertEntry: async (id: string, dto: EntryRule & QuoteItem) => (await apiClient.put(`/price-books/${id}/entries`, clean(dto))).data,
  updateEntry: async (id: string, entryId: string, dto: EntryRule) => (await apiClient.patch(`/price-books/${id}/entries/${entryId}`, dto)).data,
  removeEntry: async (id: string, entryId: string) => (await apiClient.delete(`/price-books/${id}/entries/${entryId}`)).data,
  bulkAdd: async (id: string, dto: EntryRule & { product_ids?: string[]; category_id?: string; brand_id?: string }): Promise<{ created: number; skipped: number }> =>
    (await apiClient.post(`/price-books/${id}/entries/bulk`, clean(dto))).data,

  export: async (id: string): Promise<{ blob: Blob; fileName: string }> => {
    const r = await apiClient.get(`/price-books/${id}/export`, { responseType: 'blob' });
    const match = String(r.headers['content-disposition'] ?? '').match(/filename="?([^";]+)"?/);
    return { blob: r.data as Blob, fileName: match?.[1] ?? 'bang-gia.xlsx' };
  },
  import: async (id: string, file: File): Promise<{ imported: number }> => {
    const form = new FormData();
    form.append('file', file);
    return (await apiClient.post(`/price-books/${id}/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },

  quote: async (dto: { store_id: string; customer_id?: string | null; price_book_id?: string | null; items: QuoteItem[] }): Promise<{ items: QuotedPrice[] }> =>
    (await apiClient.post('/pricing/quote', clean({ ...dto, items: dto.items.map((i) => clean(i)) }))).data,
  applicableBooks: async (storeId: string, customerId?: string | null): Promise<{ automatic: BookRef[]; choosable: BookRef[] }> =>
    (await apiClient.get('/pricing/applicable-books', { params: clean({ store_id: storeId, customer_id: customerId }) })).data,
};

/** Server message of a failed call (including import row errors). */
export function priceBookError(error: unknown): { message: string; rows?: ImportError[] } {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[]; errors?: ImportError[] } | undefined;
    const m = data?.message;
    return { message: Array.isArray(m) ? m.join('; ') : (m ?? error.message), rows: data?.errors };
  }
  return { message: error instanceof Error ? error.message : 'Lỗi không xác định' };
}
