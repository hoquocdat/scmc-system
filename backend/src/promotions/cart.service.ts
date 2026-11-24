import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesPostingService } from '../sales/sales-posting.service';
import { CartDto } from './dto/promotions.dto';

/** The full discount breakdown of a cart, as checkout will compute it (design D8). */
@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: SalesPostingService,
  ) {}

  async price(dto: CartDto) {
    const totals = await this.posting.computeTotals(
      this.prisma as unknown as Prisma.TransactionClient,
      {
        channel: dto.channel ?? 'pos',
        status: 'draft',
        store_id: dto.store_id,
        customer_id: dto.customer_id ?? null,
        price_book_id: dto.price_book_id ?? null,
        discount_type: dto.discount_type ?? 'fixed',
        discount_value: dto.discount_value ?? 0,
        points_to_redeem: dto.points_to_redeem ?? 0,
        voucher_code: dto.voucher_code ?? null,
        lines: dto.lines.map((l) => ({
          product_id: l.product_id,
          product_variant_id: l.product_variant_id ?? null,
          quantity: l.quantity,
          discount_amount: l.discount_amount ?? 0,
        })),
      },
      dto.customer_id ?? null,
      { voucherReport: true },
    );
    return SalesPostingService.breakdown(totals);
  }
}
