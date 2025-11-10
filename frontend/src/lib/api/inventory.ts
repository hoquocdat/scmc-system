import { apiClient } from './client';

export interface InventoryItem {
  id: string;
  location_id: string;
  product_id?: string;
  product_variant_id?: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_on_order: number;
  safety_stock: number;
  updated_at: string;
  stock_locations: {
    id: string;
    name: string;
    address?: string;
  };
  products?: {
    id: string;
    sku: string;
    name: string;
    reorder_point: number;
  };
  product_variants?: {
    id: string;
    sku: string;
    name: string;
  };
}

export interface InventoryTransaction {
  id: string;
  transaction_type: 'RECEIVE' | 'ADJUST' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'SALE' | 'RETURN';
  location_id: string;
  product_id?: string;
  product_variant_id?: string;
  quantity: number;
  unit_cost?: number;
  reference_id?: string;
  reference_type?: string;
  notes?: string;
  performed_by?: string;
  created_at: string;
}

export interface InventoryQueryParams {
  location_id?: string;
  product_id?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface InventoryResponse {
  data: InventoryItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateInventoryTransactionDto {
  transaction_type: 'RECEIVE' | 'ADJUST' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'SALE' | 'RETURN';
  location_id: string;
  product_id?: string;
  product_variant_id?: string;
  quantity: number;
  unit_cost?: number;
  reference_id?: string;
  reference_type?: string;
  notes?: string;
  performed_by?: string;
}

export const inventoryApi = {
  // Get all inventory records
  getAll: async (params?: InventoryQueryParams): Promise<InventoryResponse> => {
    const response = await apiClient.get('/inventory', { params });
    return response.data;
  },

  // Get stock levels across all locations
  getStockLevels: async (locationId?: string) => {
    const response = await apiClient.get('/inventory/stock-levels', {
      params: { locationId },
    });
    return response.data;
  },

  // Get transaction history
  getTransactionHistory: async (
    locationId?: string,
    productId?: string,
    variantId?: string,
    page?: number,
    limit?: number,
  ) => {
    const response = await apiClient.get('/inventory/transactions', {
      params: { locationId, productId, variantId, page, limit },
    });
    return response.data;
  },

  // Get single inventory record
  getById: async (id: string): Promise<InventoryItem> => {
    const response = await apiClient.get(`/inventory/${id}`);
    return response.data;
  },

  // Get inventory for specific location and product
  getByLocationAndProduct: async (
    locationId: string,
    productId: string,
    variantId?: string,
  ): Promise<InventoryItem> => {
    const response = await apiClient.get(`/inventory/location/${locationId}/product/${productId}`, {
      params: { variantId },
    });
    return response.data;
  },

  // Create inventory transaction
  createTransaction: async (data: CreateInventoryTransactionDto): Promise<InventoryTransaction> => {
    const response = await apiClient.post('/inventory/transactions', data);
    return response.data;
  },

  // Quick stock adjustment
  adjustStock: async (data: {
    locationId: string;
    productId: string;
    quantity: number;
    reason: string;
    performedBy?: string;
    variantId?: string;
  }): Promise<InventoryTransaction> => {
    const response = await apiClient.post('/inventory/adjust', data);
    return response.data;
  },

  // Update inventory record
  update: async (
    id: string,
    data: {
      quantity_on_hand?: number;
      quantity_reserved?: number;
      quantity_on_order?: number;
      safety_stock?: number;
    },
  ): Promise<InventoryItem> => {
    const response = await apiClient.patch(`/inventory/${id}`, data);
    return response.data;
  },
};
