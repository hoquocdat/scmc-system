import { apiClient } from './client';

export type SupplierPaymentMethod =
  | 'cash'
  | 'card'
  | 'transfer'
  | 'bank_transfer'
  | 'ewallet_momo'
  | 'ewallet_zalopay'
  | 'ewallet_vnpay';

export interface PaymentAllocation {
  id: string;
  supplier_payment_id: string;
  purchase_order_id: string;
  amount_allocated: number;
  created_at: Date;
}

export interface SupplierPayment {
  id: string;
  payment_number: string;
  supplier_id: string;
  amount: number;
  payment_method: SupplierPaymentMethod;
  payment_date: Date;
  transaction_id?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  created_by_id?: string | null;
  created_at: Date;
  updated_at: Date;
  supplier_payment_allocations?: PaymentAllocation[];
  suppliers?: any;
  user_profiles?: any;
}

export interface PaymentAllocationDto {
  purchase_order_id: string;
  amount_allocated: number;
}

export interface CreateSupplierPaymentDto {
  supplier_id: string;
  amount: number;
  payment_method: SupplierPaymentMethod;
  payment_date?: string;
  transaction_id?: string;
  reference_number?: string;
  notes?: string;
  allocations?: PaymentAllocationDto[];
}

export interface SupplierPaymentQueryParams {
  supplierId?: string;
  startDate?: string;
  endDate?: string;
}

export const supplierPaymentsApi = {
  getAll: async (params?: SupplierPaymentQueryParams): Promise<SupplierPayment[]> => {
    const response = await apiClient.get('/supplier-payments', { params });
    return response.data;
  },

  getBySupplier: async (supplierId: string): Promise<SupplierPayment[]> => {
    const response = await apiClient.get(`/supplier-payments/supplier/${supplierId}`);
    return response.data;
  },

  getOne: async (id: string): Promise<SupplierPayment> => {
    const response = await apiClient.get(`/supplier-payments/${id}`);
    return response.data;
  },

  create: async (data: CreateSupplierPaymentDto): Promise<SupplierPayment> => {
    const response = await apiClient.post('/supplier-payments', data);
    return response.data;
  },
};
