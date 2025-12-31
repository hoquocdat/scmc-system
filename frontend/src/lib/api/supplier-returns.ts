import { apiClient } from './client';

export interface SupplierReturnItem {
  id: string;
  supplier_return_id: string;
  purchase_order_item_id: string;
  product_id?: string | null;
  product_variant_id?: string | null;
  quantity_returned: number;
  unit_cost: number;
  total_cost: number;
  reason?: string | null;
  created_at: Date;
}

export interface SupplierReturn {
  id: string;
  return_number: string;
  supplier_id: string;
  purchase_order_id: string;
  return_date: Date;
  total_return_amount: number;
  reason?: string | null;
  notes?: string | null;
  status: string;
  created_by_id?: string | null;
  approved_by_id?: string | null;
  created_at: Date;
  updated_at: Date;
  supplier_return_items?: SupplierReturnItem[];
  suppliers?: any;
  purchase_orders?: any;
  user_profiles?: any;
}

export interface ReturnItemDto {
  purchase_order_item_id: string;
  quantity_returned: number;
  reason?: string;
}

export interface CreateSupplierReturnDto {
  supplier_id: string;
  purchase_order_id: string;
  return_date?: string;
  reason?: string;
  notes?: string;
  items: ReturnItemDto[];
}

export interface SupplierReturnQueryParams {
  supplierId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export const supplierReturnsApi = {
  getAll: async (params?: SupplierReturnQueryParams): Promise<SupplierReturn[]> => {
    const response = await apiClient.get('/supplier-returns', { params });
    return response.data;
  },

  getBySupplier: async (supplierId: string): Promise<SupplierReturn[]> => {
    const response = await apiClient.get(`/supplier-returns/supplier/${supplierId}`);
    return response.data;
  },

  getOne: async (id: string): Promise<SupplierReturn> => {
    const response = await apiClient.get(`/supplier-returns/${id}`);
    return response.data;
  },

  create: async (data: CreateSupplierReturnDto): Promise<SupplierReturn> => {
    const response = await apiClient.post('/supplier-returns', data);
    return response.data;
  },

  approve: async (id: string): Promise<SupplierReturn> => {
    const response = await apiClient.post(`/supplier-returns/${id}/approve`);
    return response.data;
  },
};
