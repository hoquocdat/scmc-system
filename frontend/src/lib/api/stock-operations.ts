import axios from 'axios';
import { apiClient } from './client';
import type { ReportResult } from './reports';

export interface StockLine {
  product_id?: string;
  product_variant_id?: string;
  quantity: number;
}

export type TransferStatus = 'pending' | 'in_transit' | 'partially_received' | 'received' | 'cancelled';
export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  pending: 'Chờ xuất',
  in_transit: 'Đang chuyển',
  partially_received: 'Nhận một phần',
  received: 'Đã nhận',
  cancelled: 'Đã hủy',
};

export interface TransferSummary {
  id: string;
  transfer_number: string;
  status: TransferStatus;
  from: { id: string; name: string; code: string };
  to: { id: string; name: string; code: string };
  notes: string | null;
  requested_date: string | null;
  shipped_date: string | null;
  received_date: string | null;
  cancel_reason: string | null;
  requested_by: string | null;
  shipped_by: string | null;
  received_by: string | null;
  created_at: string;
  line_count: number;
  quantity_requested: number;
  quantity_shipped: number;
  quantity_received: number;
  quantity_discrepancy: number;
}

export interface TransferItem {
  id: string;
  product_id: string | null;
  product_variant_id: string | null;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  quantity_requested: number;
  quantity_shipped: number;
  quantity_received: number;
  quantity_discrepancy: number;
}

export type Transfer = TransferSummary & { items: TransferItem[] };

export interface CountItem {
  id: string;
  product_id: string | null;
  product_variant_id: string | null;
  name: string;
  sku: string;
  barcode: string | null;
  system_quantity: number;
  system_at_count: number | null;
  counted_quantity: number | null;
  counted_at: string | null;
  difference: number | null;
  difference_value: number | null;
  unit_cost: number;
}

export interface StockCount {
  id: string;
  count_number: string;
  location_id: string;
  status: 'counting' | 'completed' | 'cancelled';
  scope: { type: 'all' | 'category' | 'brand' | 'products' };
  note: string | null;
  created_at: string;
  completed_at: string | null;
  stock_locations: { id: string; name: string };
  item_count?: number;
  counted_count?: number;
  items?: CountItem[];
  summary?: { items: number; counted: number; surplus: number; shortage: number; value: number };
}

export const WRITE_OFF_REASON_LABELS: Record<string, string> = {
  damaged: 'Hư hỏng',
  lost: 'Mất',
  internal_use: 'Dùng nội bộ',
  expired: 'Hết hạn',
  other: 'Khác',
};

export interface WriteOffRow extends Record<string, unknown> {
  id: string;
  createdAt: string;
  number: string;
  location: string;
  reason: string;
  lines: number;
  totalCost: number;
  note: string;
  createdBy: string;
}

export interface CodeLookup {
  kind: 'product' | 'variant' | 'unit';
  product_id: string;
  variant_id: string | null;
  unit_id: string | null;
  unit_name: string | null;
  unit_factor: number;
  name: string;
  sku: string;
  barcode: string | null;
}

export interface ProductUnit {
  id: string;
  name: string;
  factor: number;
  barcode: string | null;
  price: number | null;
  is_active: boolean;
}

export interface ReorderAlert {
  location_id: string;
  location_name: string;
  product_id: string | null;
  product_variant_id: string | null;
  name: string;
  sku: string;
  on_hand: number;
  reserved: number;
  available: number;
  threshold: number;
  suggested: number;
  supplier_id: string | null;
  unit_cost: number;
}

const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;

