import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_TIME_ZONE, ReportScope } from './report-scope';
import { col, ReportResult } from './report-types';
import {
  linesWithNet,
  num,
  ordersWithNet,
  round2,
  storeLocations,
} from './retail-net';

const CHANNEL_LABELS: Record<string, string> = {
  pos: 'Tại quầy',
  online: 'Online',
  phone: 'Điện thoại',
  social: 'Mạng xã hội',
};

const REASON_LABELS: Record<string, string> = {
  changed_mind: 'Đổi ý',
  wrong_size: 'Sai size',
  defective: 'Lỗi sản phẩm',
  wrong_item: 'Giao nhầm hàng',
  other: 'Khác',
};

/**
 * Retail sales extras, returns, customers and promotions
 * (reports-retail-suite D1, D2). Every money figure uses the D1 net rule.
 */
@Injectable()
export class RetailReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- sales ----------------

  async byHour(scope: ReportScope): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<
      { hour: number; orders: number; net: Prisma.Decimal }[]
    >`
      WITH o AS (${ordersWithNet(scope)})
      SELECT EXTRACT(HOUR FROM o.od AT TIME ZONE ${REPORT_TIME_ZONE})::int AS hour,
             COUNT(*)::int AS orders, SUM(o.net) AS net
      FROM o GROUP BY 1`;
    const rows = Array.from({ length: 24 }, (_, hour) => {
      const d = data.find((x) => x.hour === hour);
      const orders = d?.orders ?? 0;
      const net = num(d?.net);
      return {
        hour: `${String(hour).padStart(2, '0')}:00`,
        orders,
        netSales: net,
        averageOrderValue: orders ? Math.round(net / orders) : 0,
      };
    });
    return {
      report: 'sales.by-hour',
      title: { vi: 'Doanh thu theo giờ', en: 'Sales by hour' },
      scope: scope.toJSON(),
      columns: [
        col('hour', 'Giờ', 'Hour'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col('averageOrderValue', 'Giá trị TB', 'Average order', 'money'),
      ],
      rows,
      totals: { orders: sum(rows, 'orders'), netSales: sum(rows, 'netSales') },
    };
  }

  async byStaff(scope: ReportScope): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${ordersWithNet(scope)}),
      s AS (
        SELECT created_by, COUNT(*)::int AS orders, SUM(gross) AS gross,
               SUM(gross - net) AS discounts, SUM(net) AS net
        FROM o GROUP BY created_by
      ),
      r AS (
        SELECT so.created_by, SUM(sr.goods_amount) AS returns
        FROM sales_returns sr JOIN sales_orders so ON so.id = sr.sales_order_id
        WHERE ${scope.inRange(Prisma.sql`sr.created_at`)} ${scope.storeFilter(Prisma.sql`sr.store_id`)}
        GROUP BY so.created_by
      )
      SELECT k.created_by AS user_id, up.full_name, up.employee_code,
             COALESCE(s.orders, 0) AS orders, COALESCE(s.gross, 0) AS gross, COALESCE(s.discounts, 0) AS discounts,
             COALESCE(s.net, 0) AS net, COALESCE(r.returns, 0) AS returns
      FROM (SELECT created_by FROM s UNION SELECT created_by FROM r) k
      LEFT JOIN s ON s.created_by IS NOT DISTINCT FROM k.created_by
      LEFT JOIN r ON r.created_by IS NOT DISTINCT FROM k.created_by
      LEFT JOIN user_profiles up ON up.id = k.created_by
      ORDER BY COALESCE(s.net, 0) - COALESCE(r.returns, 0) DESC`;
    const rows = data.map((r) => {
      const orders = num(r.orders);
      const net = num(r.net);
      return {
        userId: r.user_id ?? null,
        staff: (r.full_name as string | null) ?? 'Không rõ',
        code: (r.employee_code as string | null) ?? '',
        orders,
        gross: num(r.gross),
        discounts: num(r.discounts),
        netSales: net,
        returns: num(r.returns),
        netAfterReturns: net - num(r.returns),
        averageOrderValue: orders ? Math.round(net / orders) : 0,
      };
    });
    return {
      report: 'sales.by-staff',
      title: { vi: 'Doanh thu theo nhân viên', en: 'Sales by staff' },
      scope: scope.toJSON(),
      columns: [
        col('staff', 'Nhân viên', 'Staff'),
        col('code', 'Mã NV', 'Code'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('gross', 'Doanh số', 'Gross', 'money'),
        col('discounts', 'Giảm giá', 'Discounts', 'money'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col('returns', 'Trả hàng', 'Returns', 'money'),
        col('netAfterReturns', 'Thuần sau trả', 'Net after returns', 'money'),
        col('averageOrderValue', 'Giá trị TB', 'Average order', 'money'),
      ],
      rows,
      totals: sums(rows, [
        'orders',
        'gross',
        'discounts',
        'netSales',
        'returns',
        'netAfterReturns',
      ]),
    };
  }

  async byBranch(scope: ReportScope): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${ordersWithNet(scope)})
      SELECT st.name AS store, COALESCE(o.channel, 'pos') AS channel,
             COUNT(*)::int AS orders, SUM(o.gross) AS gross, SUM(o.net) AS net
      FROM o JOIN stores st ON st.id = o.store_id
      GROUP BY st.name, COALESCE(o.channel, 'pos')
      ORDER BY st.name, SUM(o.net) DESC`;
    const total = data.reduce((s, r) => s + num(r.net), 0);
    const rows = data.map((r) => ({
      store: r.store,
      channel: CHANNEL_LABELS[r.channel as string] ?? r.channel,
      orders: num(r.orders),
      gross: num(r.gross),
      netSales: num(r.net),
      share: total ? round2((num(r.net) / total) * 100) : 0,
    }));
    return {
      report: 'sales.by-branch',
      title: {
        vi: 'Doanh thu theo chi nhánh và kênh',
        en: 'Sales by branch and channel',
      },
      scope: scope.toJSON(),
      columns: [
        col('store', 'Chi nhánh', 'Branch'),
        col('channel', 'Kênh', 'Channel'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('gross', 'Doanh số', 'Gross', 'money'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col('share', 'Tỷ trọng', 'Share', 'percent'),
      ],
      rows,
      totals: sums(rows, ['orders', 'gross', 'netSales']),
    };
  }

  async byBrand(scope: ReportScope): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH l AS (${linesWithNet(scope)})
      SELECT b.name AS brand, COUNT(DISTINCT l.sales_order_id)::int AS orders,
             SUM(l.quantity * COALESCE(l.unit_factor, 1))::int AS quantity,
             SUM(l.line_value) AS line_value, SUM(l.net) AS net
      FROM l
      LEFT JOIN products p ON p.id = l.product_id
      LEFT JOIN products mp ON mp.id = p.master_product_id
      LEFT JOIN brands b ON b.id = COALESCE(p.brand_id, mp.brand_id)
      GROUP BY b.name ORDER BY SUM(l.net) DESC`;
    const total = data.reduce((s, r) => s + num(r.net), 0);
    const rows = data.map((r) => ({
      brand: (r.brand as string | null) ?? 'Không có thương hiệu',
      orders: num(r.orders),
      quantity: num(r.quantity),
      netSales: round0(num(r.net)),
      share: total ? round2((num(r.net) / total) * 100) : 0,
    }));
    return {
      report: 'sales.by-brand',
      title: { vi: 'Doanh thu theo thương hiệu', en: 'Sales by brand' },
      scope: scope.toJSON(),
      columns: [
        col('brand', 'Thương hiệu', 'Brand'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('quantity', 'Số lượng', 'Quantity', 'integer'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col('share', 'Tỷ trọng', 'Share', 'percent'),
      ],
      rows,
      totals: sums(rows, ['quantity', 'netSales']),
    };
  }

  /** Items in stock that sold the least in the period (base units), least first. */
  async slowMovers(scope: ReportScope, limit = 50): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH l AS (${linesWithNet(scope)}),
      sold AS (
        SELECT product_id, product_variant_id, SUM(quantity * COALESCE(unit_factor, 1)) AS qty, SUM(net) AS net
        FROM l GROUP BY product_id, product_variant_id
      ),
      stock AS (
        SELECT inv.product_id, inv.product_variant_id, SUM(inv.quantity_on_hand) AS on_hand
        FROM inventory inv WHERE TRUE ${storeLocations(scope, Prisma.sql`inv.location_id`)}
        GROUP BY inv.product_id, inv.product_variant_id
        HAVING SUM(inv.quantity_on_hand) > 0
      ),
      last_sale AS (
        SELECT soi.product_id, soi.product_variant_id, MAX(${ReportScope.orderDate('so')}) AS at
        FROM sales_order_items soi JOIN sales_orders so ON so.id = soi.sales_order_id
        WHERE ${ReportScope.revenueStatus(Prisma.sql`so.status`)} ${scope.storeFilter(Prisma.sql`so.store_id`)}
        GROUP BY soi.product_id, soi.product_variant_id
      )
      SELECT COALESCE(pv.sku, p.sku) AS sku, p.name, pv.name AS variant,
             stock.on_hand::int AS on_hand, COALESCE(sold.qty, 0)::int AS sold, COALESCE(sold.net, 0) AS net,
             stock.on_hand * COALESCE(pv.cost_price_override, p.cost_price, 0) AS stock_value, last_sale.at AS last_sale
      FROM stock
      JOIN products p ON p.id = stock.product_id
      LEFT JOIN product_variants pv ON pv.id = stock.product_variant_id
      LEFT JOIN sold ON sold.product_id = stock.product_id AND sold.product_variant_id IS NOT DISTINCT FROM stock.product_variant_id
      LEFT JOIN last_sale ON last_sale.product_id = stock.product_id AND last_sale.product_variant_id IS NOT DISTINCT FROM stock.product_variant_id
      WHERE p.is_active
      ORDER BY COALESCE(sold.qty, 0), stock.on_hand * COALESCE(pv.cost_price_override, p.cost_price, 0) DESC
      LIMIT ${limit}`;
    const rows = data.map((r) => ({
      sku: r.sku,
      name: r.variant ? `${r.name as string} - ${r.variant as string}` : r.name,
      onHand: num(r.on_hand),
      sold: num(r.sold),
      netSales: round0(num(r.net)),
      stockValue: round0(num(r.stock_value)),
      lastSale: (r.last_sale as Date | null)?.toISOString() ?? null,
    }));
    return {
      report: 'sales.slow-movers',
      title: { vi: 'Hàng bán chậm', en: 'Slow movers' },
      scope: scope.toJSON(),
      columns: [
        col('sku', 'SKU', 'SKU'),
        col('name', 'Sản phẩm', 'Product'),
        col('onHand', 'Tồn', 'On hand', 'integer'),
        col('sold', 'Đã bán', 'Sold', 'integer'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col('stockValue', 'Giá trị tồn', 'Stock value', 'money'),
        col('lastSale', 'Bán lần cuối', 'Last sale', 'datetime'),
      ],
      rows,
      totals: sums(rows, ['onHand', 'sold', 'stockValue']),
    };
  }

  async discounts(scope: ReportScope): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${ordersWithNet(scope)})
      SELECT p.period, COUNT(o.id)::int AS orders,
             COALESCE(SUM(o.gross), 0) AS gross,
             COALESCE(SUM(o.line_disc + o.order_disc), 0) AS manual,
             COALESCE(SUM(o.line_promo + o.order_promo), 0) AS promo,
             COALESCE(SUM(o.voucher), 0) AS voucher,
             COALESCE(SUM(o.loyalty), 0) AS loyalty,
             COALESCE(SUM(o.net), 0) AS net,
             COUNT(o.id) FILTER (WHERE o.gross > o.net)::int AS discounted
      FROM ${scope.periodSeries()} p
      LEFT JOIN o ON ${scope.periodKey(Prisma.sql`o.od`)} = p.period
      GROUP BY p.period ORDER BY p.period`;
    const rows = data.map((r) => {
      const gross = num(r.gross);
      const total =
        num(r.manual) + num(r.promo) + num(r.voucher) + num(r.loyalty);
      return {
        period: r.period,
        orders: num(r.orders),
        discountedOrders: num(r.discounted),
        gross,
        manual: num(r.manual),
        promotions: num(r.promo),
        vouchers: num(r.voucher),
        loyalty: num(r.loyalty),
        totalDiscounts: total,
        netSales: num(r.net),
        discountRate: gross ? round2((total / gross) * 100) : 0,
      };
    });
    const totals = sums(rows, [
      'orders',
      'discountedOrders',
      'gross',
      'manual',
      'promotions',
      'vouchers',
      'loyalty',
      'totalDiscounts',
      'netSales',
    ]);
    return {
      report: 'sales.discounts',
      title: { vi: 'Giảm giá theo nguồn', en: 'Discounts by source' },
      scope: scope.toJSON(),
      columns: [
        col('period', 'Kỳ', 'Period'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('discountedOrders', 'Đơn có giảm', 'Discounted orders', 'integer'),
        col('gross', 'Doanh số', 'Gross', 'money'),
        col('manual', 'Giảm tay', 'Manual', 'money'),
        col('promotions', 'Khuyến mãi', 'Promotions', 'money'),
        col('vouchers', 'Voucher', 'Vouchers', 'money'),
        col('loyalty', 'Điểm thưởng', 'Loyalty', 'money'),
        col('totalDiscounts', 'Tổng giảm', 'Total discounts', 'money'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col('discountRate', 'Tỷ lệ giảm', 'Discount rate', 'percent'),
      ],
      rows,
      totals: {
        ...totals,
        discountRate: totals.gross
          ? round2((totals.totalDiscounts / totals.gross) * 100)
          : 0,
      },
    };
  }

  // ---------------- returns ----------------

  async returnsByProduct(
    scope: ReportScope,
    limit = 100,
  ): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH ri AS (
        SELECT sri.product_id, sri.product_variant_id, MAX(sri.product_name) AS name, MAX(sri.product_sku) AS sku,
               COUNT(DISTINCT sr.id)::int AS returns,
               SUM(sri.quantity * COALESCE(soi.unit_factor, 1))::int AS quantity,
               SUM(CASE WHEN sri.restock THEN sri.quantity * COALESCE(soi.unit_factor, 1) ELSE 0 END)::int AS restocked,
               SUM(sri.line_refund) AS value
        FROM sales_return_items sri
        JOIN sales_returns sr ON sr.id = sri.sales_return_id
        LEFT JOIN sales_order_items soi ON soi.id = sri.sales_order_item_id
        WHERE ${scope.inRange(Prisma.sql`sr.created_at`)} ${scope.storeFilter(Prisma.sql`sr.store_id`)}
        GROUP BY sri.product_id, sri.product_variant_id
      ),
      l AS (${linesWithNet(scope)}),
      sold AS (
        SELECT product_id, product_variant_id, SUM(quantity * COALESCE(unit_factor, 1)) AS qty
        FROM l GROUP BY product_id, product_variant_id
      )
      SELECT ri.*, COALESCE(sold.qty, 0)::int AS sold
      FROM ri LEFT JOIN sold ON sold.product_id IS NOT DISTINCT FROM ri.product_id
        AND sold.product_variant_id IS NOT DISTINCT FROM ri.product_variant_id
      ORDER BY ri.value DESC LIMIT ${limit}`;
    const rows = data.map((r) => {
      const quantity = num(r.quantity);
      const sold = num(r.sold);
      return {
        sku: r.sku,
        name: r.name,
        returns: num(r.returns),
        quantity,
        restocked: num(r.restocked),
        damaged: quantity - num(r.restocked),
        value: num(r.value),
        sold,
        returnRate: sold ? round2((quantity / sold) * 100) : null,
      };
    });
    return {
      report: 'returns.by-product',
      title: { vi: 'Trả hàng theo sản phẩm', en: 'Returns by product' },
      scope: scope.toJSON(),
      columns: [
        col('sku', 'SKU', 'SKU'),
        col('name', 'Sản phẩm', 'Product'),
        col('returns', 'Số phiếu', 'Returns', 'integer'),
        col('quantity', 'SL trả', 'Quantity', 'integer'),
        col('restocked', 'Nhập lại kho', 'Restocked', 'integer'),
        col('damaged', 'Hàng lỗi', 'Damaged', 'integer'),
        col('value', 'Giá trị trả', 'Value', 'money'),
        col('sold', 'SL bán trong kỳ', 'Sold in period', 'integer'),
        col('returnRate', 'Tỷ lệ trả', 'Return rate', 'percent'),
      ],
      rows,
      totals: sums(rows, [
        'returns',
        'quantity',
        'restocked',
        'damaged',
        'value',
      ]),
    };
  }

  /** Returns by reason code, or by the staff member who processed them (`type=staff`). */
  async returnsReasons(
    scope: ReportScope,
    type?: string,
  ): Promise<ReportResult> {
    const byStaff = type === 'staff';
    const data = byStaff
      ? await this.prisma.$queryRaw<Record<string, unknown>[]>`
          SELECT COALESCE(up.full_name, 'Không rõ') AS label, COUNT(*)::int AS returns,
                 SUM(sr.goods_amount) AS value, SUM(sr.refund_amount) AS refunded,
                 COUNT(*) FILTER (WHERE sr.kind = 'exchange')::int AS exchanges
          FROM sales_returns sr LEFT JOIN user_profiles up ON up.id = sr.created_by
          WHERE ${scope.inRange(Prisma.sql`sr.created_at`)} ${scope.storeFilter(Prisma.sql`sr.store_id`)}
          GROUP BY 1 ORDER BY COUNT(*) DESC, SUM(sr.goods_amount) DESC`
      : await this.prisma.$queryRaw<Record<string, unknown>[]>`
          SELECT COALESCE(sri.reason_code, 'other') AS label, COUNT(DISTINCT sr.id)::int AS returns,
                 SUM(sri.quantity)::int AS quantity, SUM(sri.line_refund) AS value
          FROM sales_return_items sri JOIN sales_returns sr ON sr.id = sri.sales_return_id
          WHERE ${scope.inRange(Prisma.sql`sr.created_at`)} ${scope.storeFilter(Prisma.sql`sr.store_id`)}
          GROUP BY 1 ORDER BY COUNT(DISTINCT sr.id) DESC, SUM(sri.line_refund) DESC`;
    const total = data.reduce((s, r) => s + num(r.value), 0);
    const rows = data.map((r) => ({
      label: byStaff ? r.label : (REASON_LABELS[r.label as string] ?? r.label),
      returns: num(r.returns),
      ...(byStaff
        ? { exchanges: num(r.exchanges), refunded: num(r.refunded) }
        : { quantity: num(r.quantity) }),
      value: num(r.value),
      share: total ? round2((num(r.value) / total) * 100) : 0,
    }));
    return {
      report: 'returns.reasons',
      title: byStaff
        ? { vi: 'Trả hàng theo nhân viên', en: 'Returns by staff' }
        : { vi: 'Trả hàng theo lý do', en: 'Returns by reason' },
      scope: scope.toJSON(),
      columns: byStaff
        ? [
            col('label', 'Nhân viên', 'Staff'),
            col('returns', 'Số phiếu', 'Returns', 'integer'),
            col('exchanges', 'Đổi hàng', 'Exchanges', 'integer'),
            col('value', 'Giá trị trả', 'Value', 'money'),
            col('refunded', 'Đã hoàn', 'Refunded', 'money'),
            col('share', 'Tỷ trọng', 'Share', 'percent'),
          ]
        : [
            col('label', 'Lý do', 'Reason'),
            col('returns', 'Số phiếu', 'Returns', 'integer'),
            col('quantity', 'Số lượng', 'Quantity', 'integer'),
            col('value', 'Giá trị trả', 'Value', 'money'),
            col('share', 'Tỷ trọng', 'Share', 'percent'),
          ],
      rows,
      totals: sums(
        rows as Record<string, unknown>[],
        byStaff
          ? ['returns', 'exchanges', 'value', 'refunded']
          : ['returns', 'quantity', 'value'],
      ),
    };
  }

  // ---------------- customers ----------------

  async topCustomers(
    scope: ReportScope,
    limit = 20,
    sortBy?: string,
  ): Promise<ReportResult> {
    const order =
      sortBy === 'orders'
        ? Prisma.sql`s.orders DESC, s.net DESC`
        : Prisma.sql`s.net - COALESCE(r.returns, 0) DESC`;
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${ordersWithNet(scope)}),
      s AS (
        SELECT customer_id, COUNT(*)::int AS orders, SUM(net) AS net, MAX(od) AS last_order
        FROM o WHERE customer_id IS NOT NULL GROUP BY customer_id
      ),
      r AS (
        SELECT customer_id, SUM(goods_amount) AS returns FROM sales_returns
        WHERE ${scope.inRange(Prisma.sql`created_at`)} ${scope.storeFilter(Prisma.sql`store_id`)} AND customer_id IS NOT NULL
        GROUP BY customer_id
      )
      SELECT c.full_name, c.phone, s.orders, s.net, COALESCE(r.returns, 0) AS returns, s.last_order,
             COALESCE(cl.points_balance, 0) AS points, lt.name AS tier,
             COALESCE((SELECT SUM(balance) FROM customer_receivables cr WHERE cr.customer_id = c.id AND cr.balance > 0), 0) AS owed
      FROM s JOIN customers c ON c.id = s.customer_id
      LEFT JOIN r ON r.customer_id = s.customer_id
      LEFT JOIN customer_loyalty cl ON cl.customer_id = c.id
      LEFT JOIN loyalty_tiers lt ON lt.id = cl.current_tier_id
      ORDER BY ${order} LIMIT ${limit}`;
    const rows = data.map((r) => {
      const orders = num(r.orders);
      const net = num(r.net);
      return {
        customer: r.full_name,
        phone: r.phone ?? '',
        tier: r.tier ?? '',
        orders,
        netSales: net,
        returns: num(r.returns),
        netAfterReturns: net - num(r.returns),
        averageOrderValue: orders ? Math.round(net / orders) : 0,
        lastOrder: (r.last_order as Date | null)?.toISOString() ?? null,
        points: num(r.points),
        owed: num(r.owed),
      };
    });
    return {
      report: 'customers.top',
      title: { vi: 'Khách hàng mua nhiều', en: 'Top customers' },
      scope: scope.toJSON(),
      columns: [
        col('customer', 'Khách hàng', 'Customer'),
        col('phone', 'Điện thoại', 'Phone'),
        col('tier', 'Hạng', 'Tier'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col('returns', 'Trả hàng', 'Returns', 'money'),
        col('netAfterReturns', 'Thuần sau trả', 'Net after returns', 'money'),
        col('averageOrderValue', 'Giá trị TB', 'Average order', 'money'),
        col('lastOrder', 'Mua gần nhất', 'Last order', 'datetime'),
        col('points', 'Điểm', 'Points', 'integer'),
        col('owed', 'Còn nợ', 'Owed', 'money'),
      ],
      rows,
      totals: sums(rows, ['orders', 'netSales', 'returns', 'netAfterReturns']),
    };
  }

  /** Points earned, redeemed and reversed in the period per loyalty tier, plus balances. */
  async loyalty(scope: ReportScope): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH t AS (
        SELECT lpt.customer_loyalty_id,
               SUM(CASE WHEN lpt.transaction_type = 'earn' THEN lpt.points ELSE 0 END) AS earned,
               SUM(CASE WHEN lpt.transaction_type = 'redeem' THEN -lpt.points ELSE 0 END) AS redeemed,
               SUM(CASE WHEN lpt.transaction_type IN ('reverse', 'adjust') THEN lpt.points ELSE 0 END) AS adjusted
        FROM loyalty_point_transactions lpt
        WHERE ${scope.inRange(Prisma.sql`lpt.created_at`)}
        GROUP BY lpt.customer_loyalty_id
      ),
      o AS (${ordersWithNet(scope)}),
      redeemed_value AS (SELECT customer_id, SUM(loyalty) AS value FROM o GROUP BY customer_id)
      SELECT COALESCE(lt.name, 'Chưa xếp hạng') AS tier, MIN(COALESCE(lt.display_order, 999)) AS ord,
             COUNT(cl.id)::int AS members,
             COUNT(t.customer_loyalty_id)::int AS active,
             COALESCE(SUM(t.earned), 0)::int AS earned, COALESCE(SUM(t.redeemed), 0)::int AS redeemed,
             COALESCE(SUM(t.adjusted), 0)::int AS adjusted,
             COALESCE(SUM(rv.value), 0) AS redeemed_value,
             COALESCE(SUM(cl.points_balance), 0)::int AS balance
      FROM customer_loyalty cl
      LEFT JOIN loyalty_tiers lt ON lt.id = cl.current_tier_id
      LEFT JOIN t ON t.customer_loyalty_id = cl.id
      LEFT JOIN redeemed_value rv ON rv.customer_id = cl.customer_id
      GROUP BY COALESCE(lt.name, 'Chưa xếp hạng')
      ORDER BY 2`;
    // value of one point when redeemed, from the rules in force now
    const now = new Date();
    const rules = await this.prisma.loyalty_rule_versions.findFirst({
      where: {
        is_active: true,
        effective_from: { lte: now },
        OR: [{ effective_to: null }, { effective_to: { gte: now } }],
      },
      orderBy: { version_number: 'desc' },
      select: { redemption_rate: true },
    });
    const pointValue = num(rules?.redemption_rate);
    const rows = data.map((r) => ({
      tier: r.tier,
      members: num(r.members),
      activeMembers: num(r.active),
      earned: num(r.earned),
      redeemed: num(r.redeemed),
      adjusted: num(r.adjusted),
      redeemedValue: num(r.redeemed_value),
      balance: num(r.balance),
      balanceValue: num(r.balance) * pointValue,
    }));
    return {
      report: 'customers.loyalty',
      title: { vi: 'Tích điểm khách hàng', en: 'Loyalty' },
      scope: scope.toJSON(),
      columns: [
        col('tier', 'Hạng', 'Tier'),
        col('members', 'Thành viên', 'Members', 'integer'),
        col('activeMembers', 'Có giao dịch', 'Active', 'integer'),
        col('earned', 'Điểm tích', 'Earned', 'integer'),
        col('redeemed', 'Điểm dùng', 'Redeemed', 'integer'),
        col('adjusted', 'Thu hồi/hoàn', 'Reversed/adjusted', 'integer'),
        col('redeemedValue', 'Giá trị điểm dùng', 'Redeemed value', 'money'),
        col('balance', 'Điểm còn', 'Balance', 'integer'),
        col('balanceValue', 'Giá trị điểm còn', 'Outstanding value', 'money'),
      ],
      rows,
      totals: sums(rows, [
        'members',
        'activeMembers',
        'earned',
        'redeemed',
        'adjusted',
        'redeemedValue',
        'balance',
        'balanceValue',
      ]),
      meta: { pointValue },
    };
  }

  // ---------------- promotions ----------------

  /** Per promotion and voucher campaign: orders, discount given, net sales and average of those orders. */
  async promotionPerformance(scope: ReportScope): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${ordersWithNet(scope)}),
      d AS (
        SELECT CASE WHEN sod.source_type = 'voucher' THEN 'voucher' ELSE 'promotion' END AS kind,
               COALESCE(sod.promotion_id, v.campaign_id) AS ref_id,
               sod.sales_order_id, SUM(sod.amount) AS amount
        FROM sales_order_discounts sod
        JOIN o ON o.id = sod.sales_order_id
        LEFT JOIN vouchers v ON v.id = sod.voucher_id
        GROUP BY 1, 2, 3
      )
      SELECT d.kind, d.ref_id, COALESCE(p.code, vc.code) AS code, COALESCE(p.name, vc.name) AS name,
             COALESCE(p.type, 'voucher') AS type,
             COUNT(DISTINCT d.sales_order_id)::int AS orders, SUM(d.amount) AS discount,
             SUM(o.gross) AS gross, SUM(o.net) AS net
      FROM d JOIN o ON o.id = d.sales_order_id
      LEFT JOIN promotions p ON d.kind = 'promotion' AND p.id = d.ref_id
      LEFT JOIN voucher_campaigns vc ON d.kind = 'voucher' AND vc.id = d.ref_id
      GROUP BY d.kind, d.ref_id, p.code, vc.code, p.name, vc.name, p.type
      ORDER BY SUM(d.amount) DESC`;
    const all = await this.prisma.$queryRaw<
      { orders: number; net: Prisma.Decimal }[]
    >`
      WITH o AS (${ordersWithNet(scope)}) SELECT COUNT(*)::int AS orders, COALESCE(SUM(net), 0) AS net FROM o`;
    const overallAov = all[0]?.orders ? num(all[0].net) / all[0].orders : 0;
    const rows = data.map((r) => {
      const orders = num(r.orders);
      const net = num(r.net);
      const discount = num(r.discount);
      const aov = orders ? Math.round(net / orders) : 0;
      return {
        kind: r.kind === 'voucher' ? 'Voucher' : 'Khuyến mãi',
        code: r.code ?? '',
        name: r.name ?? '(đã xoá)',
        type: r.type,
        orders,
        discount,
        netSales: net,
        averageOrderValue: aov,
        aovVsAll: overallAov ? round2((aov / overallAov - 1) * 100) : null,
        costRate: num(r.gross) ? round2((discount / num(r.gross)) * 100) : 0,
      };
    });
    return {
      report: 'promotions.performance',
      title: { vi: 'Hiệu quả khuyến mãi', en: 'Promotion performance' },
      scope: scope.toJSON(),
      columns: [
        col('kind', 'Loại', 'Kind'),
        col('code', 'Mã', 'Code'),
        col('name', 'Chương trình', 'Campaign'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('discount', 'Tiền giảm', 'Discount', 'money'),
        col(
          'netSales',
          'Doanh thu thuần các đơn',
          'Net sales of those orders',
          'money',
        ),
        col('averageOrderValue', 'Giá trị TB', 'Average order', 'money'),
        col('aovVsAll', 'So với TB chung', 'vs. all orders', 'percent'),
        col('costRate', 'Chi phí/doanh số', 'Cost rate', 'percent'),
      ],
      rows,
      totals: sums(rows, ['discount']),
      meta: {
        allOrders: all[0]?.orders ?? 0,
        allAverageOrderValue: Math.round(overallAov),
      },
    };
  }
}

const round0 = (v: number) => Math.round(v);

function sum<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): number {
  return rows.reduce(
    (s, r) => s + (typeof r[key] === 'number' ? (r[key] as number) : 0),
    0,
  );
}

function sums<T extends Record<string, unknown>, K extends keyof T & string>(
  rows: T[],
  keys: K[],
): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, sum(rows, k)])) as Record<
    K,
    number
  >;
}
