import { apiClient } from './client';

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSupplierDto {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface UpdateSupplierDto {
  name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_active?: boolean;
}

export const suppliersApi = {
  getAll: async (): Promise<Supplier[]> => {
    const response = await apiClient.get('/suppliers');
    return response.data;
  },

  getOne: async (id: string): Promise<Supplier> => {
    const response = await apiClient.get(`/suppliers/${id}`);
    return response.data;
  },

  create: async (data: CreateSupplierDto): Promise<Supplier> => {
    const response = await apiClient.post('/suppliers', data);
    return response.data;
  },

  update: async (id: string, data: UpdateSupplierDto): Promise<Supplier> => {
    const response = await apiClient.patch(`/suppliers/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/suppliers/${id}`);
  },
};
