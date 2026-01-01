import { apiClient } from './client';

export type OrderStatus = 'draft' | 'pending' | 'confirmed' | 'processing' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export type SalesChannel = 'retail_store' | 'workshop' | 'online' | 'phone';
export type DiscountType = 'fixed' | 'percent';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'ewallet_momo' | 'ewallet_zalopay' | 'ewallet_vnpay';

export interface SalesOrder {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  channel: SalesChannel;
  store_id?: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  discount_type?: DiscountType;
  discount_percent?: number;
  discount_amount: number;
  tax_amount: number;
  shipping_cost?: number;
  total_amount: number;
  paid_amount?: number;
  shipping_address?: string;
  shipping_city?: string;
  shipping_method?: string;
  tracking_number?: string;
  order_date?: string;
  payment_date?: string;
  shipped_date?: string;
  delivered_date?: string;
  notes?: string;
  internal_notes?: string;
  created_by?: string;
  processed_by?: string;
  created_at: string;
  updated_at: string;
  customers?: {
    id: string;
    full_name: string;
    phone?: string;
    email?: string;
  };
  stores?: {
    id: string;
    name: string;
    code: string;
  };
  user_profiles_sales_orders_created_byTouser_profiles?: {
    id: string;
    full_name: string;
  };
  user_profiles_sales_orders_processed_byTouser_profiles?: {
    id: string;
    full_name: string;
  };
  sales_order_items?: SalesOrderItem[];
  sales_order_payments?: SalesOrderPayment[];
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id: string;
  product_variant_id?: string;
  product_name?: string;
  product_sku?: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount: number;
  notes?: string;
  products?: {
    id: string;
    sku?: string;
    name: string;
    base_price?: number;
  };
  product_variants?: {
    id: string;
    sku?: string;
    name: string;
    price?: number;
  };
}

export interface SalesOrderPayment {
  id: string;
  sales_order_id: string;
  payment_method: PaymentMethod;
  amount: number;
  payment_date?: string;
  transaction_id?: string;
  authorization_code?: string;
  amount_tendered?: number;
  change_given?: number;
  status?: string;
  notes?: string;
  received_by?: string;
  created_at: string;
  user_profiles?: {
    id: string;
    full_name: string;
  };
}

export interface SalesOrderQueryParams {
  search?: string;
  customer_id?: string;
  store_id?: string;
  created_by?: string;
  processed_by?: string;
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

export interface CreateSalesOrderItemDto {
  product_id: string;
  product_variant_id?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string;
}

export interface CreateSalesOrderDto {
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  channel: SalesChannel;
  store_id: string;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  items: CreateSalesOrderItemDto[];
  subtotal?: number;
  discount_type?: DiscountType;
  discount_percent?: number;
  discount_amount?: number;
  tax_amount?: number;
  shipping_cost?: number;
  total_amount?: number;
  shipping_address?: string;
  shipping_city?: string;
  notes?: string;
  created_by?: string;
}

export interface CreatePaymentDto {
  sales_order_id: string;
  payment_method: PaymentMethod;
  amount: number;
  transaction_id?: string;
  authorization_code?: string;
  amount_tendered?: number;
  change_given?: number;
  notes?: string;
  received_by?: string;
}

export interface AddOrderItemDto {
  product_id: string;
  product_variant_id?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string;
}

export interface SalesStatistics {
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalDiscounts: number;
}

export interface EmployeeReportItem {
  employee_id: string;
  employee_name: string;
  order_count: number;
  total_revenue: number;
  total_discount: number;
}

export interface ChannelReportItem {
  channel: string;
  order_count: number;
  total_revenue: number;
  total_discount: number;
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

  // Confirm sales order (draft -> confirmed)
  confirm: async (id: string): Promise<SalesOrder> => {
    const response = await apiClient.post(`/sales/${id}/confirm`);
    return response.data;
  },

  // Update sales order status
  updateStatus: async (id: string, status: OrderStatus): Promise<SalesOrder> => {
    const response = await apiClient.post(`/sales/${id}/status`, { status });
    return response.data;
  },

  // Cancel sales order
  cancel: async (id: string): Promise<SalesOrder> => {
    const response = await apiClient.post(`/sales/${id}/cancel`);
    return response.data;
  },

  // Add payment
  addPayment: async (data: CreatePaymentDto): Promise<SalesOrderPayment> => {
    const response = await apiClient.post('/sales/payments', data);
    return response.data;
  },

  // Add item to order (for unpaid orders)
  addItem: async (orderId: string, data: AddOrderItemDto): Promise<SalesOrderItem> => {
    const response = await apiClient.post(`/sales/${orderId}/items`, data);
    return response.data;
  },

  // Remove item from order (for unpaid orders)
  removeItem: async (orderId: string, itemId: string): Promise<void> => {
    await apiClient.delete(`/sales/${orderId}/items/${itemId}`);
  },

  // Get statistics
  getStatistics: async (params?: {
    from_date?: string;
    to_date?: string;
    created_by?: string;
    channel?: string;
  }): Promise<SalesStatistics> => {
    const response = await apiClient.get('/sales/statistics', { params });
    return response.data;
  },

  // Get report by employee
  getReportByEmployee: async (params?: {
    from_date?: string;
    to_date?: string;
    employee_id?: string;
  }): Promise<EmployeeReportItem[]> => {
    const response = await apiClient.get('/sales/reports/by-employee', { params });
    return response.data;
  },

  // Get report by channel
  getReportByChannel: async (params?: {
    from_date?: string;
    to_date?: string;
    employee_id?: string;
  }): Promise<ChannelReportItem[]> => {
    const response = await apiClient.get('/sales/reports/by-channel', { params });
    return response.data;
  },

  // Get employees who have created sales orders (for filters)
  getSalesEmployees: async (): Promise<{ id: string; name: string }[]> => {
    const response = await apiClient.get('/sales/reports/employees');
    return response.data;
  },
};

// Helper constants for UI
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thanh toán',
  partial: 'Thanh toán một phần',
  paid: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
};

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  retail_store: 'Cửa hàng',
  workshop: 'Xưởng',
  online: 'Trực tuyến',
  phone: 'Điện thoại',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  card: 'Thẻ',
  bank_transfer: 'Chuyển khoản',
  ewallet_momo: 'MoMo',
  ewallet_zalopay: 'ZaloPay',
  ewallet_vnpay: 'VNPay',
};
