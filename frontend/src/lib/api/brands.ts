import { apiClient } from './client';

export interface Brand {
  id: string;
  name: string;
  country_of_origin?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBrandDto {
  name: string;
  country_of_origin?: string;
  description?: string;
}

export interface UpdateBrandDto {
  name?: string;
  country_of_origin?: string;
  description?: string;
  is_active?: boolean;
}

export const brandsApi = {
  getAll: async (): Promise<Brand[]> => {
    const response = await apiClient.get('/brands');
    return response.data;
  },

  getOne: async (id: string): Promise<Brand> => {
    const response = await apiClient.get(`/brands/${id}`);
    return response.data;
  },

  create: async (data: CreateBrandDto): Promise<Brand> => {
    const response = await apiClient.post('/brands', data);
    return response.data;
  },

  update: async (id: string, data: UpdateBrandDto): Promise<Brand> => {
    const response = await apiClient.patch(`/brands/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/brands/${id}`);
  },
};
