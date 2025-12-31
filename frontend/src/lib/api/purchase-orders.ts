import { apiClient } from './client';

export type PurchaseOrderStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
export type PurchaseOrderPaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id?: string | null;
  product_variant_id?: string | null;
  product_name: string;
  product_sku?: string | null;
  variant_name?: string | null;
  quantity_ordered: number;
  quantity_received: number;
  quantity_returned: number;
  unit_cost: number;
  total_cost: number;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
  products?: any;
  product_variants?: any;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  payment_status: PurchaseOrderPaymentStatus;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  order_date: Date;
  expected_delivery_date?: Date | null;
  actual_delivery_date?: Date | null;
  submitted_at?: Date | null;
  submitted_by?: string | null;
  approved_at?: Date | null;
  approved_by?: string | null;
  rejected_at?: Date | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
  stock_updated: boolean;
  stock_updated_at?: Date | null;
  notes?: string | null;
  internal_notes?: string | null;
  created_by_id?: string | null;
  updated_by_id?: string | null;
  created_at: Date;
  updated_at: Date;
  purchase_order_items?: PurchaseOrderItem[];
  supplier_payment_allocations?: any[];
  suppliers?: any;
  user_profiles?: any;
}

export interface CreatePurchaseOrderItemDto {
  product_id?: string;
  product_variant_id?: string;
  product_name: string;
  product_sku?: string;
  variant_name?: string;
  quantity_ordered: number;
  unit_cost: number;
  notes?: string;
}

export interface CreatePurchaseOrderDto {
  supplier_id: string;
  expected_delivery_date?: string;
  tax_amount?: number;
  shipping_cost?: number;
  discount_amount?: number;
  notes?: string;
  internal_notes?: string;
  items?: CreatePurchaseOrderItemDto[];
}

export interface UpdatePurchaseOrderDto {
  expected_delivery_date?: string;
  tax_amount?: number;
  shipping_cost?: number;
  discount_amount?: number;
  notes?: string;
  internal_notes?: string;
}

export interface AddPurchaseOrderItemDto {
  product_id?: string;
  product_variant_id?: string;
  product_name: string;
  product_sku?: string;
  variant_name?: string;
  quantity_ordered: number;
  unit_cost: number;
  notes?: string;
}

export interface UpdatePurchaseOrderItemDto {
  product_name?: string;
  product_sku?: string;
  variant_name?: string;
  quantity_ordered?: number;
  unit_cost?: number;
  notes?: string;
}

export interface PurchaseOrderQueryParams {
  search?: string;
  supplier_id?: string;
  status?: PurchaseOrderStatus;
  payment_status?: PurchaseOrderPaymentStatus;
  order_date_from?: string;
  order_date_to?: string;
  expected_delivery_from?: string;
  expected_delivery_to?: string;
}

export const purchaseOrdersApi = {
  getAll: async (params?: PurchaseOrderQueryParams): Promise<PurchaseOrder[]> => {
    const response = await apiClient.get('/purchase-orders', { params });
    return response.data;
  },

  getOne: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.get(`/purchase-orders/${id}`);
    return response.data;
  },

  create: async (data: CreatePurchaseOrderDto): Promise<PurchaseOrder> => {
    const response = await apiClient.post('/purchase-orders', data);
    return response.data;
  },

  update: async (id: string, data: UpdatePurchaseOrderDto): Promise<PurchaseOrder> => {
    const response = await apiClient.patch(`/purchase-orders/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/purchase-orders/${id}`);
  },

  // Item management
  addItem: async (id: string, data: AddPurchaseOrderItemDto): Promise<PurchaseOrderItem> => {
    const response = await apiClient.post(`/purchase-orders/${id}/items`, data);
    return response.data;
  },

  updateItem: async (
    id: string,
    itemId: string,
    data: UpdatePurchaseOrderItemDto
  ): Promise<PurchaseOrderItem> => {
    const response = await apiClient.patch(`/purchase-orders/${id}/items/${itemId}`, data);
    return response.data;
  },

  removeItem: async (id: string, itemId: string): Promise<void> => {
    await apiClient.delete(`/purchase-orders/${id}/items/${itemId}`);
  },

  // Workflow actions
  submitForApproval: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/purchase-orders/${id}/submit`);
    return response.data;
  },

  approve: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/purchase-orders/${id}/approve`);
    return response.data;
  },

  reject: async (id: string, reason?: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/purchase-orders/${id}/reject`, { reason });
    return response.data;
  },

  cancel: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/purchase-orders/${id}/cancel`);
    return response.data;
  },
};
