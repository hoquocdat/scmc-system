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

export interface SupplierAccountsPayable {
  supplier_id: string;
  total_purchases: number;
  total_returns: number;
  total_payments: number;
  balance_due: number;
}

export interface SupplierTransaction {
  id: string;
  transaction_type: 'purchase' | 'return' | 'payment';
  supplier_id: string;
  reference_number: string;
  amount: number;
  transaction_date: Date;
  notes?: string | null;
  created_at: Date;
}

export interface OutstandingPurchaseOrder {
  id: string;
  order_number: string;
  order_date: Date;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  payment_status: string;
  items_count: number;
  payments: Array<{
    payment_id: string;
    payment_number: string;
    payment_date: Date;
    amount_allocated: number;
  }>;
}

export interface SupplierDetails extends Supplier {
  accounts_payable: SupplierAccountsPayable;
  outstanding_purchase_orders: OutstandingPurchaseOrder[];
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

  getDetails: async (id: string): Promise<SupplierDetails> => {
    const response = await apiClient.get(`/suppliers/${id}/details`);
    return response.data;
  },

  getAccountsPayable: async (id: string): Promise<SupplierAccountsPayable> => {
    const response = await apiClient.get(`/suppliers/${id}/accounts-payable`);
    return response.data;
  },

  getTransactionHistory: async (id: string): Promise<SupplierTransaction[]> => {
    const response = await apiClient.get(`/suppliers/${id}/transaction-history`);
    return response.data;
  },

  getPurchaseHistory: async (id: string): Promise<any[]> => {
    const response = await apiClient.get(`/suppliers/${id}/purchase-history`);
    return response.data;
  },

  getOutstandingPurchaseOrders: async (id: string): Promise<OutstandingPurchaseOrder[]> => {
    const response = await apiClient.get(`/suppliers/${id}/outstanding-purchase-orders`);
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
