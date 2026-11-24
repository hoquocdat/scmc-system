import { apiClient } from './client';

export interface VoucherCampaign {
  id: string;
  code: string;
  name: string;
  discount_kind: 'percent' | 'amount';
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number | null;
  start_at: string | null;
  end_at: string | null;
  all_stores: boolean;
  channels: string[] | null;
  uses_per_code: number;
  uses_per_customer: number | null;
  combinable_with_promotions: boolean;
  is_active: boolean;
  notes: string | null;
  stores: { id: string; name: string }[];
  stats: { codes: number; used_codes: number; uses: number; discount: number };
}

export type CampaignInput = Partial<Omit<VoucherCampaign, 'id' | 'stores' | 'stats' | 'all_stores'>> & { store_ids?: string[] };

export interface VoucherCode {
  id: string;
  code: string;
  is_active: boolean;
  used_count: number;
  created_at: string;
}

export const vouchersApi = {
  list: async (): Promise<VoucherCampaign[]> => (await apiClient.get('/voucher-campaigns')).data,
  get: async (id: string): Promise<VoucherCampaign> => (await apiClient.get(`/voucher-campaigns/${id}`)).data,
  create: async (dto: CampaignInput): Promise<VoucherCampaign> => (await apiClient.post('/voucher-campaigns', dto)).data,
  update: async (id: string, dto: CampaignInput): Promise<VoucherCampaign> => (await apiClient.patch(`/voucher-campaigns/${id}`, dto)).data,
  remove: async (id: string) => (await apiClient.delete(`/voucher-campaigns/${id}`)).data,
  generate: async (id: string, dto: { code?: string; count?: number; prefix?: string }): Promise<{ created: number; codes: string[] }> =>
    (await apiClient.post(`/voucher-campaigns/${id}/codes`, dto)).data,
  codes: async (id: string, q: { search?: string; status?: 'all' | 'used' | 'unused'; page?: number; pageSize?: number }) =>
    (await apiClient.get<{ data: VoucherCode[]; pagination: { page: number; pageSize: number; total: number } }>(`/voucher-campaigns/${id}/codes`, { params: q })).data,
  setCodeActive: async (id: string, codeId: string, is_active: boolean) => (await apiClient.patch(`/voucher-campaigns/${id}/codes/${codeId}`, { is_active })).data,
  export: async (id: string): Promise<{ blob: Blob; fileName: string }> => {
    const r = await apiClient.get(`/voucher-campaigns/${id}/export`, { responseType: 'blob' });
    const match = String(r.headers['content-disposition'] ?? '').match(/filename="?([^";]+)"?/);
    return { blob: r.data as Blob, fileName: match?.[1] ?? 'vouchers.csv' };
  },
};
