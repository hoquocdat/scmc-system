import { Prisma } from '@prisma/client';
import {
  InsufficientStockException,
  StockShortage,
} from '../sales/sales.errors';

type Tx = Prisma.TransactionClient;

/** One stock row identity: a variant, or a product without variant (inventory stores exactly one). */
export interface StockItem {
  productId: string | null;
  variantId: string | null;
}

const VN_PERIOD = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: '2-digit',
  month: '2-digit',
});

/** `PREFIX-YYMM-#####` from the document counters (never reused). */
export async function nextDocumentNumber(
  tx: Tx,
  prefix: string,
  at: Date = new Date(),
): Promise<string> {
  const period = VN_PERIOD.format(at).replace(/\D/g, '');
  const rows = await tx.$queryRaw<
    { n: number }[]
  >`SELECT next_document_number(${prefix}, ${period}) AS n`;
  return `${prefix}-${period}-${String(rows[0].n).padStart(5, '0')}`;
}

const rowWhere = (locationId: string, i: StockItem) =>
  i.variantId
    ? Prisma.sql`location_id = ${locationId}::uuid AND product_variant_id = ${i.variantId}::uuid`
    : Prisma.sql`location_id = ${locationId}::uuid AND product_id = ${i.productId}::uuid AND product_variant_id IS NULL`;

/** Creates the stock row at 0 when missing (the stock trigger only updates rows). */
export async function ensureStockRow(
  tx: Tx,
  locationId: string,
  i: StockItem,
): Promise<void> {
  const existing = await tx.inventory.findFirst({
    where: i.variantId
      ? { location_id: locationId, product_variant_id: i.variantId }
      : {
          location_id: locationId,
          product_id: i.productId,
          product_variant_id: null,
        },
    select: { id: true },
  });
  if (!existing) {
    await tx.inventory.create({
      data: {
        location_id: locationId,
        product_id: i.variantId ? null : i.productId,
        product_variant_id: i.variantId,
        quantity_on_hand: 0,
      },
    });
  }
}

export interface LockedStock {
  onHand: number;
  reserved: number;
  available: number;
}

/** Locks the row (FOR UPDATE) and returns on hand, reserved and available. */
export async function lockStock(
  tx: Tx,
  locationId: string,
  i: StockItem,
): Promise<LockedStock> {
  const rows = await tx.$queryRaw<
    { quantity_on_hand: number | null; quantity_reserved: number | null }[]
  >`
    SELECT quantity_on_hand, quantity_reserved FROM inventory WHERE ${rowWhere(locationId, i)} FOR UPDATE`;
  const onHand = rows.reduce((s, r) => s + Number(r.quantity_on_hand ?? 0), 0);
  const reserved = rows.reduce(
    (s, r) => s + Number(r.quantity_reserved ?? 0),
    0,
  );
  return { onHand, reserved, available: onHand - reserved };
}

export interface StockNeed extends StockItem {
  quantity: number;
  name: string;
  sku: string;
}

/**
 * Locks every row in a stable order and refuses with INSUFFICIENT_STOCK when
 * a need exceeds available stock (on hand − reserved).
 */
export async function assertAvailable(
  tx: Tx,
  locationId: string,
  needs: StockNeed[],
): Promise<void> {
  const sorted = [...needs].sort((a, b) =>
    `${a.productId}:${a.variantId}`.localeCompare(
      `${b.productId}:${b.variantId}`,
    ),
  );
  const shortages: StockShortage[] = [];
  for (const n of sorted) {
    const s = await lockStock(tx, locationId, n);
    if (s.available < n.quantity)
      shortages.push({
        product_id: n.productId ?? '',
        product_variant_id: n.variantId,
        sku: n.sku,
        name: n.name,
        requested: n.quantity,
        available: Math.max(0, s.available),
      });
  }
  if (shortages.length) throw new InsufficientStockException(shortages);
}

/** Current unit cost: the variant's own cost, else the product's. */
export async function currentCost(tx: Tx, i: StockItem): Promise<number> {
  if (i.variantId) {
    const v = await tx.product_variants.findFirst({
      where: { id: i.variantId },
      select: {
        cost_price_override: true,
        products: { select: { cost_price: true } },
      },
    });
    return Number(v?.cost_price_override ?? v?.products.cost_price ?? 0);
  }
  const p = await tx.products.findFirst({
    where: { id: i.productId },
    select: { cost_price: true },
  });
  return Number(p?.cost_price ?? 0);
}

/**
 * Recomputes `quantity_reserved` of the given rows from pending sales orders
 * at that location (inventory-operations D7). Idempotent.
 */
export async function recomputeReserved(
  tx: Tx,
  locationId: string,
  items: StockItem[],
): Promise<void> {
  for (const i of items) {
    await ensureStockRow(tx, locationId, i);
    await tx.$executeRaw`
      UPDATE inventory inv SET quantity_reserved = COALESCE((
        SELECT SUM(soi.quantity * soi.unit_factor)
        FROM sales_order_items soi JOIN sales_orders so ON so.id = soi.sales_order_id
        WHERE so.status = 'pending'
          AND COALESCE(so.location_id, (SELECT st.default_warehouse_id FROM stores st WHERE st.id = so.store_id)) = inv.location_id
          AND ${i.variantId ? Prisma.sql`soi.product_variant_id = ${i.variantId}::uuid` : Prisma.sql`soi.product_id = ${i.productId}::uuid AND soi.product_variant_id IS NULL`}
      ), 0), updated_at = now()
      WHERE ${rowWhere(locationId, i)}`;
  }
}

/** Reservation refresh for every line of an order. */
export async function recomputeOrderReservations(
  tx: Tx,
  orderId: string,
): Promise<void> {
  const order = await tx.sales_orders.findFirst({
    where: { id: orderId },
    select: {
      location_id: true,
      stores: { select: { default_warehouse_id: true } },
      sales_order_items: {
        select: { product_id: true, product_variant_id: true },
      },
    },
  });
  const locationId = order?.location_id ?? order?.stores?.default_warehouse_id;
  if (!order || !locationId) return;
  const seen = new Set<string>();
  const items: StockItem[] = [];
  for (const l of order.sales_order_items) {
    const key = `${l.product_id}:${l.product_variant_id}`;
    if (seen.has(key) || (!l.product_id && !l.product_variant_id)) continue;
    seen.add(key);
    items.push({
      productId: l.product_variant_id ? null : l.product_id,
      variantId: l.product_variant_id,
    });
  }
  await recomputeReserved(tx, locationId, items);
}
