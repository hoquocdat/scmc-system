import { apiClient } from './client';

// ==================== TYPES ====================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface SalesSummary {
  period: DateRange;
  summary: {
    totalRevenue: number;
    netRevenue: number;
    totalOrders: number;
    totalItemsSold: number;
    totalDiscounts: number;
    averageOrderValue: number;
    vatCollected: number;
  };
}

export interface SalesByCategory {
  category: string;
  order_count: number;
  quantity_sold: number;
  revenue: number;
}

export interface SalesByPaymentMethod {
  paymentMethod: string;
  totalAmount: number;
  transactionCount: number;
}

export interface TopProduct {
  id: string;
  sku: string;
  name: string;
  quantity_sold: number;
  revenue: number;
}

export interface SalesTrend {
  period: string;
  order_count: number;
  revenue: number;
  avg_order_value: number;
}

export interface InventoryValuation {
  totalCostValue: number;
  totalRetailValue: number;
  potentialProfit: number;
  itemCount: number;
  totalUnits: number;
  byLocation: Array<{
    locationId: string;
    locationName: string;
    totalValue: number;
    totalUnits: number;
  }>;
}

export interface LowStockProduct {
  product_id: string;
  sku: string;
  name: string;
  quantity_on_hand: number;
  reorder_point: number;
  reorder_quantity: number;
  location_name: string;
}

export interface RevenueReport {
  period: DateRange;
  grossRevenue: number;
  totalDiscounts: number;
  netRevenue: number;
  vatCollected: number;
  byPaymentMethod: SalesByPaymentMethod[];
}

export interface ProfitReport {
  period: DateRange;
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: string;
}

export interface VATReport {
  period: DateRange;
  subtotal: number;
  vatRate: string;
  vatCollected: number;
  transactionCount: number;
  byDate: Array<{
    date: string;
    subtotal: number;
    vat_collected: number;
  }>;
}

export interface DashboardKPIs {
  today: {
    revenue: number;
    orders: number;
    averageOrderValue: number;
  };
  monthToDate: {
    revenue: number;
    orders: number;
    averageOrderValue: number;
  };
  inventory: {
    totalValue: number;
    lowStockCount: number;
  };
  pendingOrders: number;
}

export interface ReportsQueryParams {
  startDate?: string;
  endDate?: string;
  location?: string;
  productId?: string;
  limit?: number;
  interval?: 'daily' | 'weekly' | 'monthly';
}

// ==================== API CLIENT ====================

export const reportsApi = {
  // Sales Reports
  getSalesSummary: async (params?: ReportsQueryParams): Promise<SalesSummary> => {
    const response = await apiClient.get('/reports/sales/summary', { params });
    return response.data;
  },

  getSalesByCategory: async (params?: ReportsQueryParams): Promise<SalesByCategory[]> => {
    const response = await apiClient.get('/reports/sales/by-category', { params });
    return response.data;
  },

  getSalesByPaymentMethod: async (params?: ReportsQueryParams): Promise<SalesByPaymentMethod[]> => {
    const response = await apiClient.get('/reports/sales/by-payment-method', { params });
    return response.data;
  },

  getTopProducts: async (params?: ReportsQueryParams): Promise<TopProduct[]> => {
    const response = await apiClient.get('/reports/sales/top-products', { params });
    return response.data;
  },

  getSalesTrends: async (params?: ReportsQueryParams): Promise<SalesTrend[]> => {
    const response = await apiClient.get('/reports/sales/trends', { params });
    return response.data;
  },

  // Inventory Reports
  getInventoryValuation: async (params?: ReportsQueryParams): Promise<InventoryValuation> => {
    const response = await apiClient.get('/reports/inventory/valuation', { params });
    return response.data;
  },

  getInventoryMovement: async (params?: ReportsQueryParams) => {
    const response = await apiClient.get('/reports/inventory/movement', { params });
    return response.data;
  },

  getLowStockProducts: async (params?: ReportsQueryParams): Promise<LowStockProduct[]> => {
    const response = await apiClient.get('/reports/inventory/low-stock', { params });
    return response.data;
  },

  getInventoryTurnover: async (params?: ReportsQueryParams) => {
    const response = await apiClient.get('/reports/inventory/turnover', { params });
    return response.data;
  },

  // Financial Reports
  getRevenueReport: async (params?: ReportsQueryParams): Promise<RevenueReport> => {
    const response = await apiClient.get('/reports/financial/revenue', { params });
    return response.data;
  },

  getProfitReport: async (params?: ReportsQueryParams): Promise<ProfitReport> => {
    const response = await apiClient.get('/reports/financial/profit', { params });
    return response.data;
  },

  getVATReport: async (params?: ReportsQueryParams): Promise<VATReport> => {
    const response = await apiClient.get('/reports/financial/vat', { params });
    return response.data;
  },

  // Dashboard
  getDashboardKPIs: async (): Promise<DashboardKPIs> => {
    const response = await apiClient.get('/reports/dashboard/kpis');
    return response.data;
  },
};
