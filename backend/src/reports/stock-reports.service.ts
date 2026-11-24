import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportScope } from './report-scope';
import { col, ReportResult } from './report-types';
import {
  DAY_MS,
  linesWithNet,
  num,
  round2,
  storeLocations,
} from './retail-net';

/** Signed stock effect of a movement, matching update_inventory_from_transaction. */
const DELTA = Prisma.raw(`CASE
  WHEN it.transaction_type IN ('RECEIVE', 'ADJUST', 'RETURN', 'TRANSFER_IN') THEN it.quantity
  WHEN it.transaction_type IN ('SALE', 'TRANSFER_OUT', 'WRITE_OFF') THEN -ABS(it.quantity)
  ELSE 0 END`);

const TYPE_LABELS: Record<string, string> = {
  RECEIVE: 'Nhập hàng',
  SALE: 'Bán hàng',
  RETURN: 'Khách trả',
  RETURN_DAMAGED: 'Khách trả (lỗi)',
  ADJUST: 'Điều chỉnh',
  TRANSFER_IN: 'Nhận chuyển kho',
  TRANSFER_OUT: 'Chuyển kho đi',
  TRANSFER_LOSS: 'Hao hụt chuyển kho',
  WRITE_OFF: 'Xuất huỷ',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optUuid = (column: Prisma.Sql, v?: string) =>
  v && UUID_RE.test(v) ? Prisma.sql`AND ${column} = ${v}::uuid` : Prisma.empty;

/** Inventory operations reports (reports-retail-suite D2). */
@Injectable()
export class StockReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every movement of one product (and its variants) with opening, running and closing balance. */
  async stockCard(
    scope: ReportScope,
    productId?: string,
    locationId?: string,
  ): Promise<ReportResult> {
    if (!productId || !UUID_RE.test(productId))
      throw new BadRequestException('Chọn sản phẩm (productId) để xem thẻ kho');
    const where = Prisma.sql`
      (it.product_id = ${productId}::uuid OR pv.product_id = ${productId}::uuid OR p.master_product_id = ${productId}::uuid)
      ${optUuid(Prisma.sql`it.location_id`, locationId)}
      ${storeLocations(scope, Prisma.sql`it.location_id`)}`;
    const from = Prisma.sql`
      FROM inventory_transactions it
      LEFT JOIN product_variants pv ON pv.id = it.product_variant_id
      LEFT JOIN products p ON p.id = COALESCE(it.product_id, pv.product_id)`;
    const [opening] = await this.prisma.$queryRaw<{ qty: number }[]>`
      SELECT COALESCE(SUM(${DELTA}), 0)::int AS qty ${from}
      WHERE ${where} AND it.created_at < ${scope.start}`;
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT it.id, it.created_at, it.transaction_type, it.quantity, (${DELTA})::int AS delta, it.unit_cost,
             it.reference_type, it.notes, sl.name AS location, COALESCE(pv.sku, p.sku) AS sku, pv.name AS variant,
             COALESCE(
               (SELECT order_number FROM sales_orders WHERE id = it.reference_id AND it.reference_type = 'sales_order'),
               (SELECT return_number FROM sales_returns WHERE id = it.reference_id AND it.reference_type = 'sales_return'),
               (SELECT transfer_number FROM transfer_orders WHERE id = it.reference_id AND it.reference_type = 'transfer_order'),
               (SELECT count_number FROM stock_counts WHERE id = it.reference_id AND it.reference_type = 'stock_count'),
               (SELECT write_off_number FROM stock_write_offs WHERE id = it.reference_id AND it.reference_type = 'stock_write_off'),
               (SELECT order_number FROM purchase_orders WHERE id = it.reference_id AND it.reference_type = 'purchase_order')
             ) AS document
      ${from} LEFT JOIN stock_locations sl ON sl.id = it.location_id
      WHERE ${where} AND ${scope.inRange(Prisma.sql`it.created_at`)}
      ORDER BY it.created_at, it.id`;
    let balance = opening?.qty ?? 0;
    const openingQty = balance;
    const rows = data.map((r) => {
      const delta = num(r.delta);
      balance += delta;
      return {
        date: (r.created_at as Date).toISOString(),
        document: r.document ?? '',
        type: TYPE_LABELS[r.transaction_type as string] ?? r.transaction_type,
        location: r.location ?? '',
        sku: r.sku,
        variant: r.variant ?? '',
        quantityIn: delta > 0 ? delta : 0,
        quantityOut: delta < 0 ? -delta : 0,
        // movements that do not change stock (damaged returns, transfer losses) are shown for the record
        recordOnly: delta === 0 ? Math.abs(num(r.quantity)) : 0,
        balance,
        unitCost: r.unit_cost == null ? null : num(r.unit_cost),
        note: r.notes ?? '',
      };
    });
    const product = await this.prisma.products.findFirst({
      where: { id: productId },
      select: { sku: true, name: true },
    });
    const quantityIn = rows.reduce((s, r) => s + r.quantityIn, 0);
    const quantityOut = rows.reduce((s, r) => s + r.quantityOut, 0);
    return {
      report: 'inventory.stock-card',
      title: { vi: 'Thẻ kho', en: 'Stock card' },
      scope: scope.toJSON(),
      columns: [
        col('date', 'Thời gian', 'Date', 'datetime'),
        col('document', 'Chứng từ', 'Document'),
        col('type', 'Loại', 'Type'),
        col('location', 'Kho', 'Location'),
        col('sku', 'SKU', 'SKU'),
        col('quantityIn', 'Nhập', 'In', 'integer'),
        col('quantityOut', 'Xuất', 'Out', 'integer'),
        col('recordOnly', 'Ghi nhận (không đổi tồn)', 'Record only', 'integer'),
        col('balance', 'Tồn', 'Balance', 'integer'),
        col('unitCost', 'Giá vốn', 'Unit cost', 'money'),
        col('note', 'Ghi chú', 'Note'),
      ],
      rows,
      totals: { quantityIn, quantityOut, balance },
      meta: {
        product,
        opening: openingQty,
        closing: openingQty + quantityIn - quantityOut,
      },
    };
  }

  /** Transfers shipped and not fully received: what is on the road, by transfer. */
  async inTransit(scope: ReportScope): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT t.transfer_number, t.status, t.shipped_date, fl.name AS from_loc, tl.name AS to_loc,
             COUNT(ti.id)::int AS lines,
             SUM(COALESCE(ti.quantity_shipped, 0) - COALESCE(ti.quantity_received, 0))::int AS quantity,
             SUM((COALESCE(ti.quantity_shipped, 0) - COALESCE(ti.quantity_received, 0)) * COALESCE(ti.unit_cost, 0)) AS value
      FROM transfer_orders t
      JOIN transfer_order_items ti ON ti.transfer_order_id = t.id
      LEFT JOIN stock_locations fl ON fl.id = t.from_location_id
      LEFT JOIN stock_locations tl ON tl.id = t.to_location_id
      WHERE t.status IN ('in_transit', 'partially_received')
        ${scope.storeId ? Prisma.sql`AND (TRUE ${storeLocations(scope, Prisma.sql`t.from_location_id`)} OR TRUE ${storeLocations(scope, Prisma.sql`t.to_location_id`)})` : Prisma.empty}
      GROUP BY t.id, fl.name, tl.name
      HAVING SUM(COALESCE(ti.quantity_shipped, 0) - COALESCE(ti.quantity_received, 0)) > 0
      ORDER BY t.shipped_date`;
    const now = Date.now();
    const rows = data.map((r) => ({
      transfer: r.transfer_number,
      status: r.status === 'in_transit' ? 'Đang chuyển' : 'Nhận một phần',
      from: r.from_loc,
      to: r.to_loc,
      shippedAt: (r.shipped_date as Date | null)?.toISOString() ?? null,
      daysOnRoad: r.shipped_date
        ? Math.floor((now - (r.shipped_date as Date).getTime()) / DAY_MS)
        : null,
      lines: num(r.lines),
      quantity: num(r.quantity),
      value: num(r.value),
    }));
    return {
      report: 'inventory.in-transit',
      title: { vi: 'Hàng đang chuyển', en: 'Stock in transit' },
      scope: scope.toJSON(),
      columns: [
        col('transfer', 'Phiếu chuyển', 'Transfer'),
        col('status', 'Trạng thái', 'Status'),
        col('from', 'Từ kho', 'From'),
        col('to', 'Đến kho', 'To'),
        col('shippedAt', 'Ngày xuất', 'Shipped', 'datetime'),
        col('daysOnRoad', 'Số ngày', 'Days', 'integer'),
        col('lines', 'Số dòng', 'Lines', 'integer'),
        col('quantity', 'SL đang chuyển', 'Quantity', 'integer'),
        col('value', 'Giá trị', 'Value', 'money'),
      ],
      rows,
      totals: {
        quantity: rows.reduce((s, r) => s + r.quantity, 0),
        value: rows.reduce((s, r) => s + r.value, 0),
      },
    };
  }

  /** Lines of stock counts completed in the period with a difference. */
  async countVariances(
    scope: ReportScope,
    locationId?: string,
  ): Promise<ReportResult> {
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT sc.count_number, sc.completed_at, sl.name AS location, COALESCE(pv.sku, p.sku) AS sku, p.name, pv.name AS variant,
             sci.system_at_count, sci.counted_quantity, sci.adjustment, COALESCE(sci.unit_cost, 0) AS unit_cost
      FROM stock_count_items sci
      JOIN stock_counts sc ON sc.id = sci.stock_count_id
      LEFT JOIN stock_locations sl ON sl.id = sc.location_id
      LEFT JOIN product_variants pv ON pv.id = sci.product_variant_id
      LEFT JOIN products p ON p.id = COALESCE(sci.product_id, pv.product_id)
      WHERE sc.status = 'completed' AND COALESCE(sci.adjustment, 0) <> 0
        AND ${scope.inRange(Prisma.sql`sc.completed_at`)}
        ${optUuid(Prisma.sql`sc.location_id`, locationId)} ${storeLocations(scope, Prisma.sql`sc.location_id`)}
      ORDER BY ABS(sci.adjustment * COALESCE(sci.unit_cost, 0)) DESC`;
    const rows = data.map((r) => {
      const adj = num(r.adjustment);
      return {
        count: r.count_number,
        completedAt: (r.completed_at as Date | null)?.toISOString() ?? null,
        location: r.location,
        sku: r.sku,
        name: r.variant
          ? `${r.name as string} - ${r.variant as string}`
          : r.name,
        system: num(r.system_at_count),
        counted: num(r.counted_quantity),
        difference: adj,
        unitCost: num(r.unit_cost),
        value: adj * num(r.unit_cost),
      };
    });
    const sumBy = (f: (r: (typeof rows)[number]) => number) =>
      rows.reduce((s, r) => s + f(r), 0);
    return {
      report: 'inventory.count-variances',
      title: { vi: 'Chênh lệch kiểm kho', en: 'Count variances' },
      scope: scope.toJSON(),
      columns: [
        col('count', 'Phiếu kiểm', 'Count'),
        col('completedAt', 'Hoàn thành', 'Completed', 'datetime'),
        col('location', 'Kho', 'Location'),
        col('sku', 'SKU', 'SKU'),
        col('name', 'Sản phẩm', 'Product'),
        col('system', 'Tồn hệ thống', 'System', 'integer'),
        col('counted', 'Thực tế', 'Counted', 'integer'),
        col('difference', 'Chênh lệch', 'Difference', 'integer'),
        col('unitCost', 'Giá vốn', 'Unit cost', 'money'),
        col('value', 'Giá trị lệch', 'Value', 'money'),
      ],
      rows,
      totals: {
        difference: sumBy((r) => r.difference),
        value: sumBy((r) => r.value),
      },
      meta: {
        surplusValue: sumBy((r) => Math.max(0, r.value)),
        shortageValue: sumBy((r) => Math.min(0, r.value)),
      },
    };
  }

  /**
   * On hand ÷ average daily sales in the period (base units). `type=dead`
   * lists items in stock with no sale in the period, by stock value.
   */
  async daysOfStock(
    scope: ReportScope,
    type?: string,
    limit = 200,
  ): Promise<ReportResult> {
    const dead = type === 'dead';
    const days = Math.max(
      1,
      Math.round(
        (scope.endExclusive.getTime() - scope.start.getTime()) / DAY_MS,
      ),
    );
    const data = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH l AS (${linesWithNet(scope)}),
      sold AS (
        SELECT product_id, product_variant_id, SUM(quantity * COALESCE(unit_factor, 1)) AS qty
        FROM l GROUP BY product_id, product_variant_id
      ),
      stock AS (
        SELECT inv.product_id, inv.product_variant_id, SUM(inv.quantity_on_hand) AS on_hand,
               SUM(inv.quantity_reserved) AS reserved
        FROM inventory inv WHERE TRUE ${storeLocations(scope, Prisma.sql`inv.location_id`)}
        GROUP BY inv.product_id, inv.product_variant_id
        HAVING SUM(inv.quantity_on_hand) > 0
      )
      SELECT COALESCE(pv.sku, p.sku) AS sku, p.name, pv.name AS variant,
             stock.on_hand::int AS on_hand, COALESCE(stock.reserved, 0)::int AS reserved,
             COALESCE(sold.qty, 0)::int AS sold,
             stock.on_hand * COALESCE(pv.cost_price_override, p.cost_price, 0) AS stock_value
      FROM stock
      JOIN products p ON p.id = stock.product_id
      LEFT JOIN product_variants pv ON pv.id = stock.product_variant_id
      LEFT JOIN sold ON sold.product_id = stock.product_id AND sold.product_variant_id IS NOT DISTINCT FROM stock.product_variant_id
      WHERE p.is_active ${dead ? Prisma.sql`AND COALESCE(sold.qty, 0) = 0` : Prisma.sql`AND COALESCE(sold.qty, 0) > 0`}
      ORDER BY ${dead ? Prisma.sql`stock_value DESC` : Prisma.sql`stock.on_hand / sold.qty DESC`}
      LIMIT ${limit}`;
    const rows = data.map((r) => {
      const sold = num(r.sold);
      const perDay = sold / days;
      return {
        sku: r.sku,
        name: r.variant
          ? `${r.name as string} - ${r.variant as string}`
          : r.name,
        onHand: num(r.on_hand),
        reserved: num(r.reserved),
        sold,
        perDay: round2(perDay),
        daysOfStock: perDay > 0 ? Math.round(num(r.on_hand) / perDay) : null,
        stockValue: Math.round(num(r.stock_value)),
      };
    });
    return {
      report: 'inventory.days-of-stock',
      title: dead
        ? { vi: 'Hàng tồn không bán được', en: 'Dead stock' }
        : { vi: 'Số ngày tồn kho', en: 'Days of stock' },
      scope: scope.toJSON(),
      columns: [
        col('sku', 'SKU', 'SKU'),
        col('name', 'Sản phẩm', 'Product'),
        col('onHand', 'Tồn', 'On hand', 'integer'),
        col('reserved', 'Đang giữ', 'Reserved', 'integer'),
        ...(dead
          ? []
          : [
              col('sold', 'Đã bán', 'Sold', 'integer'),
              col('perDay', 'Bán TB/ngày', 'Per day', 'number'),
              col('daysOfStock', 'Số ngày tồn', 'Days of stock', 'integer'),
            ]),
        col('stockValue', 'Giá trị tồn', 'Stock value', 'money'),
      ],
      rows,
      totals: {
        onHand: rows.reduce((s, r) => s + r.onHand, 0),
        stockValue: rows.reduce((s, r) => s + r.stockValue, 0),
      },
      meta: { days },
    };
  }
}
