import { apiClient } from './client';

export const PosSessionStatus = {
  OPEN: 'open' as const,
  CLOSED: 'closed' as const,
};

export type PosSessionStatus = typeof PosSessionStatus[keyof typeof PosSessionStatus];

export const PosTransactionType = {
  CASH_IN: 'cash_in' as const,
  CASH_OUT: 'cash_out' as const,
  OPENING_BALANCE: 'opening_balance' as const,
  CLOSING_BALANCE: 'closing_balance' as const,
};

export type PosTransactionType = typeof PosTransactionType[keyof typeof PosTransactionType];

export interface PosSession {
  id: string;
  session_number: string;
  location_id: string;
  user_id: string;
  status: PosSessionStatus;
  opening_cash: number;
  closing_cash?: number;
  expected_cash?: number;
  cash_difference?: number;
  opened_at: string;
  closed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  stock_locations?: {
    id: string;
    name: string;
  };
  user_profiles?: {
    id: string;
    full_name: string;
    email: string;
  };
  pos_session_transactions?: PosTransaction[];
}

export interface PosTransaction {
  id: string;
  pos_session_id: string;
  transaction_type: PosTransactionType;
  amount: number;
  reason?: string;
  notes?: string;
  created_at: string;
}

export interface PosSessionStats {
  session_id: string;
  session_number: string;
  status: PosSessionStatus;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number;
  cash_difference: number | null;
  total_cash_in: number;
  total_cash_out: number;
  net_transactions: number;
  transaction_count: number;
}

export interface PosSessionQueryParams {
  location_id?: string;
  user_id?: string;
  status?: PosSessionStatus;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PosSessionsResponse {
  data: PosSession[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreatePosSessionDto {
  location_id: string;
  user_id: string;
  opening_cash: number;
  notes?: string;
}

export interface ClosePosSessionDto {
  closing_cash: number;
  notes?: string;
}

export interface CreatePosTransactionDto {
  pos_session_id: string;
  transaction_type: PosTransactionType;
  amount: number;
  reason?: string;
  notes?: string;
}

export const posApi = {
  // Get all POS sessions
  getAll: async (params?: PosSessionQueryParams): Promise<PosSessionsResponse> => {
    const response = await apiClient.get('/pos/sessions', { params });
    return response.data;
  },

  // Get single POS session
  getById: async (id: string): Promise<PosSession> => {
    const response = await apiClient.get(`/pos/sessions/${id}`);
    return response.data;
  },

  // Get current open session for user at location
  getCurrentSession: async (userId: string, locationId: string): Promise<PosSession> => {
    const response = await apiClient.get(`/pos/sessions/current/${userId}/${locationId}`);
    return response.data;
  },

  // Create POS session
  create: async (data: CreatePosSessionDto): Promise<PosSession> => {
    const response = await apiClient.post('/pos/sessions', data);
    return response.data;
  },

  // Close POS session
  close: async (id: string, data: ClosePosSessionDto): Promise<PosSession> => {
    const response = await apiClient.patch(`/pos/sessions/${id}/close`, data);
    return response.data;
  },

  // Add transaction to session
  addTransaction: async (data: CreatePosTransactionDto): Promise<PosTransaction> => {
    const response = await apiClient.post('/pos/transactions', data);
    return response.data;
  },

  // Get session statistics
  getStats: async (id: string): Promise<PosSessionStats> => {
    const response = await apiClient.get(`/pos/sessions/${id}/stats`);
    return response.data;
  },
};
