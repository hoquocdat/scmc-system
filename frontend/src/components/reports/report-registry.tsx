import type { ReactNode } from 'react';
import type { ReportFilterOptions } from './ReportFilterSheet';
import type { ChartSpec } from './TrendChart';
import type { Kpi } from './KpiCards';
import type { ReportKey, ReportQuery, ReportResult, RevenueMeta, ProfitMeta, SalesSummaryRow } from '@/lib/api/reports';
import { formatCurrency } from '@/lib/utils';
import { ReceivedByMethod } from './sections/ReceivedByMethod';

export type ReportGroup = 'sales' | 'inventory' | 'finance' | 'workshop';

export const REPORT_GROUPS: { id: ReportGroup; label: string; roles: string[] }[] = [
  { id: 'sales', label: 'Bán hàng', roles: ['manager', 'finance', 'store_manager'] },
  { id: 'inventory', label: 'Tồn kho', roles: ['manager', 'finance', 'store_manager', 'warehouse_staff'] },
  { id: 'finance', label: 'Tài chính', roles: ['manager', 'finance'] },
  { id: 'workshop', label: 'Xưởng dịch vụ', roles: ['manager', 'finance', 'store_manager'] },
];

export interface ReportDefinition {
  key: ReportKey;
  group: ReportGroup;
  slug: string;
  title: string;
  description: string;
  filters: ReportFilterOptions;
  defaultQuery?: Partial<ReportQuery>;
  /** Columns kept out of the on-screen table (ids and the like). */
  hidden?: string[];
  /** Server-side paged report (movement). */
  paged?: boolean;
  /** Hide the table (summary-style reports that are all KPIs). */
  hideTable?: boolean;
  chart?: ChartSpec;
  kpis?: (result: ReportResult) => Kpi[];
  notice?: (result: ReportResult) => string | null;
  extra?: (result: ReportResult) => ReactNode;
}

const money = (v: unknown) => formatCurrency(Number(v ?? 0));
const int = (v: unknown) => Number(v ?? 0).toLocaleString('vi-VN');
const IDS = ['id', 'categoryId', 'productId', 'variantId', 'locationId', 'employeeId', 'partId', 'storeId', 'line', 'method', 'notes', 'referenceId'];

