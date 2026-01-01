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

export interface CustomerReceivable {
  id: string;
  customer_id: string;
  sales_order_id: string;
  original_amount: number;
  paid_amount: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid';
  due_date?: string;
  created_at: string;
  updated_at: string;
  sales_orders?: {
    id: string;
    order_number: string;
    total_amount: number;
    created_at: string;
  };
}

export interface CustomerReceivablesResponse {
  receivables: CustomerReceivable[];
  summary: {
    total_original: number;
    total_paid: number;
    total_balance: number;
  };
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  payment_status: string;
  total_amount: number;
  paid_amount?: number;
  created_at: string;
  stores?: {
    id: string;
    name: string;
    code: string;
  };
  sales_order_items?: {
    id: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    products?: {
      id: string;
      name: string;
      sku?: string;
    };
  }[];
}

export interface CustomerOrdersResponse {
  data: CustomerOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type ReceivablePaymentMethod =
  | 'cash'
  | 'card'
  | 'bank_transfer'
  | 'ewallet_momo'
  | 'ewallet_zalopay'
  | 'ewallet_vnpay';

export interface RecordReceivablePaymentDto {
  customer_id: string;
  sales_order_id?: string; // Optional - if not provided, FIFO is used
  amount: number;
  payment_method: ReceivablePaymentMethod;
  transaction_id?: string;
  notes?: string;
}

export interface RecordReceivablePaymentResponse {
  success: boolean;
  message: string;
  payment_details: {
    order_number: string;
    amount_applied: number;
  }[];
  updated_summary: {
    total_original: number;
    total_paid: number;
    total_balance: number;
  };
}

export interface ReceivablePaymentHistoryItem {
  id: string;
  payment_method: string;
  amount: number;
  transaction_id?: string;
  notes?: string;
  created_at: string;
  sales_orders: {
    id: string;
    order_number: string;
    total_amount: number;
  };
  user_profiles?: {
    id: string;
    full_name: string;
  };
}

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

  // Get customer receivables (công nợ)
  getReceivables: async (id: string): Promise<CustomerReceivablesResponse> => {
    const response = await apiClient.get(`/customers/${id}/receivables`);
    return response.data;
  },

  // Get customer order history
  getOrders: async (
    id: string,
    params?: { page?: number; limit?: number }
  ): Promise<CustomerOrdersResponse> => {
    const response = await apiClient.get(`/customers/${id}/orders`, { params });
    return response.data;
  },

  // Record a payment against customer receivables
  recordReceivablePayment: async (
    id: string,
    data: Omit<RecordReceivablePaymentDto, 'customer_id'>
  ): Promise<RecordReceivablePaymentResponse> => {
    const response = await apiClient.post(`/customers/${id}/receivables/payment`, {
      ...data,
      customer_id: id,
    });
    return response.data;
  },

  // Get payment history for customer receivables
  getReceivablePaymentHistory: async (
    id: string
  ): Promise<ReceivablePaymentHistoryItem[]> => {
    const response = await apiClient.get(`/customers/${id}/receivables/payments`);
    return response.data;
  },
};

// Payment method labels for UI
export const RECEIVABLE_PAYMENT_METHOD_LABELS: Record<ReceivablePaymentMethod, string> = {
  cash: 'Tiền mặt',
  card: 'Thẻ',
  bank_transfer: 'Chuyển khoản',
  ewallet_momo: 'MoMo',
  ewallet_zalopay: 'ZaloPay',
  ewallet_vnpay: 'VNPay',
};
