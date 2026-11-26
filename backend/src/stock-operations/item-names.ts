import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StockItem } from '../inventory/stock-helpers';

type Db = Prisma.TransactionClient;

export interface ItemInfo extends StockItem {
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  cost: number;
}

/** A request line → the stock row identity (variant XOR product). */
export function stockItemOf(l: {
  product_id?: string | null;
  product_variant_id?: string | null;
}): StockItem {
  if (l.product_variant_id)
    return { productId: null, variantId: l.product_variant_id };
  if (l.product_id) return { productId: l.product_id, variantId: null };
  throw new BadRequestException('Mỗi dòng cần sản phẩm hoặc biến thể');
}

export const keyOf = (i: StockItem) =>
  `${i.productId ?? ''}:${i.variantId ?? ''}`;

/** Names, SKUs, barcodes, price and cost of stock items. */
export async function describeItems(
  db: Db,
  items: StockItem[],
): Promise<Map<string, ItemInfo>> {
  const productIds = [
    ...new Set(items.filter((i) => !i.variantId).map((i) => i.productId)),
  ];
  const variantIds = [
    ...new Set(items.filter((i) => i.variantId).map((i) => i.variantId)),
  ];
  const products = productIds.length
    ? await db.products.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          retail_price: true,
          cost_price: true,
        },
      })
    : [];
  const variants = variantIds.length
    ? await db.product_variants.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          price_adjustment: true,
          retail_price_override: true,
          cost_price_override: true,
          products: {
            select: { name: true, retail_price: true, cost_price: true },
          },
        },
      })
    : [];
  const out = new Map<string, ItemInfo>();
  for (const p of products) {
    const i = { productId: p.id, variantId: null };
    out.set(keyOf(i), {
      ...i,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      price: Number(p.retail_price),
      cost: Number(p.cost_price ?? 0),
    });
  }
  for (const v of variants) {
    const i = { productId: null, variantId: v.id };
    out.set(keyOf(i), {
      ...i,
      name: `${v.products.name} / ${v.name}`,
      sku: v.sku,
      barcode: v.barcode,
      price:
        v.retail_price_override != null
          ? Number(v.retail_price_override)
          : Number(v.products.retail_price) + Number(v.price_adjustment ?? 0),
      cost: Number(v.cost_price_override ?? v.products.cost_price ?? 0),
    });
  }
  for (const i of items)
    if (!out.has(keyOf(i)))
      throw new NotFoundException('Không tìm thấy sản phẩm');
  return out;
}

/** Variant first, then product row, for inventory_transactions. */
export const movementItem = (i: StockItem) => ({
  product_id: i.variantId ? null : i.productId,
  product_variant_id: i.variantId,
});
