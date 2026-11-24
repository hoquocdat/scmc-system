import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { bookChoosable } from '../sales/pricing/price-book-rule';
import { PriceResolverService } from '../sales/pricing/price-resolver';
import { ApplicableBooksQueryDto, QuoteDto } from './dto/price-books.dto';

/** Price quotes and applicable books for the POS cart and sales-order form (design D5). */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: PriceResolverService,
  ) {}

  async quote(dto: QuoteDto) {
    const resolved = await this.prices.resolveMany(dto.items, {
      storeId: dto.store_id,
      customerId: dto.customer_id ?? null,
      priceBookId: dto.price_book_id ?? null,
    });
    return {
      items: dto.items.map((item) => {
        const r = resolved.get(PriceResolverService.key(item));
        return {
          product_id: r.productId,
          product_variant_id: r.variantId,
          unit_price: r.unitPrice,
          base_price: r.basePrice,
          price_book_id: r.priceBookId,
          price_book_name: r.priceBookName,
          source: r.source,
        };
      }),
    };
  }

  /** Books applying automatically to this branch and customer, and the ones staff may choose. */
  async applicableBooks(q: ApplicableBooksQueryDto) {
    const at = new Date();
    const [automatic, all] = await Promise.all([
      this.prices.books(
        this.prisma,
        { storeId: q.store_id, customerId: q.customer_id ?? null },
        at,
      ),
      this.prisma.price_books.findMany({
        where: {
          is_active: true,
          allow_manual: true,
          AND: [
            { OR: [{ start_at: null }, { start_at: { lte: at } }] },
            { OR: [{ end_at: null }, { end_at: { gte: at } }] },
          ],
        },
        include: { price_book_stores: { select: { store_id: true } } },
        orderBy: [{ priority: 'desc' }, { code: 'asc' }],
      }),
    ]);
    const shape = (b: {
      id: string;
      code: string;
      name: string;
      priority: number;
    }) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      priority: b.priority,
    });
    return {
      automatic: automatic.map(shape),
      choosable: all
        .filter((b) =>
          bookChoosable(
            {
              ...b,
              store_ids: b.price_book_stores.map((s) => s.store_id),
              group_ids: [],
              entries: [],
            },
            { at, storeId: q.store_id },
          ),
        )
        .map(shape),
    };
  }
}
