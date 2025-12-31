import { apiClient } from './client';

export interface StockLocation {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStockLocationDto {
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  is_active?: boolean;
  is_default?: boolean;
}

export interface UpdateStockLocationDto extends Partial<CreateStockLocationDto> {}

export const stockLocationsApi = {
  // Get all stock locations
  getAll: async (): Promise<StockLocation[]> => {
    const response = await apiClient.get('/stock-locations');
    return response.data;
  },

  // Get single stock location by ID
  getById: async (id: string): Promise<StockLocation> => {
    const response = await apiClient.get(`/stock-locations/${id}`);
    return response.data;
  },

  // Create new stock location
  create: async (data: CreateStockLocationDto): Promise<StockLocation> => {
    const response = await apiClient.post('/stock-locations', data);
    return response.data;
  },

  // Update stock location
  update: async (id: string, data: UpdateStockLocationDto): Promise<StockLocation> => {
    const response = await apiClient.patch(`/stock-locations/${id}`, data);
    return response.data;
  },

  // Delete stock location
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/stock-locations/${id}`);
  },
};
