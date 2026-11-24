import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  bookApplies,
  bookChoosable,
  PriceBookMode,
  PriceBookRule,
  priceFromBooks,
} from './price-book-rule';

/** The product fields pricing depends on. */
export interface PricedProduct {
  id: string;
  name: string;
  sku: string;
  retail_price: Prisma.Decimal | number;
  cost_price?: Prisma.Decimal | number | null;
  sale_price?: Prisma.Decimal | number | null;
  sale_price_start_date?: Date | null;
  sale_price_end_date?: Date | null;
  is_active?: boolean | null;
}

/** The variant fields pricing depends on. */
export interface PricedVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price_adjustment?: Prisma.Decimal | number | null;
  retail_price_override?: Prisma.Decimal | number | null;
  cost_price_override?: Prisma.Decimal | number | null;
  is_active?: boolean | null;
}

export interface ResolvedPrice {
  productId: string;
  variantId: string | null;
  name: string;
  sku: string;
  /** Selling price per unit right now. */
  unitPrice: number;
  /** Cost per unit right now (recorded on the stock movement). */
  unitCost: number;
  /** Where the price came from. */
  source:
    | 'retail'
    | 'sale'
    | 'variant_override'
    | 'variant_adjusted'
    | 'variant_sale_adjusted'
    | 'price_book';
  /** Price before any price book (design D2). */
  basePrice: number;
  /** Price book that priced the line; null = base price. */
  priceBookId: string | null;
  priceBookName: string | null;
}

/** Context of a sale for price books (design D3). */
export interface PriceContext {
  at?: Date;
  storeId?: string | null;
  customerId?: string | null;
  /** Manually chosen price book; absent = automatic. */
  priceBookId?: string | null;
}

export class PriceBookNotApplicableException extends UnprocessableEntityException {
  constructor(name?: string) {
    super({
      code: 'PRICE_BOOK_NOT_APPLICABLE',
      message: name
        ? `Bảng giá "${name}" không áp dụng được cho giao dịch này`
        : 'Không tìm thấy bảng giá',
    });
  }
}

const num = (v: Prisma.Decimal | number | null | undefined): number =>
  v == null ? 0 : Number(v);

/**
 * Pure pricing rule (design D5). Replaced by price books later behind the
 * same interface:
 *   - variant retail_price_override when set;
 *   - else base = product sale_price while now is inside its date window, else retail_price;
 *     variants add price_adjustment to that base.
 */
export function resolvePrice(
  product: PricedProduct,
  variant: PricedVariant | null,
  at: Date = new Date(),
): ResolvedPrice {
  const r = baseRule(product, variant, at);
  return {
    ...r,
    basePrice: r.unitPrice,
    priceBookId: null,
    priceBookName: null,
  };
}

type BasePrice = Omit<
  ResolvedPrice,
  'basePrice' | 'priceBookId' | 'priceBookName'
>;

function baseRule(
  product: PricedProduct,
  variant: PricedVariant | null,
  at: Date,
): BasePrice {
  const saleActive =
    product.sale_price != null &&
    (product.sale_price_start_date == null ||
      product.sale_price_start_date <= at) &&
    (product.sale_price_end_date == null || product.sale_price_end_date >= at);
  const base = saleActive ? num(product.sale_price) : num(product.retail_price);

  if (variant) {
    const unitCost =
      variant.cost_price_override != null
        ? num(variant.cost_price_override)
        : num(product.cost_price);
    if (variant.retail_price_override != null) {
      return {
        productId: product.id,
        variantId: variant.id,
        name: variant.name,
        sku: variant.sku,
        unitPrice: num(variant.retail_price_override),
        unitCost,
        source: 'variant_override',
      };
    }
    return {
      productId: product.id,
      variantId: variant.id,
      name: variant.name,
      sku: variant.sku,
      unitPrice: base + num(variant.price_adjustment),
      unitCost,
      source: saleActive ? 'variant_sale_adjusted' : 'variant_adjusted',
    };
  }

  return {
    productId: product.id,
    variantId: null,
    name: product.name,
    sku: product.sku,
    unitPrice: base,
    unitCost: num(product.cost_price),
    source: saleActive ? 'sale' : 'retail',
  };
}

export interface PriceRequest {
  product_id: string;
  product_variant_id?: string | null;
}

/**
 * Loads products, variants and price books and applies the base rule then the
 * price book rule; usable inside a transaction. Uses findMany/findFirst only
 * (no findUnique batching inside interactive transactions).
 */
