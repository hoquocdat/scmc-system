import { apiClient } from './client';

export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  address?: string;
  customer_type: 'individual' | 'company';
  company_name?: string;
  tax_code?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerQueryParams {
  search?: string;
  customer_type?: 'individual' | 'company';
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CustomersResponse {
  data: Customer[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateCustomerDto {
  full_name: string;
  phone: string;
  email?: string;
  address?: string;
  customer_type: 'individual' | 'company';
  company_name?: string;
  tax_code?: string;
  notes?: string;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export const customersApi = {
  // Get all customers with filtering
  getAll: async (params?: CustomerQueryParams): Promise<CustomersResponse> => {
    const response = await apiClient.get('/customers', { params });
    return response.data;
  },

  // Get single customer by ID
  getById: async (id: string): Promise<Customer> => {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data;
  },

  // Create new customer
  create: async (data: CreateCustomerDto): Promise<Customer> => {
    const response = await apiClient.post('/customers', data);
    return response.data;
  },

  // Update customer
  update: async (id: string, data: UpdateCustomerDto): Promise<Customer> => {
    const response = await apiClient.patch(`/customers/${id}`, data);
    return response.data;
  },

  // Delete customer
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/customers/${id}`);
  },
};
