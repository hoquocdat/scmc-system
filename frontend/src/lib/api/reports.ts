import { apiClient } from './client';

// ==================== SHARED TYPES ====================

export type ReportColumnType = 'text' | 'integer' | 'number' | 'money' | 'percent' | 'date' | 'datetime';

export interface ReportColumn {
  key: string;
  header: { vi: string; en: string };
  type: ReportColumnType;
}

export interface ReportScopeInfo {
  from: string;
  to: string;
  storeId: string | null;
  interval: ReportInterval;
  timeZone: string;
}

export type ReportInterval = 'daily' | 'weekly' | 'monthly';
export type ReportFormat = 'xlsx' | 'csv';

/** Envelope returned by every report endpoint. */
export interface ReportResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  report: string;
  title: { vi: string; en: string };
  scope: ReportScopeInfo;
  columns: ReportColumn[];
  rows: Row[];
  totals?: Partial<Row>;
  meta?: Record<string, unknown>;
}

export interface PagedMeta {
  page: number;
  pageSize: number;
  total: number;
}

/** Query parameters shared by every report. Dates are YYYY-MM-DD in Vietnam time, end inclusive. */
export interface ReportQuery {
  from?: string;
  to?: string;
  storeId?: string;
  interval?: ReportInterval;
  page?: number;
  pageSize?: number;
  limit?: number;
  sortBy?: string;
  productId?: string;
  locationId?: string;
  type?: string;
  lang?: 'vi' | 'en';
}

// ==================== ROW TYPES ====================

export interface SalesSummaryRow extends Record<string, unknown> {
  orders: number;
  grossSales: number;
  lineDiscounts: number;
  orderDiscounts: number;
  loyaltyDiscounts: number;
  discounts: number;
  netSales: number;
  tax: number;
  shipping: number;
  total: number;
  itemsSold: number;
  averageOrderValue: number;
}

export interface PaymentMethodRow extends Record<string, unknown> {
  method: string;
  label: string;
  amount: number;
  payments: number;
}

export interface RevenueLineRow extends Record<string, unknown> {
  line: 'retail' | 'workshop';
  label: string;
  revenue: number;
  orders: number;
  received: number;
}

export interface RevenueMeta {
  retail: SalesSummaryRow;
  workshop: { orders: number; revenue: number; averageOrderValue: number };
  combined: { revenue: number; orders: number; received: number };
  received: { retail: PaymentMethodRow[]; workshop: PaymentMethodRow[]; combined: PaymentMethodRow[] };
}

export interface ProfitMeta {
  orders: number;
  cogsRecorded: number;
  cogsEstimated: number;
  cogsEstimatedShare: number;
  estimated: boolean;
}

export interface DashboardKpis {
  scope: { today: string; monthStart: string; storeId: string | null };
  today: KpiBlock;
  monthToDate: KpiBlock;
  inventory: { stockValue: number; lowStockCount: number };
  workshop: { bikesInService: number };
}

export interface KpiBlock {
  retail: { netSales: number; orders: number; averageOrderValue: number };
  workshop: { revenue: number; orders: number };
  combinedRevenue: number;
}

// ==================== ENDPOINTS ====================

export const REPORT_ENDPOINTS = {
  'sales.summary': '/reports/sales/summary',
  'sales.by-category': '/reports/sales/by-category',
  'sales.by-payment-method': '/reports/sales/by-payment-method',
  'sales.top-products': '/reports/sales/top-products',
  'sales.trends': '/reports/sales/trends',
  'inventory.valuation': '/reports/inventory/valuation',
  'inventory.movement': '/reports/inventory/movement',
  'inventory.low-stock': '/reports/inventory/low-stock',
  'inventory.turnover': '/reports/inventory/turnover',
  'financial.revenue': '/reports/financial/revenue',
  'financial.profit': '/reports/financial/profit',
  'financial.vat': '/reports/financial/vat',
  'workshop.revenue': '/reports/workshop/revenue',
  'workshop.technicians': '/reports/workshop/technicians',
  'workshop.parts': '/reports/workshop/parts',
  'workshop.in-service': '/reports/workshop/in-service',
  'workshop.turnaround': '/reports/workshop/turnaround',
  'finance.cash-book': '/cash-book/entries',
} as const;

export type ReportKey = keyof typeof REPORT_ENDPOINTS;

/** Removes empty values so they are not sent as "undefined" strings. */
function clean(params: ReportQuery | Record<string, unknown> = {}): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v as string | number;
  }
  return out;
}

export const reportsApi = {
  /** Fetches any report by key with the shared query parameters. */
  get: async <Row extends Record<string, unknown> = Record<string, unknown>>(
    key: ReportKey,
    params: ReportQuery = {},
  ): Promise<ReportResult<Row>> => {
    const response = await apiClient.get(REPORT_ENDPOINTS[key], { params: clean(params) });
    return response.data;
  },

  getDashboardKpis: async (storeId?: string): Promise<DashboardKpis> => {
    const response = await apiClient.get('/reports/dashboard/kpis', { params: clean({ storeId }) });
    return response.data;
  },

  /**
   * Downloads a report as a file with the same filters as the screen.
   * The server decides the file name (Content-Disposition).
   */
  download: async (key: ReportKey, params: ReportQuery | Record<string, unknown>, format: ReportFormat): Promise<{ blob: Blob; fileName: string }> => {
    const response = await apiClient.get(REPORT_ENDPOINTS[key], {
      params: { ...clean(params), format },
      responseType: 'blob',
    });
    const disposition: string = response.headers['content-disposition'] ?? '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    const fileName = match?.[1] ?? `${key}.${format}`;
    return { blob: response.data as Blob, fileName };
  },
};

/** Triggers a browser download of a blob. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Reads the error message from a blob error response (exports return JSON errors as blobs). */
export async function readBlobError(error: unknown): Promise<string> {
  const data = (error as { response?: { data?: unknown; status?: number } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text());
      return json.message ?? 'Xuất báo cáo thất bại';
    } catch {
      return 'Xuất báo cáo thất bại';
    }
  }
  return (data as { message?: string })?.message ?? 'Xuất báo cáo thất bại';
}
