import { Prisma } from '@prisma/client';
import { ReportScope } from './report-scope';

/**
 * Orders in scope with their net value (reports-retail-suite D1):
 * gross − line discounts − line promotions − order discount − order promotion
 * − voucher − loyalty. Columns: id, store_id, created_by, channel, customer_id,
 * od (order date), gross, line_disc, line_promo, order_disc, order_promo,
 * voucher, loyalty, net.
 */
export function ordersWithNet(scope: ReportScope): Prisma.Sql {
  return Prisma.sql`
    SELECT so.id, so.store_id, so.created_by, so.channel, so.customer_id,
           ${ReportScope.orderDate('so')} AS od,
           COALESCE(l.gross, 0) AS gross,
           COALESCE(l.line_disc, 0) AS line_disc,
           COALESCE(l.line_promo, 0) AS line_promo,
           COALESCE(so.discount_amount, 0) AS order_disc,
           COALESCE(so.promotion_discount_amount, 0) AS order_promo,
           COALESCE(so.voucher_discount_amount, 0) AS voucher,
           COALESCE(so.loyalty_discount_amount, 0) AS loyalty,
           COALESCE(l.gross, 0) - COALESCE(l.line_disc, 0) - COALESCE(l.line_promo, 0)
             - COALESCE(so.discount_amount, 0) - COALESCE(so.promotion_discount_amount, 0)
             - COALESCE(so.voucher_discount_amount, 0) - COALESCE(so.loyalty_discount_amount, 0) AS net
    FROM sales_orders so
    LEFT JOIN (
      SELECT sales_order_id,
             SUM(unit_price * quantity) AS gross,
             SUM(COALESCE(discount_amount, 0) * quantity) AS line_disc,
             SUM(COALESCE(promotion_discount, 0)) AS line_promo
      FROM sales_order_items GROUP BY sales_order_id
    ) l ON l.sales_order_id = so.id
    WHERE ${ReportScope.revenueStatus(Prisma.sql`so.status`)}
      AND ${scope.inRange(ReportScope.orderDate('so'))}
      ${scope.storeFilter(Prisma.sql`so.store_id`)}`;
}

/** Net value of each order line: line value minus its promotion and its share of order-level reductions. */
export function linesWithNet(scope: ReportScope): Prisma.Sql {
  return Prisma.sql`
    SELECT soi.id, soi.sales_order_id, soi.product_id, soi.product_variant_id, soi.quantity, soi.unit_factor,
           o.store_id, o.created_by, o.od,
           (soi.unit_price - COALESCE(soi.discount_amount, 0)) * soi.quantity - COALESCE(soi.promotion_discount, 0) AS line_value,
           CASE WHEN (o.gross - o.line_disc - o.line_promo) > 0
                THEN ((soi.unit_price - COALESCE(soi.discount_amount, 0)) * soi.quantity - COALESCE(soi.promotion_discount, 0))
                     * o.net / (o.gross - o.line_disc - o.line_promo)
                ELSE 0 END AS net
    FROM sales_order_items soi JOIN (${ordersWithNet(scope)}) o ON o.id = soi.sales_order_id`;
}

export { num } from './report-types';
export const DAY_MS = 86_400_000;
export const round2 = (v: number) => Math.round(v * 100) / 100;

/** `AND column IN (the selected branch's warehouse)` when a branch is selected. */
export function storeLocations(
  scope: ReportScope,
  column: Prisma.Sql,
): Prisma.Sql {
  return scope.storeId
    ? Prisma.sql`AND ${column} IN (SELECT default_warehouse_id FROM stores WHERE id = ${scope.storeId}::uuid)`
    : Prisma.empty;
}

/**
 * Retail cost of goods sold (D1): cost of SALE movements of orders in scope
 * minus the cost of restocked RETURN movements of sales returns made in the
 * period. Damaged returns stay in COGS. A movement without a recorded cost
 * falls back to the current product cost.
 */
export function retailCogs(scope: ReportScope): Prisma.Sql {
  const cost = Prisma.raw(
    'ABS(it.quantity) * COALESCE(it.unit_cost, pv.cost_price_override, p.cost_price, 0)',
  );
  return Prisma.sql`
    SELECT
      COALESCE((SELECT SUM(${cost})
        FROM inventory_transactions it
        JOIN (${ordersWithNet(scope)}) o ON o.id = it.reference_id AND it.reference_type = 'sales_order'
        LEFT JOIN product_variants pv ON pv.id = it.product_variant_id
        LEFT JOIN products p ON p.id = COALESCE(it.product_id, pv.product_id)
        WHERE it.transaction_type = 'SALE'), 0) AS sold,
      COALESCE((SELECT SUM(${cost})
        FROM inventory_transactions it
        JOIN sales_returns sr ON sr.id = it.reference_id AND it.reference_type = 'sales_return'
        LEFT JOIN product_variants pv ON pv.id = it.product_variant_id
        LEFT JOIN products p ON p.id = COALESCE(it.product_id, pv.product_id)
        WHERE it.transaction_type = 'RETURN'
          AND ${scope.inRange(Prisma.sql`sr.created_at`)} ${scope.storeFilter(Prisma.sql`sr.store_id`)}), 0) AS restocked`;
}
