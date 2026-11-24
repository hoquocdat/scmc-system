import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportScope } from './report-scope';
import { col, ReportResult } from './report-types';
import { num, ordersWithNet } from './retail-net';

/** End of day and shift close (reports-retail-suite D3). */
@Injectable()
export class EodReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async daily(scope: ReportScope): Promise<ReportResult> {
    const sales = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${ordersWithNet(scope)})
      SELECT st.id AS store_id, st.name AS store,
             COUNT(o.id)::int AS orders, COALESCE(SUM(o.gross), 0) AS gross,
             COALESCE(SUM(o.line_disc + o.order_disc), 0) AS manual_disc,
             COALESCE(SUM(o.line_promo + o.order_promo), 0) AS promo,
             COALESCE(SUM(o.voucher), 0) AS voucher, COALESCE(SUM(o.loyalty), 0) AS loyalty,
             COALESCE(SUM(o.net), 0) AS net
      FROM stores st LEFT JOIN o ON o.store_id = st.id
      WHERE TRUE ${scope.storeFilter(Prisma.sql`st.id`)}
      GROUP BY st.id, st.name ORDER BY st.name`;
    const returns = await this.prisma.$queryRaw<
      {
        store_id: string;
        returns: Prisma.Decimal;
        refunds: Prisma.Decimal;
        count: number;
      }[]
    >`
      SELECT store_id, SUM(goods_amount) AS returns, SUM(refund_amount) AS refunds, COUNT(*)::int AS count
      FROM sales_returns WHERE ${scope.inRange(Prisma.sql`created_at`)} ${scope.storeFilter(Prisma.sql`store_id`)}
      GROUP BY store_id`;
    // Money received: every completed payment dated in the period (sales and receivable collections)
    const received = await this.prisma.$queryRaw<
      { store_id: string; method: string; amount: Prisma.Decimal }[]
    >`
      SELECT so.store_id, p.payment_method AS method, SUM(p.amount) AS amount
      FROM sales_order_payments p JOIN sales_orders so ON so.id = p.sales_order_id
      WHERE p.status = 'completed' AND ${scope.inRange(Prisma.sql`COALESCE(p.payment_date, p.created_at)`)}
        ${scope.storeFilter(Prisma.sql`so.store_id`)}
      GROUP BY so.store_id, p.payment_method`;
    const drawer = await this.prisma.$queryRaw<
      { store_id: string; cash_in: Prisma.Decimal; cash_out: Prisma.Decimal }[]
    >`
      SELECT e.store_id,
             SUM(CASE WHEN e.direction = 'in' THEN e.amount ELSE 0 END) AS cash_in,
             SUM(CASE WHEN e.direction = 'out' THEN e.amount ELSE 0 END) AS cash_out
      FROM cash_book_entries e
      JOIN cash_book_accounts a ON a.id = e.account_id AND a.is_pos_drawer
      JOIN cash_book_categories c ON c.id = e.category_id
      WHERE e.status = 'posted' AND ${scope.inRange(Prisma.sql`e.entry_date`)}
        AND c.code NOT IN ('sale', 'receivable_collection', 'sales_return', 'opening_balance')
        ${scope.storeFilter(Prisma.sql`e.store_id`)}
      GROUP BY e.store_id`;
    const credit = await this.prisma.$queryRaw<
      { store_id: string; amount: Prisma.Decimal }[]
    >`
      SELECT so.store_id, SUM(r.original_amount) AS amount
      FROM customer_receivables r JOIN sales_orders so ON so.id = r.sales_order_id
      WHERE ${scope.inRange(ReportScope.orderDate('so'))} ${scope.storeFilter(Prisma.sql`so.store_id`)}
      GROUP BY so.store_id`;
    const staff = await this.prisma.$queryRaw<
      { name: string | null; orders: number; net: Prisma.Decimal }[]
    >`
      WITH o AS (${ordersWithNet(scope)})
      SELECT up.full_name AS name, COUNT(o.id)::int AS orders, SUM(o.net) AS net
      FROM o LEFT JOIN user_profiles up ON up.id = o.created_by
      GROUP BY up.full_name ORDER BY SUM(o.net) DESC`;

    const methodCols = [
      'cash',
      'card',
      'bank_transfer',
      'ewallet',
      'store_credit',
      'exchange',
    ] as const;
    const methodOf = (m: string) =>
      m.startsWith('ewallet')
        ? 'ewallet'
        : m === 'transfer'
          ? 'bank_transfer'
          : m;
    const rows = sales.map((s) => {
      const id = s.store_id as string;
      const r = returns.find((x) => x.store_id === id);
      const d = drawer.find((x) => x.store_id === id);
      const rec = Object.fromEntries(methodCols.map((m) => [m, 0])) as Record<
        (typeof methodCols)[number],
        number
      >;
      for (const x of received.filter((x) => x.store_id === id)) {
        const k = methodOf(x.method) as (typeof methodCols)[number];
        if (k in rec) rec[k] += num(x.amount);
      }
      return {
        storeId: id,
        store: s.store,
        orders: num(s.orders),
        gross: num(s.gross),
        manualDiscounts: num(s.manual_disc),
        promotionDiscounts: num(s.promo),
        voucherDiscounts: num(s.voucher),
        loyaltyDiscounts: num(s.loyalty),
        netSales: num(s.net),
        returns: num(r?.returns),
        netAfterReturns: num(s.net) - num(r?.returns),
        receivedCash: rec.cash,
        receivedCard: rec.card,
        receivedBank: rec.bank_transfer,
        receivedEwallet: rec.ewallet,
        receivedCredit: rec.store_credit,
        receivedExchange: rec.exchange,
        refundsPaid: num(r?.refunds),
        drawerIn: num(d?.cash_in),
        drawerOut: num(d?.cash_out),
        newReceivables: num(credit.find((x) => x.store_id === id)?.amount),
      };
    });
    const sum = (k: keyof (typeof rows)[number]) =>
      rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0);
    return {
      report: 'eod.daily',
      title: { vi: 'Báo cáo cuối ngày', en: 'End of day' },
      scope: scope.toJSON(),
      columns: [
        col('store', 'Chi nhánh', 'Branch'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('gross', 'Doanh số', 'Gross', 'money'),
        col('manualDiscounts', 'Giảm giá tay', 'Manual discounts', 'money'),
        col('promotionDiscounts', 'Khuyến mãi', 'Promotions', 'money'),
        col('voucherDiscounts', 'Voucher', 'Vouchers', 'money'),
        col('loyaltyDiscounts', 'Điểm thưởng', 'Loyalty', 'money'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col('returns', 'Trả hàng', 'Returns', 'money'),
        col('netAfterReturns', 'Thuần sau trả', 'Net after returns', 'money'),
        col('receivedCash', 'Thu tiền mặt', 'Cash', 'money'),
        col('receivedCard', 'Thu thẻ', 'Card', 'money'),
        col('receivedBank', 'Thu chuyển khoản', 'Bank transfer', 'money'),
        col('receivedEwallet', 'Thu ví điện tử', 'E-wallets', 'money'),
        col('receivedCredit', 'Tiền trả hàng', 'Store credit', 'money'),
        col('receivedExchange', 'Đổi hàng', 'Exchange', 'money'),
        col('refundsPaid', 'Hoàn tiền', 'Refunds paid', 'money'),
        col('drawerIn', 'Nộp vào két', 'Drawer in', 'money'),
        col('drawerOut', 'Rút khỏi két', 'Drawer out', 'money'),
        col('newReceivables', 'Bán nợ', 'New receivables', 'money'),
      ],
      rows,
      totals: Object.fromEntries(
        [
          'orders',
          'gross',
          'manualDiscounts',
          'promotionDiscounts',
          'voucherDiscounts',
          'loyaltyDiscounts',
          'netSales',
          'returns',
          'netAfterReturns',
          'receivedCash',
          'receivedCard',
          'receivedBank',
          'receivedEwallet',
          'receivedCredit',
          'receivedExchange',
          'refundsPaid',
          'drawerIn',
          'drawerOut',
          'newReceivables',
        ].map((k) => [k, sum(k as keyof (typeof rows)[number])]),
      ),
      meta: {
        staff: staff.map((s) => ({
          name: s.name ?? '—',
          orders: s.orders,
          net: num(s.net),
        })),
      },
    };
  }

  async shifts(scope: ReportScope): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT ps.id, ps.session_number, st.name AS store, up.full_name AS cashier, ps.status,
             ps.opened_at, ps.closed_at, COALESCE(ps.opening_cash, 0) AS opening_cash,
             ps.closing_cash, ps.expected_cash, ps.cash_difference,
             COALESCE(SUM(CASE WHEN c.code = 'sale' AND e.direction = 'in' THEN e.amount END), 0) AS cash_sales,
             COALESCE(SUM(CASE WHEN c.code = 'sales_return' THEN e.amount END), 0) AS cash_refunds,
             COALESCE(SUM(CASE WHEN c.code NOT IN ('sale', 'sales_return', 'cash_count_difference') AND e.direction = 'in' THEN e.amount END), 0) AS cash_in,
             COALESCE(SUM(CASE WHEN c.code NOT IN ('sale', 'sales_return', 'cash_count_difference') AND e.direction = 'out' THEN e.amount END), 0) AS cash_out,
             COALESCE(SUM(CASE WHEN c.code <> 'cash_count_difference' THEN (CASE WHEN e.direction = 'in' THEN e.amount ELSE -e.amount END) END), 0) AS drawer_net
      FROM pos_sessions ps
      LEFT JOIN stores st ON st.id = ps.store_id
      LEFT JOIN user_profiles up ON up.id = ps.user_id
      LEFT JOIN cash_book_accounts a ON a.store_id = ps.store_id AND a.is_pos_drawer
      LEFT JOIN cash_book_entries e ON e.pos_session_id = ps.id AND e.account_id = a.id AND e.status = 'posted'
      LEFT JOIN cash_book_categories c ON c.id = e.category_id
      WHERE ${scope.inRange(Prisma.sql`ps.opened_at`)} ${scope.storeFilter(Prisma.sql`ps.store_id`)}
      GROUP BY ps.id, st.name, up.full_name
      ORDER BY ps.opened_at DESC`;
    const shaped = rows.map((r) => {
      const expected =
        r.expected_cash != null
          ? num(r.expected_cash)
          : num(r.opening_cash) + num(r.drawer_net);
      const counted = r.closing_cash != null ? num(r.closing_cash) : null;
      return {
        id: r.id,
        session: r.session_number,
        store: r.store,
        cashier: r.cashier ?? '',
        status: r.status === 'closed' ? 'Đã đóng' : 'Đang mở',
        openedAt: (r.opened_at as Date | null)?.toISOString() ?? null,
        closedAt: (r.closed_at as Date | null)?.toISOString() ?? null,
        openingCash: num(r.opening_cash),
        cashSales: num(r.cash_sales),
        cashRefunds: num(r.cash_refunds),
        cashIn: num(r.cash_in),
        cashOut: num(r.cash_out),
        expected,
        counted,
        difference:
          counted == null
            ? null
            : r.cash_difference != null
              ? num(r.cash_difference)
              : counted - expected,
      };
    });
    return {
      report: 'eod.shifts',
      title: { vi: 'Báo cáo ca', en: 'Shift close' },
      scope: scope.toJSON(),
      columns: [
        col('session', 'Ca', 'Shift'),
        col('store', 'Chi nhánh', 'Branch'),
        col('cashier', 'Thu ngân', 'Cashier'),
        col('status', 'Trạng thái', 'Status'),
        col('openedAt', 'Mở', 'Opened', 'datetime'),
        col('closedAt', 'Đóng', 'Closed', 'datetime'),
        col('openingCash', 'Tiền đầu ca', 'Float', 'money'),
        col('cashSales', 'Bán tiền mặt', 'Cash sales', 'money'),
        col('cashRefunds', 'Hoàn tiền mặt', 'Cash refunds', 'money'),
        col('cashIn', 'Nộp vào', 'Cash in', 'money'),
        col('cashOut', 'Rút ra', 'Cash out', 'money'),
        col('expected', 'Tiền dự kiến', 'Expected', 'money'),
        col('counted', 'Tiền thực đếm', 'Counted', 'money'),
        col('difference', 'Chênh lệch', 'Over/short', 'money'),
      ],
      rows: shaped,
      totals: {
        difference: shaped.reduce((s, r) => s + (r.difference ?? 0), 0),
      },
    };
  }
}
