import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportScope } from './report-scope';
import { col, num, ReportResult } from './report-types';

/** Statuses that mean a bike is still in the workshop. */
export const IN_SERVICE_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
  'waiting_parts',
  'waiting_approval',
  'quality_check',
  'completed',
  'ready_for_pickup',
] as const;

/**
 * Workshop (service order) reports. Rules from design D5:
 *   delivered date = pickup_date, else actual_completion_date, else updated_at
 *   revenue        = final_cost, else estimated_cost, else 0
 *   only orders with status 'delivered' count as revenue
 */
@Injectable()
export class WorkshopReportsService {
  constructor(private readonly prisma: PrismaService) {}

  static deliveredAt(alias = 'svc'): Prisma.Sql {
    return Prisma.raw(
      `COALESCE(${alias}.pickup_date, ${alias}.actual_completion_date, ${alias}.updated_at)`,
    );
  }

  static revenue(alias = 'svc'): Prisma.Sql {
    return Prisma.raw(
      `COALESCE(${alias}.final_cost, ${alias}.estimated_cost, 0)`,
    );
  }

  /** Delivered service orders in scope (`svc` alias) with delivered_at and revenue columns. */
  static deliveredInScope(scope: ReportScope): Prisma.Sql {
    return Prisma.sql`
      SELECT svc.id, svc.order_number, svc.store_id, svc.assigned_employee_id, svc.drop_off_date,
             ${WorkshopReportsService.deliveredAt('svc')} AS delivered_at,
             ${WorkshopReportsService.revenue('svc')} AS revenue
      FROM service_orders svc
      WHERE svc.status = 'delivered'
        AND ${scope.inRange(WorkshopReportsService.deliveredAt('svc'))}
        ${scope.storeFilter(Prisma.sql`svc.store_id`)}`;
  }

  async revenue(scope: ReportScope): Promise<ReportResult> {
    const [totals, trend] = await Promise.all([
      this.prisma.$queryRaw<Record<string, unknown>[]>`
        WITH d AS (${WorkshopReportsService.deliveredInScope(scope)})
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(revenue), 0) AS revenue FROM d`,
      this.prisma.$queryRaw<Record<string, unknown>[]>`
        WITH d AS (${WorkshopReportsService.deliveredInScope(scope)})
        SELECT p.period, COUNT(d.id)::int AS orders, COALESCE(SUM(d.revenue), 0) AS revenue
        FROM ${scope.periodSeries()} p
        LEFT JOIN d ON ${scope.periodKey(Prisma.sql`d.delivered_at`)} = p.period
        GROUP BY p.period ORDER BY p.period`,
    ]);

    const orders = num(totals[0]?.orders);
    const revenue = num(totals[0]?.revenue);
    const rows = trend.map((r) => {
      const o = num(r.orders);
      const rev = num(r.revenue);
      return {
        period: r.period as string,
        orders: o,
        revenue: rev,
        averageOrderValue: o > 0 ? Math.round(rev / o) : 0,
      };
    });

    return {
      report: 'workshop.revenue',
      title: { vi: 'Doanh thu dịch vụ', en: 'Service revenue' },
      scope: scope.toJSON(),
      columns: [
        col('period', 'Kỳ', 'Period'),
        col('orders', 'Xe đã giao', 'Delivered orders', 'integer'),
        col('revenue', 'Doanh thu', 'Revenue', 'money'),
        col('averageOrderValue', 'Giá trị TB', 'Average order value', 'money'),
      ],
      rows,
      totals: { orders, revenue },
      meta: {
        summary: {
          orders,
          revenue,
          averageOrderValue: orders > 0 ? Math.round(revenue / orders) : 0,
        },
      },
    };
  }