@Injectable()
export class PriceResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveMany(
    requests: PriceRequest[],
    context: Date | PriceContext = {},
    tx?: Prisma.TransactionClient,
  ): Promise<Map<string, ResolvedPrice>> {
    const db = tx ?? this.prisma;
    const ctx: PriceContext =
      context instanceof Date ? { at: context } : context;
    const at = ctx.at ?? new Date();
    const productIds = [...new Set(requests.map((r) => r.product_id))];
    const variantIds = [
      ...new Set(
        requests
          .map((r) => r.product_variant_id)
          .filter((v): v is string => !!v),
      ),
    ];

    const [products, variants, books] = await Promise.all([
      db.products.findMany({ where: { id: { in: productIds } } }),
      variantIds.length
        ? db.product_variants.findMany({ where: { id: { in: variantIds } } })
        : Promise.resolve([] as PricedVariant[]),
      productIds.length
        ? this.books(db, ctx, at, productIds)
        : Promise.resolve([] as PriceBookRule[]),
    ]);
    const productById = new Map(products.map((p) => [p.id, p]));
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const out = new Map<string, ResolvedPrice>();
    for (const r of requests) {
      const product = productById.get(r.product_id);
      if (!product)
        throw new NotFoundException(`Product ${r.product_id} not found`);
      if (product.is_active === false)
        throw new NotFoundException(`Product ${product.sku} is inactive`);
      let variant: PricedVariant | null = null;
      if (r.product_variant_id) {
        variant = variantById.get(r.product_variant_id) ?? null;
        if (!variant)
          throw new NotFoundException(
            `Variant ${r.product_variant_id} not found`,
          );
        if (variant.product_id !== product.id)
          throw new NotFoundException(
            `Variant ${variant.sku} does not belong to product ${product.sku}`,
          );
        if (variant.is_active === false)
          throw new NotFoundException(`Variant ${variant.sku} is inactive`);
      }
      const base = resolvePrice(product, variant, at);
      const fromBook = priceFromBooks(
        books,
        base.unitPrice,
        product.id,
        variant?.id ?? null,
      );
      out.set(
        PriceResolverService.key(r),
        fromBook
          ? {
              ...base,
              unitPrice: fromBook.unitPrice,
              source: 'price_book',
              priceBookId: fromBook.book.id,
              priceBookName: fromBook.book.name,
            }
          : base,
      );
    }
    return out;
  }

  /**
   * Price books that apply to this sale: the chosen one (validated, customer
   * condition waived) or every automatically applicable one. Entries are
   * loaded for the requested products only.
   */
  async books(
    db: Prisma.TransactionClient | PrismaService,
    ctx: PriceContext,
    at: Date,
    productIds?: string[],
  ): Promise<PriceBookRule[]> {
    const rows = await db.price_books.findMany({
      where: {
        is_active: true,
        ...(ctx.priceBookId ? { id: ctx.priceBookId } : {}),
        AND: [
          { OR: [{ start_at: null }, { start_at: { lte: at } }] },
          { OR: [{ end_at: null }, { end_at: { gte: at } }] },
        ],
      },
      include: {
        price_book_stores: { select: { store_id: true } },
        price_book_customer_groups: {
          select: {
            group_id: true,
            customer_groups: { select: { is_active: true } },
          },
        },
        price_book_entries: productIds
          ? { where: { product_id: { in: productIds } } }
          : { take: 0 },
      },
    });
    const books: PriceBookRule[] = rows.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      priority: b.priority,
      is_active: b.is_active,
      start_at: b.start_at,
      end_at: b.end_at,
      all_stores: b.all_stores,
      all_customers: b.all_customers,
      allow_manual: b.allow_manual,
      store_ids: b.price_book_stores.map((s) => s.store_id),
      group_ids: b.price_book_customer_groups
        .filter((g) => g.customer_groups.is_active)
        .map((g) => g.group_id),
      entries: b.price_book_entries.map((e) => ({
        product_id: e.product_id,
        product_variant_id: e.product_variant_id,
        mode: e.mode as PriceBookMode,
        value: Number(e.value),
      })),
    }));

    if (ctx.priceBookId) {
      const chosen = books[0];
      if (!chosen || !bookChoosable(chosen, { at, storeId: ctx.storeId })) {
        const any = await db.price_books.findFirst({
          where: { id: ctx.priceBookId },
          select: { name: true },
        });
        throw new PriceBookNotApplicableException(any?.name);
      }
      return [chosen];
    }

    const customerGroupIds = ctx.customerId
      ? (
          await db.customer_group_members.findMany({
            where: {
              customer_id: ctx.customerId,
              customer_groups: { is_active: true },
            },
            select: { group_id: true },
          })
        ).map((m) => m.group_id)
      : [];
    return books.filter((b) =>
      bookApplies(b, { at, storeId: ctx.storeId, customerGroupIds }),
    );
  }

  static key(r: PriceRequest): string {
    return `${r.product_id}:${r.product_variant_id ?? ''}`;
  }
}
