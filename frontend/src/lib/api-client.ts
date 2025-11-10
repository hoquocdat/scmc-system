import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class APIClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Get JWT token from Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error');
    }
  }

  // Customers
  customers = {
    getAll: (page = 1, limit = 10) =>
      this.request(`/customers?page=${page}&limit=${limit}`),
    getOne: (id: string) =>
      this.request(`/customers/${id}`),
    checkPhone: (phone: string) =>
      this.request(`/customers/check-phone/${encodeURIComponent(phone)}`),
    create: (data: any) =>
      this.request(`/customers`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      this.request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      this.request(`/customers/${id}`, { method: 'DELETE' }),
  };

  // Bikes
  bikes = {
    getAll: (page = 1, limit = 10) =>
      this.request(`/bikes?page=${page}&limit=${limit}`),
    getOne: (id: string) =>
      this.request(`/bikes/${id}`),
    getByOwner: (ownerId: string) =>
      this.request(`/bikes/owner/${ownerId}`),
    create: (data: any) =>
      this.request(`/bikes`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      this.request(`/bikes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      this.request(`/bikes/${id}`, { method: 'DELETE' }),
    uploadImage: (id: string, file: string, mimeType: string) =>
      this.request(`/bikes/${id}/image`, {
        method: 'POST',
        body: JSON.stringify({ file, mimeType }),
      }),
    deleteImage: (id: string) =>
      this.request(`/bikes/${id}/image`, { method: 'DELETE' }),
  };

  // Service Orders
  serviceOrders = {
    getAll: (page = 1, limit = 10, filters?: {
      employee?: string[];
      status?: string[];
      priority?: string[];
      search?: string;
    }) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters?.employee && filters.employee.length > 0) {
        params.append('employee', filters.employee.join(','));
      }
      if (filters?.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
      }
      if (filters?.priority && filters.priority.length > 0) {
        params.append('priority', filters.priority.join(','));
      }
      if (filters?.search) params.append('search', filters.search);
      return this.request(`/service-orders?${params}`);
    },
    getOne: (id: string) =>
      this.request(`/service-orders/${id}`),
    getByEmployee: (employeeId: string) =>
      this.request(`/service-orders/employee/${employeeId}`),
    getBikesInService: () =>
      this.request(`/service-orders/stats/in-service`),
    getEmployees: (id: string) =>
      this.request(`/service-orders/${id}/employees`),
    create: (data: any) =>
      this.request(`/service-orders`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      this.request(`/service-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) =>
      this.request(`/service-orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }),
    assignEmployee: (id: string, employeeId: string) =>
      this.request(`/service-orders/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ employee_id: employeeId }),
      }),
    cancel: (id: string) =>
      this.request(`/service-orders/${id}`, { method: 'DELETE' }),
    uploadImage: (id: string, file: string, mimeType: string) =>
      this.request(`/service-orders/${id}/image`, {
        method: 'POST',
        body: JSON.stringify({ file, mimeType }),
      }),
    deleteImage: (id: string) =>
      this.request(`/service-orders/${id}/image`, { method: 'DELETE' }),
  };

  // Payments
  payments = {
    getAll: (page = 1, limit = 10) =>
      this.request(`/payments?page=${page}&limit=${limit}`),
    getByOrder: (orderId: string) =>
      this.request(`/payments/order/${orderId}`),
    getOutstanding: () =>
      this.request(`/payments/outstanding`),
    create: (data: any) =>
      this.request(`/payments`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) =>
      this.request(`/payments/${id}`, { method: 'DELETE' }),
  };

  // Parts
  parts = {
    getAll: (page = 1, limit = 10) =>
      this.request(`/parts?page=${page}&limit=${limit}`),
    getOne: (id: string) =>
      this.request(`/parts/${id}`),
    getLowStock: () =>
      this.request(`/parts/low-stock`),
    create: (data: any) =>
      this.request(`/parts`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      this.request(`/parts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      this.request(`/parts/${id}`, { method: 'DELETE' }),
  };

  // Users
  users = {
    getMe: () =>
      this.request(`/users/me`),
    getAll: (page = 1, limit = 10) =>
      this.request(`/users?page=${page}&limit=${limit}`),
    getOne: (id: string) =>
      this.request(`/users/${id}`),
    getEmployees: () =>
      this.request(`/users/employees`),
    create: (data: any) =>
      this.request(`/users`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      this.request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    toggleActive: (id: string) =>
      this.request(`/users/${id}/activate`, { method: 'PATCH' }),
  };

  // Comments
  comments = {
    getByServiceOrder: (serviceOrderId: string) =>
      this.request(`/comments/service-order/${serviceOrderId}`),
    getOne: (id: string) =>
      this.request(`/comments/${id}`),
    create: (data: { service_order_id: string; comment_text: string }) =>
      this.request(`/comments`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { comment_text: string }) =>
      this.request(`/comments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      this.request(`/comments/${id}`, { method: 'DELETE' }),
  };

  // Activity Logs
  activityLogs = {
    getByEntity: (entityType: string, entityId: string, page = 1, limit = 50) =>
      this.request(`/activity-logs/entity/${entityType}/${entityId}?page=${page}&limit=${limit}`),
    getByUser: (userId: string, page = 1, limit = 50) =>
      this.request(`/activity-logs/user/${userId}?page=${page}&limit=${limit}`),
  };

  // Brands
  brands = {
    getAll: () =>
      this.request(`/brands`),
    getOne: (id: string) =>
      this.request(`/brands/${id}`),
    create: (data: any) =>
      this.request(`/brands`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      this.request(`/brands/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      this.request(`/brands/${id}`, { method: 'DELETE' }),
  };

  // Models
  models = {
    getAll: (brandId?: string, brandName?: string) => {
      const params = new URLSearchParams();
      if (brandId) params.append('brand_id', brandId);
      if (brandName) params.append('brand_name', brandName);
      return this.request(`/models${params.toString() ? `?${params}` : ''}`);
    },
    getOne: (id: string) =>
      this.request(`/models/${id}`),
    getByBrandName: (brandName: string) =>
      this.request(`/models?brand_name=${encodeURIComponent(brandName)}`),
    create: (data: any) =>
      this.request(`/models`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      this.request(`/models/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      this.request(`/models/${id}`, { method: 'DELETE' }),
  };

  // Suppliers
  suppliers = {
    getAll: () =>
      this.request(`/suppliers`),
    getOne: (id: string) =>
      this.request(`/suppliers/${id}`),
    create: (data: any) =>
      this.request(`/suppliers`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      this.request(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      this.request(`/suppliers/${id}`, { method: 'DELETE' }),
  };

  // Service Items
  serviceItems = {
    getAll: (serviceOrderId?: string) =>
      this.request(`/service-items${serviceOrderId ? `?service_order_id=${serviceOrderId}` : ''}`),
    getOne: (id: string) =>
      this.request(`/service-items/${id}`),
    create: (data: any) =>
      this.request(`/service-items`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      this.request(`/service-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      this.request(`/service-items/${id}`, { method: 'DELETE' }),
  };

  // Service Parts
  serviceParts = {
    getAll: (serviceOrderId?: string) =>
      this.request(`/service-parts${serviceOrderId ? `?service_order_id=${serviceOrderId}` : ''}`),
    getOne: (id: string) =>
      this.request(`/service-parts/${id}`),
    create: (data: any) =>
      this.request(`/service-parts`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      this.request(`/service-parts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      this.request(`/service-parts/${id}`, { method: 'DELETE' }),
  };

  // Dashboard
  dashboard = {
    getStats: () =>
      this.request(`/service-orders/stats/dashboard`),
  };

  // Images
  images = {
    upload: async (
      entityType: 'bike' | 'service_order' | 'customer' | 'part' | 'comment' | 'service_item',
      entityId: string,
      files: File[]
    ) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId);

      // Get JWT token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_BASE_URL}/images/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    },

    getByEntity: async (
      entityType: 'bike' | 'service_order' | 'customer' | 'part' | 'comment' | 'service_item',
      entityId: string
    ) => {
      return this.request(`/images/entity/${entityType}/${entityId}`);
    },

    delete: async (imageId: string) => {
      return this.request(`/images/${imageId}`, { method: 'DELETE' });
    },
  };
}

export const apiClient = new APIClient();