  /**
   * Delivered orders, revenue and average turnaround per technician.
   * Every assigned technician gets the order counted; revenue goes to the
   * primary technician only. Orders without service_order_employees rows fall
   * back to assigned_employee_id as primary.
   */
  async technicians(scope: ReportScope): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH d AS (${WorkshopReportsService.deliveredInScope(scope)}),
      assignment AS (
        SELECT d.id AS order_id, soe.employee_id, COALESCE(soe.is_primary, false) AS is_primary
        FROM d JOIN service_order_employees soe ON soe.service_order_id = d.id
        UNION ALL
        SELECT d.id, d.assigned_employee_id, true
        FROM d
        WHERE d.assigned_employee_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM service_order_employees soe WHERE soe.service_order_id = d.id)
      )
      SELECT up.id AS employee_id, up.full_name,
             COUNT(DISTINCT a.order_id)::int AS orders,
             COALESCE(SUM(CASE WHEN a.is_primary THEN d.revenue ELSE 0 END), 0) AS revenue,
             AVG(EXTRACT(EPOCH FROM (d.delivered_at - d.drop_off_date)) / 86400.0) AS avg_turnaround_days
      FROM assignment a
      JOIN d ON d.id = a.order_id
      JOIN user_profiles up ON up.id = a.employee_id
      GROUP BY up.id, up.full_name
      ORDER BY revenue DESC, orders DESC`;

    return {
      report: 'workshop.technicians',
      title: { vi: 'Hiệu suất kỹ thuật viên', en: 'Technician performance' },
      scope: scope.toJSON(),
      columns: [
        col('fullName', 'Kỹ thuật viên', 'Technician'),
        col('orders', 'Xe đã giao', 'Delivered orders', 'integer'),
        col('revenue', 'Doanh thu (chính)', 'Revenue (primary)', 'money'),
        col(
          'averageTurnaroundDays',
          'TG hoàn thành TB (ngày)',
          'Average turnaround (days)',
          'number',
        ),
      ],
      rows: rows.map((r) => ({
        employeeId: r.employee_id as string,
        fullName: r.full_name as string,
        orders: num(r.orders),
        revenue: num(r.revenue),
        averageTurnaroundDays:
          Math.round(num(r.avg_turnaround_days) * 100) / 100,
      })),
    };
  }

  /** Parts used on service orders in the period, ranked by total cost. */
  async parts(scope: ReportScope, limit = 10): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT pt.id AS part_id, pt.part_number, pt.name,
             SUM(sp.quantity_used)::int AS quantity,
             COALESCE(SUM(COALESCE(sp.total_cost, sp.unit_cost * sp.quantity_used)), 0) AS total_cost,
             COUNT(DISTINCT sp.service_order_id)::int AS orders
      FROM service_parts sp
      JOIN parts pt ON pt.id = sp.part_id
      JOIN service_orders svc ON svc.id = sp.service_order_id
      WHERE ${scope.inRange(Prisma.sql`sp.created_at`)}
        ${scope.storeFilter(Prisma.sql`svc.store_id`)}
      GROUP BY pt.id, pt.part_number, pt.name
      ORDER BY total_cost DESC, quantity DESC
      LIMIT ${limit}`;

    return {
      report: 'workshop.parts',
      title: { vi: 'Phụ tùng sử dụng', en: 'Parts used in service' },
      scope: scope.toJSON(),
      columns: [
        col('partNumber', 'Mã phụ tùng', 'Part number'),
        col('name', 'Phụ tùng', 'Part'),
        col('quantity', 'Số lượng', 'Quantity', 'integer'),
        col('totalCost', 'Chi phí', 'Total cost', 'money'),
        col('orders', 'Số phiếu', 'Service orders', 'integer'),
      ],
      rows: rows.map((r) => ({
        partId: r.part_id as string,
        partNumber: (r.part_number as string | null) ?? null,
        name: r.name as string,
        quantity: num(r.quantity),
        totalCost: num(r.total_cost),
        orders: num(r.orders),
      })),
      meta: { limit },
    };
  }

  /** Current snapshot: bikes in the workshop per status (everything except delivered and cancelled). */
  async inService(scope: ReportScope): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT svc.status::text AS status, COUNT(*)::int AS bikes
      FROM service_orders svc
      WHERE svc.status NOT IN ('delivered', 'cancelled')
        ${scope.storeFilter(Prisma.sql`svc.store_id`)}
      GROUP BY svc.status`;

    const counts = Object.fromEntries(
      rows.map((r) => [r.status as string, num(r.bikes)]),
    );
    const data = IN_SERVICE_STATUSES.map((status) => ({
      status,
      bikes: counts[status] ?? 0,
    }));
    const total = data.reduce((s, r) => s + r.bikes, 0);

    return {
      report: 'workshop.in-service',
      title: { vi: 'Xe đang trong xưởng', en: 'Bikes in service' },
      scope: scope.toJSON(),
      columns: [
        col('status', 'Trạng thái', 'Status'),
        col('bikes', 'Số xe', 'Bikes', 'integer'),
      ],
      rows: data,
      totals: { bikes: total },
      meta: { total, byStatus: counts },
    };
  }

  /** Average and median days from drop-off to delivery, overall and per branch. */
  async turnaround(scope: ReportScope): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH d AS (${WorkshopReportsService.deliveredInScope(scope)}),
      days AS (
        SELECT d.store_id, EXTRACT(EPOCH FROM (d.delivered_at - d.drop_off_date)) / 86400.0 AS days FROM d
      )
      SELECT st.id AS store_id, st.name AS store,
             COUNT(*)::int AS orders,
             AVG(days.days) AS avg_days,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days.days) AS median_days
      FROM days LEFT JOIN stores st ON st.id = days.store_id
      GROUP BY ROLLUP (st.id, st.name)
      HAVING (st.id IS NOT NULL AND st.name IS NOT NULL) OR (st.id IS NULL AND st.name IS NULL)
      ORDER BY st.name NULLS LAST`;

    const data = rows.map((r) => ({
      storeId: (r.store_id as string | null) ?? null,
      store: (r.store as string | null) ?? 'Tất cả',
      orders: num(r.orders),
      averageDays: Math.round(num(r.avg_days) * 100) / 100,
      medianDays: Math.round(num(r.median_days) * 100) / 100,
    }));
    const overall = data.find((r) => r.storeId === null);

    return {
      report: 'workshop.turnaround',
      title: { vi: 'Thời gian hoàn thành', en: 'Turnaround time' },
      scope: scope.toJSON(),
      columns: [
        col('store', 'Chi nhánh', 'Branch'),
        col('orders', 'Xe đã giao', 'Delivered orders', 'integer'),
        col('averageDays', 'TB (ngày)', 'Average (days)', 'number'),
        col('medianDays', 'Trung vị (ngày)', 'Median (days)', 'number'),
      ],
      rows: data.filter((r) => r.storeId !== null),
      totals: overall
        ? {
            orders: overall.orders,
            averageDays: overall.averageDays,
            medianDays: overall.medianDays,
          }
        : undefined,
      meta: { overall },
    };
  }
}
