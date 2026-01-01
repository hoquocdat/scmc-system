import { apiClient } from './client';

export interface Store {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  is_default: boolean;
  default_warehouse_id?: string;
  stock_locations?: {
    id: string;
    name: string;
    code: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateStoreDto {
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
  is_default?: boolean;
  default_warehouse_id?: string;
}

export interface UpdateStoreDto extends Partial<CreateStoreDto> {}

export const storesApi = {
  // Get all stores
  getAll: async (): Promise<Store[]> => {
    const response = await apiClient.get('/stores');
    return response.data;
  },

  // Get single store by ID
  getById: async (id: string): Promise<Store> => {
    const response = await apiClient.get(`/stores/${id}`);
    return response.data;
  },

  // Create new store
  create: async (data: CreateStoreDto): Promise<Store> => {
    const response = await apiClient.post('/stores', data);
    return response.data;
  },

  // Update store
  update: async (id: string, data: UpdateStoreDto): Promise<Store> => {
    const response = await apiClient.patch(`/stores/${id}`, data);
    return response.data;
  },

  // Delete store
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/stores/${id}`);
  },
};
