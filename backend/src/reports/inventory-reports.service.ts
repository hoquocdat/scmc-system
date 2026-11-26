import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportScope } from './report-scope';
import { col, num, PagedMeta, ReportResult } from './report-types';

export interface InventoryFilters {
  locationId?: string;
  productId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
  /** Return every matching row (used by exports); paging is ignored. */
  all?: boolean;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidFilter = (column: Prisma.Sql, value?: string) =>
  value && UUID_RE.test(value)
    ? Prisma.sql`AND ${column} = ${value}::uuid`
    : Prisma.empty;

/** Unit cost of a stock row: the variant's own cost when it has one, else the product's. */
const UNIT_COST = Prisma.raw(
  'COALESCE(pv.cost_price_override, p.cost_price, 0)',
);

@Injectable()
export class InventoryReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Quantity on hand and value at cost per product/variant and location. */
  async valuation(
    scope: ReportScope,
    filters: InventoryFilters = {},
  ): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT inv.location_id, sl.name AS location,
             p.id AS product_id, pv.id AS variant_id,
             COALESCE(pv.sku, p.sku) AS sku, COALESCE(pv.name, p.name) AS name,
             COALESCE(inv.quantity_on_hand, 0)::int AS quantity,
             ${UNIT_COST} AS unit_cost,
             COALESCE(inv.quantity_on_hand, 0) * ${UNIT_COST} AS value
      FROM inventory inv
      JOIN stock_locations sl ON sl.id = inv.location_id
      LEFT JOIN product_variants pv ON pv.id = inv.product_variant_id
      LEFT JOIN products p ON p.id = COALESCE(inv.product_id, pv.product_id)
      WHERE 1 = 1
        ${uuidFilter(Prisma.sql`inv.location_id`, filters.locationId)}
        ${uuidFilter(Prisma.sql`p.id`, filters.productId)}
      ORDER BY sl.name, COALESCE(pv.name, p.name)`;

    const data = rows.map((r) => ({
      locationId: r.location_id as string,
      location: r.location as string,
      productId: r.product_id as string | null,
      variantId: (r.variant_id as string | null) ?? null,
      sku: r.sku as string,
      name: r.name as string,
      quantity: num(r.quantity),
      unitCost: num(r.unit_cost),
      value: num(r.value),
    }));

    const byLocation = new Map<
      string,
      { locationId: string; location: string; quantity: number; value: number }
    >();
    for (const r of data) {
      const cur = byLocation.get(r.locationId) ?? {
        locationId: r.locationId,
        location: r.location,
        quantity: 0,
        value: 0,
      };
      cur.quantity += r.quantity;
      cur.value += r.value;
      byLocation.set(r.locationId, cur);
    }

    return {
      report: 'inventory.valuation',
      title: { vi: 'Giá trị tồn kho', en: 'Stock valuation' },
      scope: scope.toJSON(),
      columns: [
        col('location', 'Kho', 'Location'),
        col('sku', 'SKU', 'SKU'),
        col('name', 'Sản phẩm', 'Product'),
        col('quantity', 'Tồn kho', 'On hand', 'integer'),
        col('unitCost', 'Giá vốn', 'Unit cost', 'money'),
        col('value', 'Giá trị', 'Value', 'money'),
      ],
      rows: data,
      totals: {
        quantity: data.reduce((s, r) => s + r.quantity, 0),
        value: data.reduce((s, r) => s + r.value, 0),
      },
      meta: { byLocation: [...byLocation.values()] },
    };
  }

  /** Stock movements in the period, paged, with product/location/type filters. */
  async movement(
    scope: ReportScope,
    filters: InventoryFilters = {},
  ): Promise<ReportResult> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, filters.pageSize ?? 50));
    const where = Prisma.sql`
      WHERE ${scope.inRange(Prisma.sql`it.created_at`)}
        ${uuidFilter(Prisma.sql`it.location_id`, filters.locationId)}
        ${uuidFilter(Prisma.sql`COALESCE(it.product_id, pv.product_id)`, filters.productId)}
        ${filters.type ? Prisma.sql`AND it.transaction_type = ${filters.type.toUpperCase()}` : Prisma.empty}`;
    const from = Prisma.sql`
      FROM inventory_transactions it
      JOIN stock_locations sl ON sl.id = it.location_id
      LEFT JOIN product_variants pv ON pv.id = it.product_variant_id
      LEFT JOIN products p ON p.id = COALESCE(it.product_id, pv.product_id)`;

    const paging = filters.all
      ? Prisma.empty
      : Prisma.sql`LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    const [countRows, rows] = await Promise.all([
      this.prisma.$queryRaw<
        { total: number }[]
      >`SELECT COUNT(*)::int AS total ${from} ${where}`,
      this.prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT it.id, it.created_at, sl.name AS location, it.location_id,
               COALESCE(pv.sku, p.sku) AS sku, COALESCE(pv.name, p.name) AS name,
               p.id AS product_id, pv.id AS variant_id,
               it.transaction_type, it.quantity, it.unit_cost, it.total_cost,
               it.reference_type, it.reference_id, it.notes
        ${from} ${where}
        ORDER BY it.created_at DESC, it.id DESC
        ${paging}`,
    ]);

    const total = num(countRows[0]?.total);
    const meta: PagedMeta = filters.all
      ? { page: 1, pageSize: total, total }
      : { page, pageSize, total };
    return {
      report: 'inventory.movement',
      title: { vi: 'Xuất nhập tồn', en: 'Stock movement' },
      scope: scope.toJSON(),
      columns: [
        col('createdAt', 'Thời gian', 'Date', 'datetime'),
        col('location', 'Kho', 'Location'),
        col('sku', 'SKU', 'SKU'),
        col('name', 'Sản phẩm', 'Product'),
        col('type', 'Loại', 'Type'),
        col('quantity', 'Số lượng', 'Quantity', 'integer'),
        col('unitCost', 'Giá vốn', 'Unit cost', 'money'),
        col('referenceType', 'Chứng từ', 'Source'),
        col('referenceId', 'Mã chứng từ', 'Source id'),
      ],
      rows: rows.map((r) => ({
        id: r.id as string,
        createdAt: r.created_at as Date,
        locationId: r.location_id as string,
        location: r.location as string,
        productId: r.product_id as string | null,
        variantId: (r.variant_id as string | null) ?? null,
        sku: r.sku as string,
        name: r.name as string,
        type: r.transaction_type as string,
        quantity: num(r.quantity),
        unitCost: r.unit_cost == null ? null : num(r.unit_cost),
        totalCost: r.total_cost == null ? null : num(r.total_cost),
        referenceType: (r.reference_type as string | null) ?? null,
        referenceId: (r.reference_id as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
      })),
      meta: { ...meta },
    };
  }

  /** Products and variants at or below their reorder point, per location. */
  async lowStock(
    scope: ReportScope,
    filters: InventoryFilters = {},
  ): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT inv.location_id, sl.name AS location,
             p.id AS product_id, pv.id AS variant_id,
             COALESCE(pv.sku, p.sku) AS sku, COALESCE(pv.name, p.name) AS name,
             COALESCE(inv.quantity_on_hand, 0)::int AS quantity,
             COALESCE(p.reorder_point, 0)::int AS reorder_point,
             COALESCE(p.reorder_quantity, 0)::int AS reorder_quantity,
             (COALESCE(p.reorder_point, 0) - COALESCE(inv.quantity_on_hand, 0))::int AS shortfall
      FROM inventory inv
      JOIN stock_locations sl ON sl.id = inv.location_id
      LEFT JOIN product_variants pv ON pv.id = inv.product_variant_id
      LEFT JOIN products p ON p.id = COALESCE(inv.product_id, pv.product_id)
      WHERE COALESCE(inv.quantity_on_hand, 0) <= COALESCE(p.reorder_point, 0)
        AND COALESCE(p.is_active, true)
        ${uuidFilter(Prisma.sql`inv.location_id`, filters.locationId)}
      ORDER BY shortfall DESC, sl.name, COALESCE(pv.name, p.name)`;

    return {
      report: 'inventory.low-stock',
      title: { vi: 'Hàng sắp hết', en: 'Low stock' },
      scope: scope.toJSON(),
      columns: [
        col('location', 'Kho', 'Location'),
        col('sku', 'SKU', 'SKU'),
        col('name', 'Sản phẩm', 'Product'),
        col('quantity', 'Tồn kho', 'On hand', 'integer'),
        col('reorderPoint', 'Điểm đặt hàng', 'Reorder point', 'integer'),
        col('shortfall', 'Thiếu', 'Shortfall', 'integer'),
        col('reorderQuantity', 'SL đặt lại', 'Reorder quantity', 'integer'),
      ],
      rows: rows.map((r) => ({
        locationId: r.location_id as string,
        location: r.location as string,
        productId: r.product_id as string | null,
        variantId: (r.variant_id as string | null) ?? null,
        sku: r.sku as string,
        name: r.name as string,
        quantity: num(r.quantity),
        reorderPoint: num(r.reorder_point),
        shortfall: num(r.shortfall),
        reorderQuantity: num(r.reorder_quantity),
      })),
    };
  }

  /**
   * Units sold, cost of goods sold, average stock across locations and
   * turnover ratio per product. Units are aggregated before joining stock so
   * products held in several locations are not multiplied.
   */
  async turnover(scope: ReportScope): Promise<ReportResult> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH o AS (
        SELECT so.id FROM sales_orders so
        WHERE ${scope.inRange(ReportScope.orderDate('so'))}
          AND ${ReportScope.revenueStatus(Prisma.sql`so.status`)}
          ${scope.storeFilter(Prisma.sql`so.store_id`)}
      ),
      sold AS (
        SELECT soi.product_id, SUM(soi.quantity) AS units
        FROM sales_order_items soi JOIN o ON o.id = soi.sales_order_id
        WHERE soi.product_id IS NOT NULL
        GROUP BY soi.product_id
      ),
      cogs AS (
        SELECT COALESCE(it.product_id, pv.product_id) AS product_id,
               SUM(ABS(it.quantity) * COALESCE(it.unit_cost, pv.cost_price_override, p.cost_price, 0)) AS cogs
        FROM inventory_transactions it
        JOIN o ON o.id = it.reference_id AND it.reference_type = 'sales_order'
        LEFT JOIN product_variants pv ON pv.id = it.product_variant_id
        LEFT JOIN products p ON p.id = COALESCE(it.product_id, pv.product_id)
        WHERE it.transaction_type = 'SALE'
        GROUP BY COALESCE(it.product_id, pv.product_id)
      ),
      stock AS (
        SELECT COALESCE(inv.product_id, pv.product_id) AS product_id,
               AVG(inv.quantity_on_hand) AS avg_stock,
               SUM(inv.quantity_on_hand) AS total_stock
        FROM inventory inv LEFT JOIN product_variants pv ON pv.id = inv.product_variant_id
        GROUP BY COALESCE(inv.product_id, pv.product_id)
      )
      SELECT p.id, p.sku, p.name,
             sold.units::int AS units_sold,
             COALESCE(cogs.cogs, 0) AS cogs,
             COALESCE(stock.avg_stock, 0) AS avg_stock,
             COALESCE(stock.total_stock, 0)::int AS total_stock,
             CASE WHEN COALESCE(stock.avg_stock, 0) > 0 THEN sold.units / stock.avg_stock ELSE NULL END AS turnover_ratio
      FROM sold
      JOIN products p ON p.id = sold.product_id
      LEFT JOIN cogs ON cogs.product_id = p.id
      LEFT JOIN stock ON stock.product_id = p.id
      ORDER BY turnover_ratio DESC NULLS LAST, units_sold DESC`;

    return {
      report: 'inventory.turnover',
      title: { vi: 'Vòng quay tồn kho', en: 'Inventory turnover' },
      scope: scope.toJSON(),
      columns: [
        col('sku', 'SKU', 'SKU'),
        col('name', 'Sản phẩm', 'Product'),
        col('unitsSold', 'Đã bán', 'Units sold', 'integer'),
        col('cogs', 'Giá vốn hàng bán', 'COGS', 'money'),
        col('averageStock', 'Tồn TB/kho', 'Average stock', 'number'),
        col('totalStock', 'Tổng tồn', 'Total stock', 'integer'),
        col('turnoverRatio', 'Vòng quay', 'Turnover', 'number'),
      ],
      rows: rows.map((r) => ({
        productId: r.id as string,
        sku: r.sku as string,
        name: r.name as string,
        unitsSold: num(r.units_sold),
        cogs: num(r.cogs),
        averageStock: Math.round(num(r.avg_stock) * 100) / 100,
        totalStock: num(r.total_stock),
        turnoverRatio:
          r.turnover_ratio == null
            ? null
            : Math.round(num(r.turnover_ratio) * 100) / 100,
      })),
    };
  }
}
