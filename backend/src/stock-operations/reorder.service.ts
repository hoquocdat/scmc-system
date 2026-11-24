import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { ReorderPoDto } from './dto/stock-operations.dto';
import { describeItems, keyOf, stockItemOf } from './item-names';

export interface ReorderAlert {
  location_id: string;
  location_name: string;
  product_id: string | null;
  product_variant_id: string | null;
  name: string;
  sku: string;
  on_hand: number;
  reserved: number;
  available: number;
  threshold: number;
  suggested: number;
  supplier_id: string | null;
  unit_cost: number;
}

/** Low stock per location and draft purchase orders from it (design D6). */
@Injectable()
export class ReorderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseOrders: PurchaseOrdersService,
  ) {}

  async alerts(locationId?: string): Promise<ReorderAlert[]> {
    const rows = await this.prisma.$queryRaw<
      {
        location_id: string;
        location_name: string;
        product_id: string | null;
        product_variant_id: string | null;
        name: string;
        sku: string;
        on_hand: number;
        reserved: number;
        threshold: number;
        reorder_quantity: number;
        supplier_id: string | null;
        unit_cost: Prisma.Decimal | null;
      }[]
    >`
      SELECT i.location_id, sl.name AS location_name, i.product_id, i.product_variant_id,
             COALESCE(p.name || ' / ' || pv.name, p.name, pp.name) AS name,
             COALESCE(pv.sku, pp.sku) AS sku,
             COALESCE(i.quantity_on_hand, 0) AS on_hand, COALESCE(i.quantity_reserved, 0) AS reserved,
             GREATEST(COALESCE(base.reorder_point, 0), COALESCE(i.safety_stock, 0)) AS threshold,
             COALESCE(base.reorder_quantity, 0) AS reorder_quantity,
             base.supplier_id,
             COALESCE(pv.cost_price_override, base.cost_price) AS unit_cost
      FROM inventory i
      JOIN stock_locations sl ON sl.id = i.location_id
      LEFT JOIN products pp ON pp.id = i.product_id
      LEFT JOIN product_variants pv ON pv.id = i.product_variant_id
      LEFT JOIN products p ON p.id = pv.product_id
      JOIN products base ON base.id = COALESCE(i.product_id, pv.product_id)
      WHERE base.is_active IS NOT FALSE
        AND (pv.id IS NULL OR pv.is_active IS NOT FALSE)
        ${locationId ? Prisma.sql`AND i.location_id = ${locationId}::uuid` : Prisma.empty}
        AND GREATEST(COALESCE(base.reorder_point, 0), COALESCE(i.safety_stock, 0)) > 0
        AND COALESCE(i.quantity_on_hand, 0) - COALESCE(i.quantity_reserved, 0)
            <= GREATEST(COALESCE(base.reorder_point, 0), COALESCE(i.safety_stock, 0))
      ORDER BY sl.name, (COALESCE(i.quantity_on_hand, 0) - COALESCE(i.quantity_reserved, 0)) ASC, name`;
    return rows.map((r) => {
      const available = Number(r.on_hand) - Number(r.reserved);
      const threshold = Number(r.threshold);
      const rq = Number(r.reorder_quantity);
      return {
        location_id: r.location_id,
        location_name: r.location_name,
        product_id: r.product_id,
        product_variant_id: r.product_variant_id,
        name: r.name,
        sku: r.sku,
        on_hand: Number(r.on_hand),
        reserved: Number(r.reserved),
        available,
        threshold,
        suggested: rq > 0 ? rq : Math.max(1, 2 * threshold - available),
        supplier_id: r.supplier_id,
        unit_cost: Number(r.unit_cost ?? 0),
      };
    });
  }

  async counts() {
    const all = await this.alerts();
    const by = new Map<
      string,
      { location_id: string; location_name: string; count: number }
    >();
    for (const a of all) {
      const cur = by.get(a.location_id) ?? {
        location_id: a.location_id,
        location_name: a.location_name,
        count: 0,
      };
      cur.count += 1;
      by.set(a.location_id, cur);
    }
    return { total: all.length, locations: [...by.values()] };
  }

  /** A draft purchase order with the chosen low items at their given quantities. */
  async draftPurchaseOrder(userId: string, dto: ReorderPoDto) {
    const items = dto.items.map((l) => ({
      stock: stockItemOf(l),
      quantity: l.quantity,
    }));
    if (!items.length)
      throw new BadRequestException('Chọn ít nhất một mặt hàng');
    const info = await describeItems(
      this.prisma as unknown as Prisma.TransactionClient,
      items.map((i) => i.stock),
    );
    return this.purchaseOrders.create(
      {
        supplier_id: dto.supplier_id,
        notes: dto.notes ?? 'Tạo từ cảnh báo tồn kho thấp',
        items: items.map((i) => {
          const d = info.get(keyOf(i.stock));
          return {
            product_id: i.stock.variantId ? undefined : i.stock.productId,
            product_variant_id: i.stock.variantId ?? undefined,
            product_name: d.name,
            product_sku: d.sku,
            quantity_ordered: i.quantity,
            unit_cost: d.cost,
          };
        }),
      } as never,
      userId,
    );
  }
}
