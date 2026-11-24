import { apiClient } from './client';

export interface CustomerGroup {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  member_count?: number;
  price_book_count?: number;
}

export const customerGroupsApi = {
  list: async (): Promise<CustomerGroup[]> => (await apiClient.get('/customer-groups')).data,
  create: async (dto: { code: string; name: string; description?: string }): Promise<CustomerGroup> =>
    (await apiClient.post('/customer-groups', dto)).data,
  update: async (id: string, dto: { name?: string; description?: string; is_active?: boolean }): Promise<CustomerGroup> =>
    (await apiClient.patch(`/customer-groups/${id}`, dto)).data,
  remove: async (id: string) => (await apiClient.delete(`/customer-groups/${id}`)).data,
  groupsOf: async (customerId: string): Promise<CustomerGroup[]> => (await apiClient.get(`/customers/${customerId}/groups`)).data,
  setGroupsOf: async (customerId: string, groupIds: string[]): Promise<CustomerGroup[]> =>
    (await apiClient.put(`/customers/${customerId}/groups`, { group_ids: groupIds })).data,
};
