import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_TIME_ZONE, ReportScope } from './report-scope';
import { col, ReportResult } from './report-types';
import { num, ordersWithNet, retailCogs, round2 } from './retail-net';
import { WorkshopReportsService } from './workshop-reports.service';

/** Cash book categories that move money but are not expenses (D5). */
export const NON_EXPENSE_CATEGORIES = [
  'supplier_payment',
  'transfer_out',
  'sales_return',
  'shift_cash_out',
  'cash_count_difference',
  'reversal',
];

/** Age buckets in days (D4), as SQL over an age expression. */
function buckets(age: Prisma.Sql, amount: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SUM(CASE WHEN ${age} <= 30 THEN ${amount} ELSE 0 END) AS b0,
    SUM(CASE WHEN ${age} BETWEEN 31 AND 60 THEN ${amount} ELSE 0 END) AS b31,
    SUM(CASE WHEN ${age} BETWEEN 61 AND 90 THEN ${amount} ELSE 0 END) AS b61,
    SUM(CASE WHEN ${age} > 90 THEN ${amount} ELSE 0 END) AS b90,
    SUM(${amount}) AS total, MAX(${age})::int AS oldest`;
}

const AGING_COLUMNS = [
  col('b0', '0–30 ngày', '0–30 days', 'money'),
  col('b31', '31–60 ngày', '31–60 days', 'money'),
  col('b61', '61–90 ngày', '61–90 days', 'money'),
  col('b90', 'Trên 90 ngày', 'Over 90 days', 'money'),
  col('total', 'Tổng nợ', 'Total', 'money'),
  col('oldest', 'Nợ lâu nhất (ngày)', 'Oldest (days)', 'integer'),
];

const agingRow = (r: Record<string, unknown>) => ({
  b0: num(r.b0),
  b31: num(r.b31),
  b61: num(r.b61),
  b90: num(r.b90),
  total: num(r.total),
  oldest: num(r.oldest),
});

const agingTotals = (rows: ReturnType<typeof agingRow>[]) => ({
  b0: rows.reduce((s, r) => s + r.b0, 0),
  b31: rows.reduce((s, r) => s + r.b31, 0),
  b61: rows.reduce((s, r) => s + r.b61, 0),
  b90: rows.reduce((s, r) => s + r.b90, 0),
  total: rows.reduce((s, r) => s + r.total, 0),
});

/** Receivables, payables, suppliers, cash and P&L (reports-retail-suite D4, D5). */
@Injectable()
export class LedgerReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async receivablesAging(scope: ReportScope): Promise<ReportResult> {
    const age = ageDays(scope, ReportScope.orderDate('so'));
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT c.full_name, c.phone, COUNT(*)::int AS documents, ${buckets(age, Prisma.sql`cr.balance`)}
      FROM customer_receivables cr
      JOIN sales_orders so ON so.id = cr.sales_order_id
      JOIN customers c ON c.id = cr.customer_id
      WHERE cr.balance > 0 AND ${ReportScope.orderDate('so')} < ${scope.endExclusive}
        ${scope.storeFilter(Prisma.sql`so.store_id`)}
      GROUP BY c.id, c.full_name, c.phone
      ORDER BY SUM(cr.balance) DESC`;
    const rows = data.map((r) => ({
      customer: r.full_name,
      phone: r.phone ?? '',
      documents: num(r.documents),
      ...agingRow(r),
    }));
    return {
      report: 'customers.receivables-aging',
      title: { vi: 'Tuổi nợ khách hàng', en: 'Receivables aging' },
      scope: scope.toJSON(),
      columns: [
        col('customer', 'Khách hàng', 'Customer'),
        col('phone', 'Điện thoại', 'Phone'),
        col('documents', 'Số đơn nợ', 'Open orders', 'integer'),
        ...AGING_COLUMNS,
      ],
      rows,
      totals: agingTotals(rows),
      meta: { asOf: scope.to },
    };
  }

  async payablesAging(scope: ReportScope): Promise<ReportResult> {
    const age = ageDays(
      scope,
      Prisma.sql`COALESCE(po.order_date, po.created_at)`,
    );
    const owed = Prisma.sql`(po.total_amount - COALESCE(po.paid_amount, 0))`;
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT s.name, s.phone, COUNT(*)::int AS documents, ${buckets(age, owed)}
      FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.status = 'approved' AND ${owed} > 0
        AND COALESCE(po.order_date, po.created_at) < ${scope.endExclusive}
      GROUP BY s.id, s.name, s.phone
      ORDER BY SUM(${owed}) DESC`;
    const rows = data.map((r) => ({
      supplier: r.name,
      phone: r.phone ?? '',
      documents: num(r.documents),
      ...agingRow(r),
    }));
    return {
      report: 'suppliers.payables-aging',
      title: { vi: 'Tuổi nợ nhà cung cấp', en: 'Payables aging' },
      scope: scope.toJSON(),
      columns: [
        col('supplier', 'Nhà cung cấp', 'Supplier'),
        col('phone', 'Điện thoại', 'Phone'),
        col('documents', 'Số đơn nợ', 'Open orders', 'integer'),
        ...AGING_COLUMNS,
      ],
      rows,
      totals: agingTotals(rows),
      meta: { asOf: scope.to },
    };
  }

  async supplierPurchases(scope: ReportScope): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH po AS (
        SELECT supplier_id, COUNT(*)::int AS orders, SUM(total_amount) AS amount,
               SUM(CASE WHEN stock_updated THEN total_amount ELSE 0 END) AS received
        FROM purchase_orders
        WHERE status = 'approved' AND ${scope.inRange(Prisma.sql`COALESCE(order_date, created_at)`)}
        GROUP BY supplier_id
      ),
      ret AS (
        SELECT supplier_id, SUM(total_return_amount) AS amount FROM supplier_returns
        WHERE COALESCE(status, '') <> 'cancelled' AND ${scope.inRange(Prisma.sql`COALESCE(return_date, created_at)`)}
        GROUP BY supplier_id
      ),
      pay AS (
        SELECT supplier_id, SUM(amount) AS amount FROM supplier_payments
        WHERE ${scope.inRange(Prisma.sql`COALESCE(payment_date, created_at)`)}
        GROUP BY supplier_id
      ),
      owed AS (
        SELECT supplier_id, SUM(total_amount - COALESCE(paid_amount, 0)) AS amount FROM purchase_orders
        WHERE status = 'approved' GROUP BY supplier_id
      )
      SELECT s.name, COALESCE(po.orders, 0) AS orders, COALESCE(po.amount, 0) AS amount, COALESCE(po.received, 0) AS received,
             COALESCE(ret.amount, 0) AS returns, COALESCE(pay.amount, 0) AS paid, COALESCE(owed.amount, 0) AS owed
      FROM suppliers s
      LEFT JOIN po ON po.supplier_id = s.id
      LEFT JOIN ret ON ret.supplier_id = s.id
      LEFT JOIN pay ON pay.supplier_id = s.id
      LEFT JOIN owed ON owed.supplier_id = s.id
      WHERE po.supplier_id IS NOT NULL OR ret.supplier_id IS NOT NULL OR pay.supplier_id IS NOT NULL
      ORDER BY COALESCE(po.amount, 0) DESC`;
    const rows = data.map((r) => ({
      supplier: r.name,
      orders: num(r.orders),
      purchased: num(r.amount),
      received: num(r.received),
      returns: num(r.returns),
      netPurchases: num(r.amount) - num(r.returns),
      paid: num(r.paid),
      owed: num(r.owed),
    }));
    const keys = [
      'orders',
      'purchased',
      'received',
      'returns',
      'netPurchases',
      'paid',
      'owed',
    ] as const;
    return {
      report: 'suppliers.purchases',
      title: { vi: 'Nhập hàng theo nhà cung cấp', en: 'Purchases by supplier' },
      scope: scope.toJSON(),
      columns: [
        col('supplier', 'Nhà cung cấp', 'Supplier'),
        col('orders', 'Số đơn nhập', 'Purchase orders', 'integer'),
        col('purchased', 'Giá trị nhập', 'Purchased', 'money'),
        col('received', 'Đã nhập kho', 'Received', 'money'),
        col('returns', 'Trả hàng NCC', 'Returns', 'money'),
        col('netPurchases', 'Nhập thuần', 'Net purchases', 'money'),
        col('paid', 'Đã trả trong kỳ', 'Paid in period', 'money'),
        col('owed', 'Còn nợ hiện tại', 'Owed now', 'money'),
      ],
      rows,
      totals: Object.fromEntries(
        keys.map((k) => [k, rows.reduce((s, r) => s + r[k], 0)]),
      ),
    };
  }

  /** Opening, money in, money out and closing per cash book account. */
  async cashBalances(scope: ReportScope): Promise<ReportResult> {
    const signed = Prisma.raw(
      `CASE WHEN e.direction = 'in' THEN e.amount ELSE -e.amount END`,
    );
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT a.code, a.name, a.type, st.name AS store,
             COALESCE(SUM(${signed}) FILTER (WHERE e.entry_date < ${scope.start}), 0) AS opening,
             COALESCE(SUM(e.amount) FILTER (WHERE e.direction = 'in' AND ${scope.inRange(Prisma.sql`e.entry_date`)}), 0) AS money_in,
             COALESCE(SUM(e.amount) FILTER (WHERE e.direction = 'out' AND ${scope.inRange(Prisma.sql`e.entry_date`)}), 0) AS money_out
      FROM cash_book_accounts a
      LEFT JOIN stores st ON st.id = a.store_id
      LEFT JOIN cash_book_entries e ON e.account_id = a.id AND e.status = 'posted' AND e.entry_date < ${scope.endExclusive}
      WHERE (a.is_active OR e.id IS NOT NULL) ${scope.storeFilter(Prisma.sql`a.store_id`)}
      GROUP BY a.id, a.code, a.name, a.type, st.name
      ORDER BY st.name NULLS FIRST, a.code`;
    const rows = data.map((r) => {
      const opening = num(r.opening);
      return {
        store: r.store ?? 'Chung',
        account: r.name,
        code: r.code,
        type:
          r.type === 'cash'
            ? 'Tiền mặt'
            : r.type === 'bank'
              ? 'Ngân hàng'
              : r.type === 'ewallet'
                ? 'Ví điện tử'
                : r.type,
        opening,
        moneyIn: num(r.money_in),
        moneyOut: num(r.money_out),
        closing: opening + num(r.money_in) - num(r.money_out),
      };
    });
    const keys = ['opening', 'moneyIn', 'moneyOut', 'closing'] as const;
    return {
      report: 'financial.cash-balances',
      title: { vi: 'Số dư quỹ', en: 'Cash balances' },
      scope: scope.toJSON(),
      columns: [
        col('store', 'Chi nhánh', 'Branch'),
        col('account', 'Tài khoản', 'Account'),
        col('code', 'Mã', 'Code'),
        col('type', 'Loại', 'Type'),
        col('opening', 'Đầu kỳ', 'Opening', 'money'),
        col('moneyIn', 'Thu', 'In', 'money'),
        col('moneyOut', 'Chi', 'Out', 'money'),
        col('closing', 'Cuối kỳ', 'Closing', 'money'),
      ],
      rows,
      totals: Object.fromEntries(
        keys.map((k) => [k, rows.reduce((s, r) => s + r[k], 0)]),
      ),
    };
  }

  /** Profit and loss with retail, workshop and combined columns (D5). */
  async pnl(scope: ReportScope): Promise<ReportResult> {
    const [retail] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${ordersWithNet(scope)})
      SELECT COALESCE(SUM(gross), 0) AS gross, COALESCE(SUM(gross - net), 0) AS discounts FROM o`;
    const [ret] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT COALESCE(SUM(goods_amount), 0) AS returns FROM sales_returns
      WHERE ${scope.inRange(Prisma.sql`created_at`)} ${scope.storeFilter(Prisma.sql`store_id`)}`;
    const [cogs] = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >`${retailCogs(scope)}`;
    const [workshop] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH d AS (${WorkshopReportsService.deliveredInScope(scope)})
      SELECT COALESCE(SUM(d.revenue), 0) AS revenue,
             COALESCE((SELECT SUM(COALESCE(sp.total_cost, sp.unit_cost * sp.quantity_used))
                       FROM service_parts sp JOIN d d2 ON d2.id = sp.service_order_id), 0) AS parts
      FROM d`;
    const expenses = await this.prisma.$queryRaw<
      { code: string; name: string; amount: Prisma.Decimal }[]
    >`
      SELECT c.code, c.name,
             SUM(CASE WHEN e.reverses_entry_id IS NULL THEN e.amount ELSE -e.amount END) AS amount
      FROM cash_book_entries e
      LEFT JOIN cash_book_entries orig ON orig.id = e.reverses_entry_id
      JOIN cash_book_categories c ON c.id = COALESCE(orig.category_id, e.category_id)
      WHERE e.status = 'posted' AND c.direction = 'out'
        AND COALESCE(orig.direction, e.direction) = 'out'
        AND c.code NOT IN (${Prisma.join(NON_EXPENSE_CATEGORIES)})
        AND ${scope.inRange(Prisma.sql`e.entry_date`)}
        ${scope.storeFilter(Prisma.sql`e.store_id`)}
      GROUP BY c.code, c.name
      HAVING SUM(CASE WHEN e.reverses_entry_id IS NULL THEN e.amount ELSE -e.amount END) <> 0
      ORDER BY 3 DESC`;

    const gross = num(retail.gross);
    const discounts = num(retail.discounts);
    const returns = num(ret.returns);
    const retailNet = gross - discounts - returns;
    const retailCost = num(cogs.sold) - num(cogs.restocked);
    const wsRevenue = num(workshop.revenue);
    const wsParts = num(workshop.parts);
    const opex = expenses.reduce((s, e) => s + num(e.amount), 0);
    const line = (
      key: string,
      label: string,
      r: number | null,
      w: number | null,
      level = 0,
    ) => ({
      key,
      line: label,
      level,
      retail: r,
      workshop: w,
      combined: (r ?? 0) + (w ?? 0),
    });
    const grossProfitR = retailNet - retailCost;
    const grossProfitW = wsRevenue - wsParts;
    const rows = [
      line('gross', 'Doanh số bán lẻ', gross, null, 1),
      line(
        'discounts',
        'Giảm giá (tay, khuyến mãi, voucher, điểm)',
        -discounts,
        null,
        1,
      ),
      line('returns', 'Hàng bán bị trả lại', -returns, null, 1),
      line('revenue', 'Doanh thu thuần', retailNet, wsRevenue),
      line('cogs', 'Giá vốn hàng bán / phụ tùng', -retailCost, -wsParts),
      line('grossProfit', 'Lợi nhuận gộp', grossProfitR, grossProfitW),
      ...expenses
        .map((e) =>
          line(`expense:${e.code}`, `Chi phí: ${e.name}`, null, null, 1),
        )
        .map((r, i) => ({ ...r, combined: -num(expenses[i].amount) })),
      { ...line('opex', 'Chi phí hoạt động', null, null), combined: -opex },
      {
        ...line('netProfit', 'Lợi nhuận ròng', null, null),
        combined: grossProfitR + grossProfitW - opex,
      },
    ];
    const totalRevenue = retailNet + wsRevenue;
    return {
      report: 'financial.pnl',
      title: { vi: 'Kết quả kinh doanh', en: 'Profit and loss' },
      scope: scope.toJSON(),
      columns: [
        col('line', 'Chỉ tiêu', 'Line'),
        col('retail', 'Bán lẻ', 'Retail', 'money'),
        col('workshop', 'Dịch vụ', 'Workshop', 'money'),
        col('combined', 'Tổng', 'Combined', 'money'),
      ],
      rows,
      meta: {
        summary: {
          revenue: totalRevenue,
          grossProfit: grossProfitR + grossProfitW,
          operatingExpenses: opex,
          netProfit: grossProfitR + grossProfitW - opex,
          netMargin: totalRevenue
            ? round2(
                ((grossProfitR + grossProfitW - opex) / totalRevenue) * 100,
              )
            : 0,
        },
        cogsSold: num(cogs.sold),
        cogsRestocked: num(cogs.restocked),
      },
    };
  }
}

/** Age in whole days from a document date to the report's last day (Vietnam time). */
function ageDays(scope: ReportScope, column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(${scope.to}::date - (${column} AT TIME ZONE ${REPORT_TIME_ZONE})::date)`;
}
