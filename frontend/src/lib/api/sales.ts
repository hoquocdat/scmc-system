import { apiClient } from './client';

export interface SalesOrder {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  channel: 'retail_store' | 'workshop' | 'online' | 'phone';
  location_id: string;
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_cost?: number;
  total_amount: number;
  customer_address?: string;
  delivery_city?: string;
  delivery_district?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  sales_order_items?: SalesOrderItem[];
  sales_order_payments?: SalesOrderPayment[];
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id: string;
  product_variant_id?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  total_price: number;
  notes?: string;
  products?: {
    id: string;
    sku: string;
    name: string;
  };
}

export interface SalesOrderPayment {
  id: string;
  sales_order_id: string;
  payment_method: string;
  amount: number;
  payment_reference?: string;
  notes?: string;
  created_at: string;
}

export interface SalesOrderQueryParams {
  search?: string;
  customer_id?: string;
  location_id?: string;
  sales_staff_id?: string;
  status?: string;
  payment_status?: string;
  channel?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface SalesOrdersResponse {
  data: SalesOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateSalesOrderDto {
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  channel: string;
  location_id: string;
  status?: string;
  payment_status?: string;
  items: {
    product_id: string;
    product_variant_id?: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
    tax_amount?: number;
    notes?: string;
  }[];
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  shipping_cost?: number;
  total_amount?: number;
  customer_address?: string;
  delivery_city?: string;
  delivery_district?: string;
  notes?: string;
  sales_staff_id?: string;
}

export interface CreatePaymentDto {
  sales_order_id: string;
  payment_method: string;
  amount: number;
  payment_reference?: string;
  notes?: string;
  processed_by?: string;
}

export const salesApi = {
  // Get all sales orders
  getAll: async (params?: SalesOrderQueryParams): Promise<SalesOrdersResponse> => {
    const response = await apiClient.get('/sales', { params });
    return response.data;
  },

  // Get single sales order
  getById: async (id: string): Promise<SalesOrder> => {
    const response = await apiClient.get(`/sales/${id}`);
    return response.data;
  },

  // Create sales order
  create: async (data: CreateSalesOrderDto): Promise<SalesOrder> => {
    const response = await apiClient.post('/sales', data);
    return response.data;
  },

  // Update sales order
  update: async (id: string, data: Partial<CreateSalesOrderDto>): Promise<SalesOrder> => {
    const response = await apiClient.patch(`/sales/${id}`, data);
    return response.data;
  },

  // Cancel sales order
  cancel: async (id: string): Promise<SalesOrder> => {
    const response = await apiClient.post(`/sales/${id}/cancel`);
    return response.data;
  },

  // Add payment
  addPayment: async (data: CreatePaymentDto) => {
    const response = await apiClient.post('/sales/payments', data);
    return response.data;
  },
};