export const stockOpsApi = {
  // transfers
  transfers: async (q: { status?: string; locationId?: string; page?: number; pageSize?: number }) =>
    (await apiClient.get<{ data: TransferSummary[]; pagination: { page: number; pageSize: number; total: number } }>('/stock-transfers', { params: clean(q) })).data,
  transfer: async (id: string): Promise<Transfer> => (await apiClient.get(`/stock-transfers/${id}`)).data,
  createTransfer: async (dto: { from_location_id: string; to_location_id: string; notes?: string; items: StockLine[] }): Promise<Transfer> =>
    (await apiClient.post('/stock-transfers', dto)).data,
  ship: async (id: string, items?: { item_id: string; quantity: number }[]): Promise<Transfer> => (await apiClient.post(`/stock-transfers/${id}/ship`, { items })).data,
  receive: async (id: string, items: { item_id: string; quantity: number }[], close: boolean): Promise<Transfer> =>
    (await apiClient.post(`/stock-transfers/${id}/receive`, { items, close })).data,
  cancelTransfer: async (id: string, reason: string): Promise<Transfer> => (await apiClient.post(`/stock-transfers/${id}/cancel`, { reason })).data,

  // counts
  counts: async (locationId?: string): Promise<StockCount[]> => (await apiClient.get('/stock-counts', { params: clean({ locationId }) })).data,
  count: async (id: string): Promise<StockCount> => (await apiClient.get(`/stock-counts/${id}`)).data,
  startCount: async (dto: { location_id: string; scope: { type: string; category_id?: string; brand_id?: string; product_ids?: string[] }; note?: string }): Promise<StockCount> =>
    (await apiClient.post('/stock-counts', dto)).data,
  enterCount: async (id: string, dto: { item_id?: string; code?: string; quantity?: number; increment?: number }) => (await apiClient.post(`/stock-counts/${id}/entries`, dto)).data,
  completeCount: async (id: string): Promise<StockCount> => (await apiClient.post(`/stock-counts/${id}/complete`)).data,
  cancelCount: async (id: string): Promise<StockCount> => (await apiClient.post(`/stock-counts/${id}/cancel`)).data,

  // write-offs
  writeOffs: async (q: { from?: string; to?: string; locationId?: string; reason?: string }) =>
    (await apiClient.get<ReportResult<WriteOffRow>>('/stock-write-offs', { params: clean(q) })).data,
  createWriteOff: async (dto: { location_id: string; reason: string; note?: string; items: StockLine[] }) => (await apiClient.post('/stock-write-offs', dto)).data,

  // codes and units
  lookup: async (code: string): Promise<CodeLookup> => (await apiClient.get('/inventory-codes/lookup', { params: { code } })).data,
  setBarcode: async (type: 'product' | 'variant', id: string, barcode: string | null) =>
    (await apiClient.put(`/${type === 'product' ? 'products' : 'product-variants'}/${id}/barcode`, { barcode })).data,
  generateBarcode: async (type: 'product' | 'variant', id: string): Promise<{ id: string; barcode: string }> =>
    (await apiClient.post(`/${type === 'product' ? 'products' : 'product-variants'}/${id}/barcode/generate`)).data,
  units: async (productId: string): Promise<{ base_unit: string; units: ProductUnit[] }> => (await apiClient.get(`/products/${productId}/units`)).data,
  setBaseUnit: async (productId: string, base_unit: string) => (await apiClient.put(`/products/${productId}/base-unit`, { base_unit })).data,
  addUnit: async (productId: string, dto: Omit<ProductUnit, 'id' | 'is_active'> & { is_active?: boolean }) => (await apiClient.post(`/products/${productId}/units`, clean(dto))).data,
  updateUnit: async (productId: string, unitId: string, dto: Partial<ProductUnit>) => (await apiClient.patch(`/products/${productId}/units/${unitId}`, dto)).data,
  removeUnit: async (productId: string, unitId: string) => (await apiClient.delete(`/products/${productId}/units/${unitId}`)).data,

  // reorder
  reorderAlerts: async (locationId?: string): Promise<ReorderAlert[]> => (await apiClient.get('/inventory-alerts/reorder', { params: clean({ locationId }) })).data,
  reorderSummary: async (): Promise<{ total: number; locations: { location_id: string; location_name: string; count: number }[] }> =>
    (await apiClient.get('/inventory-alerts/reorder/summary')).data,
  reorderPurchaseOrder: async (dto: { supplier_id: string; notes?: string; items: StockLine[] }): Promise<{ id: string; order_number: string }> =>
    (await apiClient.post('/inventory-alerts/reorder/purchase-order', dto)).data,
};

/** Server message (with stock shortages when present). */
export function stockError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const m = data?.message;
    return Array.isArray(m) ? m.join('; ') : (m ?? error.message);
  }
  return error instanceof Error ? error.message : 'Lỗi không xác định';
}

/** stock line from a product search pick. */
export const lineOf = (product: { id: string }, variant?: { id: string } | null): Omit<StockLine, 'quantity'> =>
  variant ? { product_variant_id: variant.id } : { product_id: product.id };
