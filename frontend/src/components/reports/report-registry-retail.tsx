import type { ReportResult } from '@/lib/api/reports';
import { formatCurrency } from '@/lib/utils';
import type { ReportDefinition } from './report-registry';

/** Reports added by reports-retail-suite (design D2, D6). */

const money = (v: unknown) => formatCurrency(Number(v ?? 0));
const int = (v: unknown) => Number(v ?? 0).toLocaleString('vi-VN');
const IDS = ['id', 'userId', 'storeId'];
const FINANCE_ROLES = ['manager', 'finance'];
const total = (r: ReportResult, key: string) => r.totals?.[key];

export const RETAIL_SUITE_REPORTS: ReportDefinition[] = [
  // ---- end of day ----------------------------------------------------------------
  {
    key: 'eod.daily', group: 'eod', slug: 'daily', title: 'Báo cáo cuối ngày',
    description: 'Theo chi nhánh: doanh số, giảm giá theo nguồn, trả hàng, tiền thu theo phương thức, tiền vào/ra két và bán nợ. Trả hàng tính theo ngày trả nên doanh thu thuần trong ngày có thể âm.',
    filters: { store: true }, defaultPreset: 'today', hidden: IDS,
    kpis: (r) => [
      { label: 'Thuần sau trả hàng', value: money(total(r, 'netAfterReturns')), hint: `Doanh thu thuần ${money(total(r, 'netSales'))}` },
      { label: 'Số đơn', value: int(total(r, 'orders')), hint: `Trả hàng ${money(total(r, 'returns'))}` },
      { label: 'Tiền mặt thu', value: money(total(r, 'receivedCash')), hint: `Hoàn tiền ${money(total(r, 'refundsPaid'))}` },
      { label: 'Chuyển khoản + ví', value: money(Number(total(r, 'receivedBank') ?? 0) + Number(total(r, 'receivedEwallet') ?? 0)), hint: `Thẻ ${money(total(r, 'receivedCard'))}` },
    ],
    extra: (r) => {
      const staff = (r.meta?.staff ?? []) as { name: string; orders: number; net: number }[];
      if (staff.length === 0) return null;
      return (
        <p className="text-sm text-muted-foreground">
          Theo nhân viên: {staff.map((s) => `${s.name} ${int(s.orders)} đơn · ${money(s.net)}`).join(' — ')}
        </p>
      );
    },
  },
  {
    key: 'eod.shifts', group: 'eod', slug: 'shifts', title: 'Báo cáo ca',
    description: 'Mỗi ca thu ngân: tiền đầu ca, bán và hoàn tiền mặt, nộp/rút, tiền dự kiến, tiền đếm và chênh lệch.',
    filters: { store: true }, defaultPreset: 'today', hidden: IDS,
    kpis: (r) => [
      { label: 'Số ca', value: int(r.rows.length) },
      { label: 'Chênh lệch', value: money(total(r, 'difference')) },
    ],
  },

  // ---- sales extras --------------------------------------------------------------
  {
    key: 'sales.by-hour', group: 'sales', slug: 'by-hour', title: 'Doanh thu theo giờ',
    description: 'Số đơn và doanh thu thuần theo giờ trong ngày (giờ Việt Nam) để xếp ca.',
    filters: { store: true }, hidden: IDS,
    chart: { x: 'hour', y: 'netSales', label: 'Doanh thu thuần', money: true },
  },
  {
    key: 'sales.by-staff', group: 'sales', slug: 'by-staff', title: 'Doanh thu theo nhân viên',
    description: 'Số đơn, doanh thu thuần và hàng bị trả theo nhân viên bán.',
    filters: { store: true }, hidden: IDS,
    chart: { x: 'staff', y: 'netAfterReturns', label: 'Thuần sau trả', money: true },
  },
  {
    key: 'sales.by-branch', group: 'sales', slug: 'by-branch', title: 'Theo chi nhánh và kênh',
    description: 'Doanh thu thuần theo chi nhánh và kênh bán.',
    filters: {}, hidden: IDS,
  },
  {
    key: 'sales.by-brand', group: 'sales', slug: 'by-brand', title: 'Doanh thu theo thương hiệu',
    description: 'Số lượng và doanh thu thuần theo thương hiệu sản phẩm.',
    filters: { store: true }, hidden: IDS,
    chart: { x: 'brand', y: 'netSales', label: 'Doanh thu thuần', money: true },
  },
  {
    key: 'sales.discounts', group: 'sales', slug: 'discounts', title: 'Giảm giá theo nguồn',
    description: 'Giảm tay, khuyến mãi, voucher và điểm thưởng theo kỳ, cùng tỷ lệ giảm trên doanh số.',
    filters: { store: true, interval: true }, defaultQuery: { interval: 'daily' }, hidden: IDS,
    chart: { x: 'period', y: 'totalDiscounts', label: 'Tổng giảm', kind: 'line', money: true },
    kpis: (r) => [
      { label: 'Tổng giảm', value: money(total(r, 'totalDiscounts')), hint: `${Number(total(r, 'discountRate') ?? 0).toLocaleString('vi-VN')}% doanh số` },
      { label: 'Khuyến mãi', value: money(total(r, 'promotions')) },
      { label: 'Voucher', value: money(total(r, 'vouchers')) },
      { label: 'Giảm tay', value: money(total(r, 'manual')), hint: `Điểm ${money(total(r, 'loyalty'))}` },
    ],
  },
  {
    key: 'sales.slow-movers', group: 'sales', slug: 'slow-movers', title: 'Hàng bán chậm',
    description: 'Hàng còn tồn nhưng bán ít nhất trong kỳ (theo đơn vị cơ bản).',
    filters: { store: true, limit: true }, defaultQuery: { limit: 50 }, hidden: IDS,
  },
  {
    key: 'returns.by-product', group: 'sales', slug: 'returns-by-product', title: 'Trả hàng theo sản phẩm',
    description: 'Số lượng, giá trị trả và tỷ lệ trả so với lượng bán trong kỳ.',
    filters: { store: true, limit: true }, defaultQuery: { limit: 100 }, hidden: IDS,
    kpis: (r) => [
      { label: 'Giá trị trả', value: money(total(r, 'value')) },
      { label: 'Số lượng trả', value: int(total(r, 'quantity')), hint: `Lỗi ${int(total(r, 'damaged'))}` },
    ],
  },
  {
    key: 'returns.reasons', group: 'sales', slug: 'returns-reasons', title: 'Trả hàng theo lý do',
    description: 'Phiếu trả theo lý do, hoặc theo nhân viên xử lý.',
    filters: { store: true, typeChoice: { label: 'Nhóm theo', options: [{ value: 'reason', label: 'Lý do' }, { value: 'staff', label: 'Nhân viên' }] } },
    hidden: IDS,
    chart: { x: 'label', y: 'value', label: 'Giá trị trả', money: true },
  },

  // ---- inventory -----------------------------------------------------------------
  {
    key: 'inventory.stock-card', group: 'inventory', slug: 'stock-card', title: 'Thẻ kho',
    description: 'Mọi lần nhập, xuất của một sản phẩm với tồn đầu kỳ, tồn sau từng giao dịch và tồn cuối kỳ.',
    filters: { store: true, location: true, product: { required: true } }, hidden: IDS,
    kpis: (r) => [
      { label: 'Tồn đầu kỳ', value: int(r.meta?.opening) },
      { label: 'Nhập', value: int(total(r, 'quantityIn')) },
      { label: 'Xuất', value: int(total(r, 'quantityOut')) },
      { label: 'Tồn cuối kỳ', value: int(r.meta?.closing) },
    ],
  },
  {
    key: 'inventory.in-transit', group: 'inventory', slug: 'in-transit', title: 'Hàng đang chuyển',
    description: 'Phiếu chuyển kho đã xuất mà chưa nhận đủ.',
    filters: { store: true }, hidden: IDS,
    kpis: (r) => [
      { label: 'Phiếu đang chuyển', value: int(r.rows.length) },
      { label: 'Giá trị', value: money(total(r, 'value')), hint: `${int(total(r, 'quantity'))} đơn vị` },
    ],
  },
  {
    key: 'inventory.count-variances', group: 'inventory', slug: 'count-variances', title: 'Chênh lệch kiểm kho',
    description: 'Các dòng lệch của phiếu kiểm kho hoàn thành trong kỳ, theo giá trị.',
    filters: { store: true, location: true }, hidden: IDS,
    kpis: (r) => [
      { label: 'Lệch thuần', value: money(total(r, 'value')) },
      { label: 'Thiếu', value: money(r.meta?.shortageValue) },
      { label: 'Thừa', value: money(r.meta?.surplusValue) },
    ],
  },
  {
    key: 'inventory.days-of-stock', group: 'inventory', slug: 'days-of-stock', title: 'Số ngày tồn kho',
    description: 'Tồn hiện tại chia cho lượng bán trung bình mỗi ngày trong kỳ; hoặc hàng tồn không bán được.',
    filters: { store: true, limit: true, typeChoice: { label: 'Xem', options: [{ value: 'cover', label: 'Số ngày tồn' }, { value: 'dead', label: 'Hàng không bán được' }] } },
    defaultQuery: { limit: 200 }, hidden: IDS,
    kpis: (r) => [
      { label: 'Mặt hàng', value: int(r.rows.length) },
      { label: 'Giá trị tồn', value: money(total(r, 'stockValue')) },
    ],
  },

  // ---- customers -----------------------------------------------------------------
  {
    key: 'customers.top', group: 'customers', slug: 'top', title: 'Khách hàng mua nhiều',
    description: 'Khách hàng xếp theo doanh thu thuần sau trả hàng hoặc theo số đơn.',
    filters: { store: true, limit: true, sortBy: { label: 'Xếp theo', options: [{ value: 'net', label: 'Doanh thu' }, { value: 'orders', label: 'Số đơn' }] } },
    defaultQuery: { limit: 20 }, hidden: IDS,
    chart: { x: 'customer', y: 'netAfterReturns', label: 'Thuần sau trả', money: true },
  },
  {
    key: 'customers.receivables-aging', group: 'customers', slug: 'receivables-aging', title: 'Tuổi nợ khách hàng',
    description: 'Công nợ khách hàng còn mở theo tuổi nợ tính đến ngày cuối kỳ: 0–30, 31–60, 61–90 và trên 90 ngày.',
    filters: { store: true }, hidden: IDS, roles: FINANCE_ROLES,
    kpis: (r) => [
      { label: 'Tổng nợ', value: money(total(r, 'total')) },
      { label: 'Trên 90 ngày', value: money(total(r, 'b90')) },
      { label: 'Khách còn nợ', value: int(r.rows.length) },
    ],
  },
  {
    key: 'customers.loyalty', group: 'customers', slug: 'loyalty', title: 'Tích điểm',
    description: 'Điểm tích, điểm dùng, thu hồi và số dư theo hạng thành viên.',
    filters: {}, hidden: IDS,
    kpis: (r) => [
      { label: 'Điểm tích', value: int(total(r, 'earned')) },
      { label: 'Điểm dùng', value: int(total(r, 'redeemed')), hint: money(total(r, 'redeemedValue')) },
      { label: 'Điểm còn', value: int(total(r, 'balance')) },
    ],
  },

  // ---- suppliers -----------------------------------------------------------------
  {
    key: 'suppliers.purchases', group: 'suppliers', slug: 'purchases', title: 'Nhập hàng theo nhà cung cấp',
    description: 'Giá trị nhập, trả hàng, đã trả trong kỳ và còn nợ hiện tại theo nhà cung cấp.',
    filters: {}, hidden: IDS, roles: FINANCE_ROLES,
    chart: { x: 'supplier', y: 'netPurchases', label: 'Nhập thuần', money: true },
  },
  {
    key: 'suppliers.payables-aging', group: 'suppliers', slug: 'payables-aging', title: 'Tuổi nợ nhà cung cấp',
    description: 'Đơn nhập đã duyệt còn nợ theo tuổi nợ tính đến ngày cuối kỳ.',
    filters: {}, hidden: IDS, roles: FINANCE_ROLES,
    kpis: (r) => [
      { label: 'Tổng phải trả', value: money(total(r, 'total')) },
      { label: 'Trên 90 ngày', value: money(total(r, 'b90')) },
    ],
  },

  // ---- promotions ----------------------------------------------------------------
  {
    key: 'promotions.performance', group: 'promotions', slug: 'performance', title: 'Hiệu quả khuyến mãi',
    description: 'Số đơn, tiền giảm, doanh thu thuần và giá trị đơn trung bình của từng chương trình khuyến mãi và đợt voucher.',
    filters: { store: true }, hidden: IDS,
    chart: { x: 'name', y: 'discount', label: 'Tiền giảm', money: true },
    kpis: (r) => [
      { label: 'Tổng tiền giảm', value: money(total(r, 'discount')) },
      { label: 'Giá trị đơn TB (tất cả)', value: money(r.meta?.allAverageOrderValue), hint: `${int(r.meta?.allOrders)} đơn` },
    ],
  },

  // ---- finance -------------------------------------------------------------------
  {
    key: 'financial.cash-balances', group: 'finance', slug: 'cash-balances', title: 'Số dư quỹ',
    description: 'Đầu kỳ, thu, chi và cuối kỳ của từng tài khoản sổ quỹ.',
    filters: { store: true }, hidden: IDS,
    kpis: (r) => [
      { label: 'Cuối kỳ', value: money(total(r, 'closing')), hint: `Đầu kỳ ${money(total(r, 'opening'))}` },
      { label: 'Thu', value: money(total(r, 'moneyIn')) },
      { label: 'Chi', value: money(total(r, 'moneyOut')) },
    ],
  },
  {
    key: 'financial.pnl', group: 'finance', slug: 'pnl', title: 'Kết quả kinh doanh',
    description: 'Doanh thu, giá vốn, lợi nhuận gộp, chi phí hoạt động từ sổ quỹ và lợi nhuận ròng; bán lẻ, dịch vụ và tổng.',
    filters: { store: true }, hidden: ['key', 'level'],
    kpis: (r) => {
      const s = (r.meta?.summary ?? {}) as Record<string, number>;
      return [
        { label: 'Lợi nhuận ròng', value: money(s.netProfit), hint: `Biên ${Number(s.netMargin ?? 0).toLocaleString('vi-VN')}%` },
        { label: 'Doanh thu', value: money(s.revenue) },
        { label: 'Lợi nhuận gộp', value: money(s.grossProfit) },
        { label: 'Chi phí hoạt động', value: money(s.operatingExpenses) },
      ];
    },
  },
];
