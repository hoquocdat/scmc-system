import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportScope } from './report-scope';
import {
  col,
  normalizePaymentMethod,
  num,
  PAYMENT_METHOD_LABELS,
  ReportResult,
} from './report-types';

/**
 * Retail sales reports. All amounts follow design D2:
 *   gross      = sum(unit_price * quantity)
 *   discounts  = line discounts + order discount + loyalty discount
 *   net sales  = gross - discounts  (= total - tax - shipping)
 * Only revenue-bearing orders are counted (ReportScope.revenueStatus).
 */
@Injectable()
export class SalesReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `so` rows in scope: revenue status, date range, optional store. */
  private ordersInScope(scope: ReportScope): Prisma.Sql {
    return Prisma.sql`
      SELECT so.id, so.store_id, so.discount_amount, so.loyalty_discount_amount,
             so.tax_amount, so.shipping_cost, so.total_amount,
             ${ReportScope.orderDate('so')} AS order_date
      FROM sales_orders so
      WHERE ${scope.inRange(ReportScope.orderDate('so'))}
        AND ${ReportScope.revenueStatus(Prisma.sql`so.status`)}
        ${scope.storeFilter(Prisma.sql`so.store_id`)}`;
  }

  async summary(scope: ReportScope): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${this.ordersInScope(scope)}),
      l AS (
        SELECT soi.sales_order_id,
               SUM(soi.unit_price * soi.quantity) AS gross,
               SUM(COALESCE(soi.discount_amount, 0) * soi.quantity) AS line_discount,
               SUM(soi.quantity) AS items
        FROM sales_order_items soi JOIN o ON o.id = soi.sales_order_id
        GROUP BY soi.sales_order_id
      )
      SELECT COUNT(o.id)::int AS orders,
             COALESCE(SUM(l.gross), 0) AS gross_sales,
             COALESCE(SUM(l.line_discount), 0) AS line_discounts,
             COALESCE(SUM(o.discount_amount), 0) AS order_discounts,
             COALESCE(SUM(o.loyalty_discount_amount), 0) AS loyalty_discounts,
             COALESCE(SUM(o.tax_amount), 0) AS tax,
             COALESCE(SUM(o.shipping_cost), 0) AS shipping,
             COALESCE(SUM(o.total_amount), 0) AS total,
             COALESCE(SUM(l.items), 0)::int AS items_sold
      FROM o LEFT JOIN l ON l.sales_order_id = o.id`;

    const r = rows[0] ?? {};
    const grossSales = num(r.gross_sales);
    const discounts =
      num(r.line_discounts) + num(r.order_discounts) + num(r.loyalty_discounts);
    const netSales = grossSales - discounts;
    const orders = num(r.orders);
    const summary = {
      orders,
      grossSales,
      lineDiscounts: num(r.line_discounts),
      orderDiscounts: num(r.order_discounts),
      loyaltyDiscounts: num(r.loyalty_discounts),
      discounts,
      netSales,
      tax: num(r.tax),
      shipping: num(r.shipping),
      total: num(r.total),
      itemsSold: num(r.items_sold),
      averageOrderValue: orders > 0 ? Math.round(netSales / orders) : 0,
    };

    return {
      report: 'sales.summary',
      title: { vi: 'Tổng quan bán hàng', en: 'Sales summary' },
      scope: scope.toJSON(),
      columns: [
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('grossSales', 'Doanh số gộp', 'Gross sales', 'money'),
        col('discounts', 'Giảm giá', 'Discounts', 'money'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col('tax', 'Thuế', 'Tax', 'money'),
        col('shipping', 'Phí vận chuyển', 'Shipping', 'money'),
        col('total', 'Tổng thanh toán', 'Order total', 'money'),
        col('itemsSold', 'Số lượng bán', 'Items sold', 'integer'),
        col(
          'averageOrderValue',
          'Giá trị đơn TB',
          'Average order value',
          'money',
        ),
      ],
      rows: [summary],
      meta: { summary },
    };
  }

  async byCategory(scope: ReportScope): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${this.ordersInScope(scope)})
      SELECT COALESCE(pc.id::text, '') AS category_id,
             COALESCE(pc.name, 'Uncategorized') AS category,
             COUNT(DISTINCT soi.sales_order_id)::int AS orders,
             SUM(soi.quantity)::int AS quantity,
             SUM(soi.unit_price * soi.quantity) AS gross_sales,
             SUM((soi.unit_price - COALESCE(soi.discount_amount, 0)) * soi.quantity) AS net_sales
      FROM sales_order_items soi
      JOIN o ON o.id = soi.sales_order_id
      LEFT JOIN products p ON p.id = soi.product_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      GROUP BY pc.id, pc.name
      ORDER BY net_sales DESC`;

    const data = rows.map((r) => ({
      categoryId: (r.category_id as string) || null,
      category: r.category as string,
      orders: num(r.orders),
      quantity: num(r.quantity),
      grossSales: num(r.gross_sales),
      netSales: num(r.net_sales),
    }));

    return {
      report: 'sales.by-category',
      title: { vi: 'Bán hàng theo danh mục', en: 'Sales by category' },
      scope: scope.toJSON(),
      columns: [
        col('category', 'Danh mục', 'Category'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('quantity', 'Số lượng', 'Quantity', 'integer'),
        col('grossSales', 'Doanh số gộp', 'Gross sales', 'money'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
      ],
      rows: data,
      totals: {
        quantity: data.reduce((s, r) => s + r.quantity, 0),
        grossSales: data.reduce((s, r) => s + r.grossSales, 0),
        netSales: data.reduce((s, r) => s + r.netSales, 0),
      },
    };
  }

  /** Retail money received per payment method (completed sales-order payments). */
  async byPaymentMethod(scope: ReportScope): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT sop.payment_method, SUM(sop.amount) AS amount, COUNT(*)::int AS payments
      FROM sales_order_payments sop
      JOIN sales_orders so ON so.id = sop.sales_order_id
      WHERE sop.status = 'completed'
        AND ${scope.inRange(Prisma.sql`COALESCE(sop.payment_date, sop.created_at)`)}
        ${scope.storeFilter(Prisma.sql`so.store_id`)}
      GROUP BY sop.payment_method`;

    const data = mergeByMethod(rows);
    return {
      report: 'sales.by-payment-method',
      title: {
        vi: 'Thanh toán theo phương thức',
        en: 'Sales by payment method',
      },
      scope: scope.toJSON(),
      columns: [
        col('method', 'Mã', 'Method'),
        col('label', 'Phương thức', 'Payment method'),
        col('amount', 'Số tiền', 'Amount', 'money'),
        col('payments', 'Số giao dịch', 'Payments', 'integer'),
      ],
      rows: data,
      totals: {
        amount: data.reduce((s, r) => s + r.amount, 0),
        payments: data.reduce((s, r) => s + r.payments, 0),
      },
    };
  }

  async topProducts(
    scope: ReportScope,
    limit = 10,
    sortBy: 'quantity' | 'netSales' = 'quantity',
  ): Promise<ReportResult> {
    if (!['quantity', 'netSales'].includes(sortBy)) {
      throw new BadRequestException('sortBy must be quantity or netSales');
    }
    const orderBy =
      sortBy === 'quantity'
        ? Prisma.raw('quantity DESC, net_sales DESC')
        : Prisma.raw('net_sales DESC, quantity DESC');
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${this.ordersInScope(scope)})
      SELECT p.id AS product_id, pv.id AS variant_id,
             COALESCE(pv.sku, p.sku) AS sku,
             COALESCE(pv.name, p.name) AS name,
             COUNT(DISTINCT soi.sales_order_id)::int AS orders,
             SUM(soi.quantity)::int AS quantity,
             SUM((soi.unit_price - COALESCE(soi.discount_amount, 0)) * soi.quantity) AS net_sales
      FROM sales_order_items soi
      JOIN o ON o.id = soi.sales_order_id
      LEFT JOIN products p ON p.id = soi.product_id
      LEFT JOIN product_variants pv ON pv.id = soi.product_variant_id
      GROUP BY p.id, pv.id, COALESCE(pv.sku, p.sku), COALESCE(pv.name, p.name)
      ORDER BY ${orderBy}
      LIMIT ${limit}`;

    return {
      report: 'sales.top-products',
      title: { vi: 'Sản phẩm bán chạy', en: 'Top products' },
      scope: scope.toJSON(),
      columns: [
        col('sku', 'SKU', 'SKU'),
        col('name', 'Sản phẩm', 'Product'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('quantity', 'Số lượng', 'Quantity', 'integer'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
      ],
      rows: rows.map((r) => ({
        productId: r.product_id as string | null,
        variantId: (r.variant_id as string | null) ?? null,
        sku: r.sku as string,
        name: r.name as string,
        orders: num(r.orders),
        quantity: num(r.quantity),
        netSales: num(r.net_sales),
      })),
      meta: { limit, sortBy },
    };
  }

  async trends(scope: ReportScope): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (${this.ordersInScope(scope)}),
      l AS (
        SELECT soi.sales_order_id,
               SUM(soi.unit_price * soi.quantity) AS gross,
               SUM(COALESCE(soi.discount_amount, 0) * soi.quantity) AS line_discount
        FROM sales_order_items soi JOIN o ON o.id = soi.sales_order_id
        GROUP BY soi.sales_order_id
      ),
      per_order AS (
        SELECT ${scope.periodKey(Prisma.sql`o.order_date`)} AS period,
               o.id,
               COALESCE(l.gross, 0) - COALESCE(l.line_discount, 0)
                 - COALESCE(o.discount_amount, 0) - COALESCE(o.loyalty_discount_amount, 0) AS net
        FROM o LEFT JOIN l ON l.sales_order_id = o.id
      )
      SELECT p.period,
             COUNT(po.id)::int AS orders,
             COALESCE(SUM(po.net), 0) AS net_sales
      FROM ${scope.periodSeries()} p
      LEFT JOIN per_order po ON po.period = p.period
      GROUP BY p.period
      ORDER BY p.period`;

    const data = rows.map((r) => {
      const orders = num(r.orders);
      const netSales = num(r.net_sales);
      return {
        period: r.period as string,
        orders,
        netSales,
        averageOrderValue: orders > 0 ? Math.round(netSales / orders) : 0,
      };
    });

    return {
      report: 'sales.trends',
      title: { vi: 'Xu hướng bán hàng', en: 'Sales trends' },
      scope: scope.toJSON(),
      columns: [
        col('period', 'Kỳ', 'Period'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col(
          'averageOrderValue',
          'Giá trị đơn TB',
          'Average order value',
          'money',
        ),
      ],
      rows: data,
      totals: {
        orders: data.reduce((s, r) => s + r.orders, 0),
        netSales: data.reduce((s, r) => s + r.netSales, 0),
      },
    };
  }
}

/** Groups raw payment rows by the normalised method name. */
export function mergeByMethod(rows: Record<string, unknown>[]) {
  const merged = new Map<
    string,
    { method: string; label: string; amount: number; payments: number }
  >();
  for (const r of rows) {
    const method = normalizePaymentMethod(r.payment_method as string);
    const cur = merged.get(method) ?? {
      method,
      label: (PAYMENT_METHOD_LABELS[method] ?? PAYMENT_METHOD_LABELS.other).vi,
      amount: 0,
      payments: 0,
    };
    cur.amount += num(r.amount);
    cur.payments += num(r.payments);
    merged.set(method, cur);
  }
  return [...merged.values()].sort((a, b) => b.amount - a.amount);
}
