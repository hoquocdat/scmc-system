import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryReportsService } from './inventory-reports.service';
import { ReportScope, toReportDate } from './report-scope';
import { col, num, ReportResult } from './report-types';
import { mergeByMethod, SalesReportsService } from './sales-reports.service';
import { WorkshopReportsService } from './workshop-reports.service';

/**
 * Financial reports across both business lines:
 *   retail   = sales orders (net sales) and sales_order_payments (money received)
 *   workshop = delivered service orders (revenue) and payments (money received)
 */
@Injectable()
export class FinancialReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesReportsService,
    private readonly workshop: WorkshopReportsService,
    private readonly inventory: InventoryReportsService,
  ) {}

  private async retailReceived(scope: ReportScope) {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT sop.payment_method, SUM(sop.amount) AS amount, COUNT(*)::int AS payments
      FROM sales_order_payments sop
      JOIN sales_orders so ON so.id = sop.sales_order_id
      WHERE sop.status = 'completed'
        AND ${scope.inRange(Prisma.sql`COALESCE(sop.payment_date, sop.created_at)`)}
        ${scope.storeFilter(Prisma.sql`so.store_id`)}
      GROUP BY sop.payment_method`;
    return mergeByMethod(rows);
  }

  private async workshopReceived(scope: ReportScope) {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT p.payment_method::text AS payment_method, SUM(p.amount) AS amount, COUNT(*)::int AS payments
      FROM payments p
      JOIN service_orders svc ON svc.id = p.service_order_id
      WHERE ${scope.inRange(Prisma.sql`COALESCE(p.payment_date, p.created_at)`)}
        ${scope.storeFilter(Prisma.sql`svc.store_id`)}
      GROUP BY p.payment_method`;
    return mergeByMethod(rows);
  }

  /** Revenue by business line plus money received per payment method. */
  async revenue(scope: ReportScope): Promise<ReportResult> {
    const [retail, workshop, retailReceived, workshopReceived] =
      await Promise.all([
        this.sales.summary(scope),
        this.workshop.revenue(scope),
        this.retailReceived(scope),
        this.workshopReceived(scope),
      ]);
    const retailSummary = retail.meta?.summary as {
      netSales: number;
      orders: number;
      total: number;
    };
    const workshopSummary = workshop.meta?.summary as {
      revenue: number;
      orders: number;
    };

    const sum = (rows: { amount: number }[]) =>
      rows.reduce((s, r) => s + r.amount, 0);
    const combinedReceived = mergeByMethod(
      [...retailReceived, ...workshopReceived].map((r) => ({
        payment_method: r.method,
        amount: r.amount,
        payments: r.payments,
      })),
    );

    const rows = [
      {
        line: 'retail',
        label: 'Bán lẻ',
        revenue: retailSummary.netSales,
        orders: retailSummary.orders,
        received: sum(retailReceived),
      },
      {
        line: 'workshop',
        label: 'Dịch vụ xưởng',
        revenue: workshopSummary.revenue,
        orders: workshopSummary.orders,
        received: sum(workshopReceived),
      },
    ];
    const combined = {
      line: 'combined',
      label: 'Tổng cộng',
      revenue: rows[0].revenue + rows[1].revenue,
      orders: rows[0].orders + rows[1].orders,
      received: rows[0].received + rows[1].received,
    };

    return {
      report: 'financial.revenue',
      title: { vi: 'Doanh thu', en: 'Revenue' },
      scope: scope.toJSON(),
      columns: [
        col('label', 'Mảng', 'Business line'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('revenue', 'Doanh thu', 'Revenue', 'money'),
        col('received', 'Tiền đã thu', 'Money received', 'money'),
      ],
      rows,
      totals: {
        revenue: combined.revenue,
        orders: combined.orders,
        received: combined.received,
      },
      meta: {
        retail: retailSummary,
        workshop: workshopSummary,
        combined,
        received: {
          retail: retailReceived,
          workshop: workshopReceived,
          combined: combinedReceived,
        },
      },
    };
  }

  /**
   * Cost of goods sold for retail sales in scope: the cost recorded on each
   * SALE stock movement, falling back to the current product cost when none
   * was recorded (flagged as estimated).
   */
  async cogs(scope: ReportScope): Promise<{
    recorded: number;
    estimated: number;
    total: number;
    estimatedShare: number;
  }> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (
        SELECT so.id FROM sales_orders so
        WHERE ${scope.inRange(ReportScope.orderDate('so'))}
          AND ${ReportScope.revenueStatus(Prisma.sql`so.status`)}
          ${scope.storeFilter(Prisma.sql`so.store_id`)}
      )
      SELECT COALESCE(SUM(CASE WHEN it.unit_cost IS NOT NULL THEN ABS(it.quantity) * it.unit_cost ELSE 0 END), 0) AS recorded,
             COALESCE(SUM(CASE WHEN it.unit_cost IS NULL THEN ABS(it.quantity) * COALESCE(pv.cost_price_override, p.cost_price, 0) ELSE 0 END), 0) AS estimated
      FROM inventory_transactions it
      JOIN o ON o.id = it.reference_id AND it.reference_type = 'sales_order'
      LEFT JOIN product_variants pv ON pv.id = it.product_variant_id
      LEFT JOIN products p ON p.id = COALESCE(it.product_id, pv.product_id)
      WHERE it.transaction_type = 'SALE'`;
    const recorded = num(rows[0]?.recorded);
    const estimated = num(rows[0]?.estimated);
    const total = recorded + estimated;
    return {
      recorded,
      estimated,
      total,
      estimatedShare:
        total > 0 ? Math.round((estimated / total) * 10000) / 10000 : 0,
    };
  }

  /** Gross profit = retail net sales - COGS. */
  async profit(scope: ReportScope): Promise<ReportResult> {
    const [summaryResult, cogs] = await Promise.all([
      this.sales.summary(scope),
      this.cogs(scope),
    ]);
    const summary = summaryResult.meta?.summary as {
      netSales: number;
      orders: number;
    };
    const grossProfit = summary.netSales - cogs.total;
    const marginPercent =
      summary.netSales > 0
        ? Math.round((grossProfit / summary.netSales) * 10000) / 100
        : 0;

    return {
      report: 'financial.profit',
      title: { vi: 'Lợi nhuận gộp', en: 'Gross profit' },
      scope: scope.toJSON(),
      columns: [
        col('netSales', 'Doanh thu thuần', 'Net sales', 'money'),
        col('cogs', 'Giá vốn hàng bán', 'Cost of goods sold', 'money'),
        col('grossProfit', 'Lợi nhuận gộp', 'Gross profit', 'money'),
        col('marginPercent', 'Biên lợi nhuận', 'Gross margin', 'percent'),
      ],
      rows: [
        {
          netSales: summary.netSales,
          cogs: cogs.total,
          grossProfit,
          marginPercent,
        },
      ],
      meta: {
        orders: summary.orders,
        cogsRecorded: cogs.recorded,
        cogsEstimated: cogs.estimated,
        cogsEstimatedShare: cogs.estimatedShare,
        estimated: cogs.estimated > 0,
      },
    };
  }

  /** VAT from the tax recorded on revenue-bearing orders, per period and in total. */
  async vat(scope: ReportScope): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (
        SELECT so.id, so.tax_amount, so.total_amount, ${ReportScope.orderDate('so')} AS order_date
        FROM sales_orders so
        WHERE ${scope.inRange(ReportScope.orderDate('so'))}
          AND ${ReportScope.revenueStatus(Prisma.sql`so.status`)}
          ${scope.storeFilter(Prisma.sql`so.store_id`)}
      )
      SELECT p.period, COUNT(o.id)::int AS orders,
             COALESCE(SUM(o.total_amount - COALESCE(o.tax_amount, 0)), 0) AS taxable,
             COALESCE(SUM(o.tax_amount), 0) AS vat
      FROM ${scope.periodSeries()} p
      LEFT JOIN o ON ${scope.periodKey(Prisma.sql`o.order_date`)} = p.period
      GROUP BY p.period ORDER BY p.period`;

    const data = rows.map((r) => ({
      period: r.period as string,
      orders: num(r.orders),
      taxable: num(r.taxable),
      vat: num(r.vat),
    }));
    return {
      report: 'financial.vat',
      title: { vi: 'Thuế GTGT', en: 'VAT' },
      scope: scope.toJSON(),
      columns: [
        col('period', 'Kỳ', 'Period'),
        col('orders', 'Số đơn', 'Orders', 'integer'),
        col('taxable', 'Doanh thu trước thuế', 'Taxable amount', 'money'),
        col('vat', 'Thuế GTGT', 'VAT', 'money'),
      ],
      rows: data,
      totals: {
        orders: data.reduce((s, r) => s + r.orders, 0),
        taxable: data.reduce((s, r) => s + r.taxable, 0),
        vat: data.reduce((s, r) => s + r.vat, 0),
      },
    };
  }

  /** Dashboard KPIs: today and month to date, in Vietnam time, same rules as the reports. */
  async dashboardKpis(storeId?: string, now: Date = new Date()) {
    const today = toReportDate(now);
    const monthStart = `${today.slice(0, 7)}-01`;
    const todayScope = new ReportScope(
      { from: today, to: today, storeId },
      now,
    );
    const monthScope = new ReportScope(
      { from: monthStart, to: today, storeId },
      now,
    );

    const [
      todaySales,
      monthSales,
      todayWorkshop,
      monthWorkshop,
      valuation,
      lowStock,
      inService,
    ] = await Promise.all([
      this.sales.summary(todayScope),
      this.sales.summary(monthScope),
      this.workshop.revenue(todayScope),
      this.workshop.revenue(monthScope),
      this.inventory.valuation(monthScope),
      this.inventory.lowStock(monthScope),
      this.workshop.inService(monthScope),
    ]);

    const pick = (sales: ReportResult, workshop: ReportResult) => {
      const s = sales.meta?.summary as {
        netSales: number;
        orders: number;
        averageOrderValue: number;
      };
      const w = workshop.meta?.summary as { revenue: number; orders: number };
      return {
        retail: {
          netSales: s.netSales,
          orders: s.orders,
          averageOrderValue: s.averageOrderValue,
        },
        workshop: { revenue: w.revenue, orders: w.orders },
        combinedRevenue: s.netSales + w.revenue,
      };
    };

    return {
      scope: { today, monthStart, storeId: storeId ?? null },
      today: pick(todaySales, todayWorkshop),
      monthToDate: pick(monthSales, monthWorkshop),
      inventory: {
        stockValue: num(valuation.totals?.value),
        lowStockCount: lowStock.rows.length,
      },
      workshop: { bikesInService: num(inService.meta?.total) },
    };
  }
}
