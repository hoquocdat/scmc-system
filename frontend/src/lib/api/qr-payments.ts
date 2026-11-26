import axios from 'axios';
import { apiClient } from './client';

export type QrProviderName = 'vietqr' | 'momo' | 'zalopay' | 'vnpay';
export type QrStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

export const QR_PROVIDER_LABELS: Record<QrProviderName, string> = { vietqr: 'VietQR (chuyển khoản)', momo: 'MoMo', zalopay: 'ZaloPay', vnpay: 'VNPay' };
export const QR_STATUS_LABELS: Record<QrStatus, string> = { pending: 'Chờ thanh toán', paid: 'Đã thanh toán', failed: 'Thất bại', expired: 'Hết hạn', cancelled: 'Đã hủy' };

export interface QrRequest {
  id: string;
  code: string;
  store_id: string;
  provider: QrProviderName;
  method: 'bank_transfer' | 'ewallet_momo' | 'ewallet_zalopay' | 'ewallet_vnpay';
  amount: number;
  status: QrStatus;
  qr_content: string | null;
  pay_url: string | null;
  provider_ref: string | null;
  client_request_id: string | null;
  expires_at: string;
  paid_at: string | null;
  failure_reason: string | null;
}

export interface QrProviderSettings {
  provider: QrProviderName;
  is_enabled: boolean;
  config: Record<string, unknown>;
  cash_account_id: string | null;
  secrets: Record<string, string>;
  callback_url: string;
}

export const qrApi = {
  providers: async (storeId: string): Promise<{ provider: QrProviderName; method: string }[]> => (await apiClient.get('/qr-payments/providers', { params: { storeId } })).data,
  create: async (dto: { store_id: string; provider: QrProviderName; amount: number; client_request_id?: string; pos_session_id?: string }): Promise<QrRequest> =>
    (await apiClient.post('/qr-payments/requests', dto)).data,
  get: async (id: string): Promise<QrRequest> => (await apiClient.get(`/qr-payments/requests/${id}`)).data,
  check: async (id: string): Promise<QrRequest> => (await apiClient.post(`/qr-payments/requests/${id}/check`)).data,
  confirm: async (id: string): Promise<QrRequest> => (await apiClient.post(`/qr-payments/requests/${id}/confirm`)).data,
  cancel: async (id: string): Promise<QrRequest> => (await apiClient.post(`/qr-payments/requests/${id}/cancel`)).data,
  settings: async (storeId: string): Promise<QrProviderSettings[]> => (await apiClient.get('/qr-payments/settings', { params: { storeId } })).data,
  saveSettings: async (storeId: string, provider: QrProviderName, dto: { is_enabled?: boolean; config?: Record<string, unknown>; secrets?: Record<string, string>; cash_account_id?: string | null }) =>
    (await apiClient.put(`/qr-payments/settings/${storeId}/${provider}`, dto)).data,
};

export function qrError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const m = (error.response?.data as { message?: string | string[] } | undefined)?.message;
    return Array.isArray(m) ? m.join('; ') : (m ?? error.message);
  }
  return error instanceof Error ? error.message : 'Lỗi không xác định';
}