function summaryKpis(result: ReportResult): Kpi[] {
  const s = (result.meta?.summary ?? result.rows[0] ?? {}) as Partial<SalesSummaryRow>;
  return [
    { label: 'Doanh thu thuần', value: money(s.netSales), hint: `Doanh số gộp ${money(s.grossSales)}` },
    { label: 'Số đơn', value: int(s.orders), hint: `${int(s.itemsSold)} sản phẩm` },
    { label: 'Giảm giá', value: money(s.discounts), hint: `Loyalty ${money(s.loyaltyDiscounts)}` },
    { label: 'Giá trị đơn TB', value: money(s.averageOrderValue), hint: `Thuế ${money(s.tax)}` },
  ];
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  // ---- sales -----------------------------------------------------------------
  {
    key: 'sales.summary', group: 'sales', slug: 'summary', title: 'Tổng quan bán hàng',
    description: 'Doanh số, giảm giá, doanh thu thuần và số đơn của các đơn bán lẻ (không tính đơn nháp, chờ, đã hủy).',
    filters: { store: true }, hideTable: true, kpis: summaryKpis,
  },
  {
    key: 'sales.trends', group: 'sales', slug: 'trends', title: 'Xu hướng bán hàng',
    description: 'Số đơn và doanh thu thuần theo ngày, tuần hoặc tháng (giờ Việt Nam).',
    filters: { store: true, interval: true }, defaultQuery: { interval: 'daily' },
    chart: { x: 'period', y: 'netSales', label: 'Doanh thu thuần', kind: 'line', money: true },
    kpis: (r) => [
      { label: 'Doanh thu thuần', value: money(r.totals?.netSales) },
      { label: 'Số đơn', value: int(r.totals?.orders) },
    ],
  },
  {
    key: 'sales.by-category', group: 'sales', slug: 'by-category', title: 'Bán hàng theo danh mục',
    description: 'Số lượng và doanh thu thuần theo danh mục sản phẩm.',
    filters: { store: true }, hidden: IDS,
    chart: { x: 'category', y: 'netSales', label: 'Doanh thu thuần', money: true },
  },
  {
    key: 'sales.by-payment-method', group: 'sales', slug: 'by-payment-method', title: 'Thanh toán theo phương thức',
    description: 'Tiền bán lẻ đã thu theo phương thức thanh toán (chỉ tính giao dịch hoàn tất).',
    filters: { store: true }, hidden: IDS,
    chart: { x: 'label', y: 'amount', label: 'Số tiền', money: true },
  },
  {
    key: 'sales.top-products', group: 'sales', slug: 'top-products', title: 'Sản phẩm bán chạy',
    description: 'Sản phẩm và biến thể bán nhiều nhất theo số lượng hoặc doanh thu.',
    filters: { store: true, limit: true, sortBy: { label: 'Xếp theo', options: [{ value: 'quantity', label: 'Số lượng' }, { value: 'netSales', label: 'Doanh thu thuần' }] } },
    defaultQuery: { limit: 10, sortBy: 'quantity' }, hidden: IDS,
    chart: { x: 'name', y: 'quantity', label: 'Số lượng' },
  },

  // ---- inventory ---------------------------------------------------------------
  {
    key: 'inventory.valuation', group: 'inventory', slug: 'valuation', title: 'Giá trị tồn kho',
    description: 'Tồn kho hiện tại và giá trị theo giá vốn, theo sản phẩm và kho.',
    filters: { location: true }, hidden: IDS,
    kpis: (r) => [
      { label: 'Giá trị tồn kho', value: money(r.totals?.value) },
      { label: 'Số lượng tồn', value: int(r.totals?.quantity) },
      ...((r.meta?.byLocation as { location: string; value: number }[] | undefined)?.slice(0, 2).map((l) => ({ label: l.location, value: money(l.value) })) ?? []),
    ],
  },
  {
    key: 'inventory.movement', group: 'inventory', slug: 'movement', title: 'Xuất nhập tồn',
    description: 'Lịch sử xuất nhập kho trong kỳ, theo sản phẩm, kho và loại giao dịch.',
    filters: { location: true, movementType: true }, defaultQuery: { page: 1, pageSize: 50 }, paged: true, hidden: IDS,
  },
  {
    key: 'inventory.low-stock', group: 'inventory', slug: 'low-stock', title: 'Hàng sắp hết',
    description: 'Sản phẩm có tồn kho bằng hoặc dưới điểm đặt hàng lại, theo kho.',
    filters: { location: true }, hidden: IDS,
    kpis: (r) => [{ label: 'Mặt hàng cần đặt', value: int(r.rows.length) }],
  },
  {
    key: 'inventory.turnover', group: 'inventory', slug: 'turnover', title: 'Vòng quay tồn kho',
    description: 'Số lượng bán, giá vốn hàng bán và vòng quay theo sản phẩm trong kỳ.',
    filters: { store: true }, hidden: IDS,
    chart: { x: 'name', y: 'unitsSold', label: 'Đã bán' },
  },

  // ---- finance -----------------------------------------------------------------
  {
    key: 'financial.revenue', group: 'finance', slug: 'revenue', title: 'Doanh thu',
    description: 'Doanh thu bán lẻ, dịch vụ xưởng và tổng hợp, cùng tiền đã thu theo phương thức.',
    filters: { store: true }, hidden: IDS,
    kpis: (r) => {
      const m = r.meta as unknown as RevenueMeta | undefined;
      return [
        { label: 'Tổng doanh thu', value: money(m?.combined.revenue), hint: `Đã thu ${money(m?.combined.received)}` },
        { label: 'Bán lẻ', value: money(m?.retail.netSales), hint: `${int(m?.retail.orders)} đơn` },
        { label: 'Dịch vụ xưởng', value: money(m?.workshop.revenue), hint: `${int(m?.workshop.orders)} xe đã giao` },
        { label: 'Tiền đã thu', value: money(m?.combined.received) },
      ];
    },
    extra: (r) => <ReceivedByMethod received={(r.meta as unknown as RevenueMeta | undefined)?.received} />,
  },
  {
    key: 'financial.profit', group: 'finance', slug: 'profit', title: 'Lợi nhuận gộp',
    description: 'Doanh thu thuần trừ giá vốn hàng bán (giá vốn ghi nhận tại thời điểm bán).',
    filters: { store: true },
    kpis: (r) => {
      const row = (r.rows[0] ?? {}) as Record<string, unknown>;
      const m = r.meta as unknown as ProfitMeta | undefined;
      return [
        { label: 'Lợi nhuận gộp', value: money(row.grossProfit), hint: `Biên ${Number(row.marginPercent ?? 0).toLocaleString('vi-VN')}%` },
        { label: 'Doanh thu thuần', value: money(row.netSales), hint: `${int(m?.orders)} đơn` },
        { label: 'Giá vốn hàng bán', value: money(row.cogs), hint: m?.estimated ? `Ước tính ${money(m.cogsEstimated)}` : 'Theo giá vốn lúc bán' },
      ];
    },
    notice: (r) => {
      const m = r.meta as unknown as ProfitMeta | undefined;
      return m?.estimated
        ? `Một phần giá vốn (${Math.round((m.cogsEstimatedShare ?? 0) * 100)}%) được ước tính theo giá vốn hiện tại vì các đơn cũ chưa ghi nhận giá vốn lúc bán.`
        : null;
    },
  },
  {
    key: 'financial.vat', group: 'finance', slug: 'vat', title: 'Thuế GTGT',
    description: 'Thuế GTGT theo số thuế đã ghi nhận trên từng đơn hàng.',
    filters: { store: true, interval: true }, defaultQuery: { interval: 'daily' },
    chart: { x: 'period', y: 'vat', label: 'Thuế GTGT', money: true },
    kpis: (r) => [
      { label: 'Thuế GTGT', value: money(r.totals?.vat) },
      { label: 'Doanh thu trước thuế', value: money(r.totals?.taxable) },
      { label: 'Số đơn', value: int(r.totals?.orders) },
    ],
  },

  // ---- workshop ----------------------------------------------------------------
  {
    key: 'workshop.revenue', group: 'workshop', slug: 'revenue', title: 'Doanh thu dịch vụ',
    description: 'Doanh thu từ các phiếu dịch vụ đã giao xe, tính theo ngày giao.',
    filters: { store: true, interval: true }, defaultQuery: { interval: 'daily' },
    chart: { x: 'period', y: 'revenue', label: 'Doanh thu', money: true },
    kpis: (r) => {
      const s = (r.meta?.summary ?? {}) as Record<string, unknown>;
      return [
        { label: 'Doanh thu dịch vụ', value: money(s.revenue) },
        { label: 'Xe đã giao', value: int(s.orders) },
        { label: 'Giá trị TB', value: money(s.averageOrderValue) },
      ];
    },
  },
  {
    key: 'workshop.technicians', group: 'workshop', slug: 'technicians', title: 'Hiệu suất kỹ thuật viên',
    description: 'Số xe đã giao, doanh thu (kỹ thuật viên chính) và thời gian hoàn thành trung bình.',
    filters: { store: true }, hidden: IDS,
    chart: { x: 'fullName', y: 'revenue', label: 'Doanh thu', money: true },
  },
  {
    key: 'workshop.parts', group: 'workshop', slug: 'parts', title: 'Phụ tùng sử dụng',
    description: 'Phụ tùng dùng cho dịch vụ trong kỳ, xếp theo chi phí.',
    filters: { store: true, limit: true }, defaultQuery: { limit: 10 }, hidden: IDS,
    chart: { x: 'name', y: 'totalCost', label: 'Chi phí', money: true },
  },
  {
    key: 'workshop.in-service', group: 'workshop', slug: 'in-service', title: 'Xe đang trong xưởng',
    description: 'Số xe hiện đang ở xưởng theo trạng thái (không tính đã giao và đã hủy).',
    filters: { store: true },
    chart: { x: 'status', y: 'bikes', label: 'Số xe' },
    kpis: (r) => [{ label: 'Xe trong xưởng', value: int(r.meta?.total) }],
  },
  {
    key: 'workshop.turnaround', group: 'workshop', slug: 'turnaround', title: 'Thời gian hoàn thành',
    description: 'Số ngày trung bình và trung vị từ lúc nhận xe đến lúc giao xe.',
    filters: { store: true }, hidden: IDS,
    kpis: (r) => {
      const o = (r.meta?.overall ?? {}) as Record<string, unknown>;
      return [
        { label: 'Trung bình (ngày)', value: Number(o.averageDays ?? 0).toLocaleString('vi-VN') },
        { label: 'Trung vị (ngày)', value: Number(o.medianDays ?? 0).toLocaleString('vi-VN') },
        { label: 'Xe đã giao', value: int(o.orders) },
      ];
    },
  },
];

export const findReport = (group: string | undefined, slug: string | undefined) =>
  REPORT_DEFINITIONS.find((d) => d.group === group && d.slug === slug);

export const reportPath = (d: ReportDefinition) => `/reports/${d.group}/${d.slug}`;
