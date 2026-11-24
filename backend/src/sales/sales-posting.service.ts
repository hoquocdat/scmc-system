import { spendCreditForPayment } from '../sales-returns/customer-credit';
import { claimQrPayment, linkQrPayment } from '../qr-payments/qr-claim';
import { assertAvailable, recomputeOrderReservations } from '../inventory/stock-helpers';
import {
  AppliedPromotion,
  checkVoucher,
  evaluatePromotions,
  VoucherCheck,
} from '../promotions/promotion-engine';
import {
  loadPromotions,
  loadVoucher,
  productAttributes,
  redeemVoucher,
  TotalChangedException,
  VoucherRejectedException,
} from '../promotions/promotion-loader';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CashBookPostingService } from '../cash-book/cash-book-posting.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSalesOrderDto,
  OrderStatus,
  PaymentStatus,
} from './dto/create-sales-order.dto';
import { PriceResolverService, ResolvedPrice } from './pricing/price-resolver';
import {
  InsufficientStockException,
  PaymentRuleException,
  PriceChange,
  PriceChangedException,
  StockShortage,
} from './sales.errors';

type Tx = Prisma.TransactionClient;

export interface PostingLineInput {
  product_id: string;
  product_variant_id?: string | null;
  quantity: number;
  /** POS sends the price it showed; a mismatch with the server price is rejected (design D5). */
  expected_unit_price?: number;
  /** Per-unit line discount. */
  discount_amount?: number;
  /** Per-unit tax. */
  tax_amount?: number;
  notes?: string;
  /** Selling unit (product_units); absent = base unit (inventory-operations D8). */
  unit_id?: string | null;
}

export interface PostingPaymentInput {
  payment_method: string;
  amount: number;
  /** Paid QR request this payment uses (ewallet-qr-payments D4). */
  qr_payment_request_id?: string;
  amount_tendered?: number;
  change_given?: number;
  transaction_id?: string;
  authorization_code?: string;
  notes?: string;
}

export interface PostingDraft {
  channel: string;
  status: 'draft' | 'pending' | 'confirmed' | 'completed';
  store_id: string;
  customer_id?: string | null;
  customer_name?: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  discount_type: 'fixed' | 'percent';
  /** Fixed amount or percent, depending on discount_type. */
  discount_value: number;
  points_to_redeem?: number;
  shipping_cost?: number;
  shipping_address?: string;
  shipping_city?: string;
  notes?: string;
  internal_notes?: string;
  created_by?: string;
  pos_session_id?: string;
  client_request_id?: string;
  discount_approved_by?: string;
  /** Manually chosen price book (permission checked by the caller); absent = automatic. */
  price_book_id?: string | null;
  /** Voucher code entered for the order (promotions-vouchers D5). */
  voucher_code?: string | null;
  /** Total the screen showed; a different computed total is refused (TOTAL_CHANGED). */
  expected_total?: number | null;
  /** Do not apply promotions (exchange replacement orders keep plain prices only when asked). */
  skipPromotions?: boolean;
  lines: PostingLineInput[];
  payments?: PostingPaymentInput[];
  /** Reject when expected_unit_price differs from the resolved price (POS). */
  enforcePrice?: boolean;
  /** Allow completing with an unpaid balance for a known customer (POS credit sale). */
  allowCredit?: boolean;
  at?: Date;
}

export interface ComputedLine {
  input: PostingLineInput;
  price: ResolvedPrice;
  unitPrice: number;
  discountPerUnit: number;
  taxPerUnit: number;
  /** Selling unit name and base units per selling unit. */
  unitName: string | null;
  unitFactor: number;
  /** Line promotions on this line (total, not per unit). */
  promotionDiscount: number;
  lineTotal: number;
}

export interface AppliedVoucher {
  code: string;
  ok: boolean;
  amount: number;
  reason?: string;
  voucherId?: string;
  campaignId?: string;
  campaignName?: string;
}

export interface ComputedTotals {
  lines: ComputedLine[];
  subtotal: number;
  lineDiscounts: number;
  /** Line promotions (step 3). */
  linePromotionDiscount: number;
  /** Order promotion (step 4). */
  orderPromotionDiscount: number;
  linePromotions: AppliedPromotion[];
  orderPromotion: AppliedPromotion | null;
  /** Manual order discount (step 5). */
  orderDiscount: number;
  /** Voucher (step 6). */
  voucherDiscount: number;
  voucher: AppliedVoucher | null;
  discountPercent: number;
  loyaltyDiscount: number;
  tax: number;
  shipping: number;
  total: number;
}

export const REVENUE_STATUSES: ReadonlySet<string> = new Set([
  'confirmed',
  'processing',
  'ready',
  'completed',
]);

const includeFull = {
  customers: true,
  stores: true,
  user_profiles_sales_orders_created_byTouser_profiles: true,
  sales_order_items: { include: { products: true, product_variants: true } },
  sales_order_payments: true,
} as const;

/**
 * Writes a sales order and everything that must move with it, inside one
 * database transaction (design D2): order and lines at server prices, stock
 * deducted exactly once when the order becomes confirmed/completed (with row
 * locks and recorded unit cost), payments, receivable for the unpaid balance,
 * loyalty redemption and earning. Used by SalesService (back office) and
 * PosCheckoutService (POS).
 */
@Injectable()
export class SalesPostingService {
  constructor(
    private readonly prisma: PrismaService,
    readonly prices: PriceResolverService,
    private readonly loyalty: LoyaltyService,
    private readonly cashBook: CashBookPostingService,
  ) {}

  /** Maps the back-office DTO to a posting draft (client prices and totals are ignored). */
  fromDto(dto: CreateSalesOrderDto, userId?: string): PostingDraft {
    const status = (dto.status ?? OrderStatus.DRAFT) as PostingDraft['status'];
    const usePercent =
      dto.discount_type === 'percent' && (dto.discount_percent ?? 0) > 0;
    return {
      channel: dto.channel,
      status: ['draft', 'pending', 'confirmed', 'completed'].includes(status)
        ? status
        : 'draft',
      store_id: dto.store_id,
      customer_id: dto.customer_id ?? null,
      customer_name: dto.customer_name,
      customer_phone: dto.customer_phone,
      customer_email: dto.customer_email,
      discount_type: usePercent ? 'percent' : 'fixed',
      discount_value: usePercent
        ? (dto.discount_percent ?? 0)
        : (dto.discount_amount ?? 0),
      points_to_redeem: dto.points_to_redeem ?? 0,
      shipping_cost: dto.shipping_cost ?? 0,
      shipping_address: dto.shipping_address,
      shipping_city: dto.shipping_city,
      notes: dto.notes,
      created_by: dto.created_by ?? userId,
      price_book_id: dto.price_book_id ?? null,
      voucher_code: dto.voucher_code ?? null,
      expected_total: dto.expected_total ?? null,
      lines: dto.items.map((i) => ({
        product_id: i.product_id,
        product_variant_id: i.product_variant_id ?? null,
        unit_id: i.unit_id ?? null,
        quantity: i.quantity,
        discount_amount: i.discount_amount ?? 0,
        tax_amount: i.tax_amount ?? 0,
        notes: i.notes,
      })),
    };
  }

  /** Creates a draft (no stock movement) or a confirmed/completed order (fully posted). */
  async createOrder(draft: PostingDraft) {
    return this.prisma.$transaction(async (tx) =>
      this.createOrderIn(tx, draft),
    );
  }

  async createOrderIn(tx: Tx, draft: PostingDraft) {
    if (!draft.lines?.length)
      throw new BadRequestException('Order has no lines');
    const store = await tx.stores.findUnique({ where: { id: draft.store_id } });
    if (!store)
      throw new NotFoundException(`Store ${draft.store_id} not found`);

    const customer = draft.customer_id
      ? await tx.customers.findUnique({ where: { id: draft.customer_id } })
      : null;
    if (draft.customer_id && !customer)
      throw new NotFoundException(`Customer ${draft.customer_id} not found`);

    const totals = await this.computeTotals(tx, draft, customer?.id ?? null);
    if (
      draft.expected_total != null &&
      Math.abs(draft.expected_total - totals.total) > 0.5
    )
      throw new TotalChangedException(
        draft.expected_total,
        totals.total,
        SalesPostingService.breakdown(totals),
      );
    const posting = REVENUE_STATUSES.has(draft.status);
    const payments = draft.payments ?? [];
    this.validatePayments(draft, totals, payments, !!customer);

    const order = await tx.sales_orders.create({
      data: {
        order_number: '', // generated by trigger (document_counters)
        customer_id: customer?.id ?? null,
        customer_name: customer?.full_name ?? draft.customer_name ?? 'Khách lẻ',
        customer_phone: customer?.phone ?? draft.customer_phone ?? null,
        customer_email: customer?.email ?? draft.customer_email ?? null,
        channel: draft.channel,
        status: draft.status,
        payment_status: PaymentStatus.UNPAID,
        store_id: store.id,
        location_id: store.default_warehouse_id,
        subtotal: new Prisma.Decimal(totals.subtotal),
        discount_type: draft.discount_type,
        discount_percent: new Prisma.Decimal(totals.discountPercent),
        discount_amount: new Prisma.Decimal(totals.orderDiscount),
        promotion_discount_amount: new Prisma.Decimal(
          totals.orderPromotionDiscount,
        ),
        voucher_discount_amount: new Prisma.Decimal(totals.voucherDiscount),
        voucher_code: totals.voucher?.ok ? totals.voucher.code : null,
        loyalty_points_redeemed: posting
          ? (draft.points_to_redeem ?? 0)
          : (draft.points_to_redeem ?? 0),
        loyalty_discount_amount: new Prisma.Decimal(totals.loyaltyDiscount),
        tax_amount: new Prisma.Decimal(totals.tax),
        shipping_cost: new Prisma.Decimal(totals.shipping),
        total_amount: new Prisma.Decimal(totals.total),
        shipping_address: draft.shipping_address,
        shipping_city: draft.shipping_city,
        notes: draft.notes,
        internal_notes: draft.internal_notes,
        created_by: draft.created_by,
        processed_by: posting ? draft.created_by : null,
        pos_session_id: draft.pos_session_id,
        client_request_id: draft.client_request_id,
        discount_approved_by: draft.discount_approved_by,
        price_book_id: draft.price_book_id ?? null,
        order_date: draft.at ?? new Date(),
      },
    });

    const itemIds: string[] = [];
    for (const line of totals.lines) {
      const item = await tx.sales_order_items.create({
        data: {
          sales_order_id: order.id,
          product_id: line.price.productId,
          product_variant_id: line.price.variantId,
          product_name: line.price.name,
          product_sku: line.price.sku,
          variant_name: line.price.variantId ? line.price.name : null,
          quantity: line.input.quantity,
          unit_price: new Prisma.Decimal(line.unitPrice),
          discount_amount: new Prisma.Decimal(line.discountPerUnit),
          tax_amount: new Prisma.Decimal(line.taxPerUnit),
          total_amount: new Prisma.Decimal(line.lineTotal),
          unit_cost: new Prisma.Decimal(line.price.unitCost),
          base_unit_price: new Prisma.Decimal(line.price.basePrice),
          price_book_id: line.price.priceBookId,
          price_source: line.price.source,
          promotion_discount: new Prisma.Decimal(line.promotionDiscount),
          unit_name: line.unitName,
          unit_factor: line.unitFactor,
          notes: line.input.notes,
        },
      });
      itemIds.push(item.id);
    }
    await this.recordDiscounts(
      tx,
      order.id,
      customer?.id ?? null,
      totals,
      itemIds,
    );

    if (draft.status === 'pending') await recomputeOrderReservations(tx, order.id);
    if (posting) {
      await this.postConfirmedIn(tx, order.id, {
        userId: draft.created_by,
        computed: totals,
      });
    }
    for (const p of payments) {
      const qr = p.qr_payment_request_id
        ? await claimQrPayment(tx, { requestId: p.qr_payment_request_id, storeId: store.id, method: p.payment_method, amount: p.amount, clientRequestId: draft.client_request_id })
        : null;
      const payment = await tx.sales_order_payments.create({
        data: {
          sales_order_id: order.id,
          qr_payment_request_id: p.qr_payment_request_id ?? null,
          payment_method: p.payment_method,
          amount: new Prisma.Decimal(p.amount),
          amount_tendered:
            p.amount_tendered != null
              ? new Prisma.Decimal(p.amount_tendered)
              : null,
          change_given:
            p.change_given != null ? new Prisma.Decimal(p.change_given) : null,
          transaction_id: qr?.providerRef ?? p.transaction_id,
          authorization_code: p.authorization_code,
          notes: p.notes,
          status: 'completed',
          received_by: draft.created_by,
          payment_date: draft.at ?? new Date(),
        },
      });
      if (qr && p.qr_payment_request_id) await linkQrPayment(tx, p.qr_payment_request_id, order.id, payment.id);
      if (p.payment_method === 'store_credit')
        await spendCreditForPayment(tx, {
          customerId: order.customer_id,
          paymentId: payment.id,
          amount: p.amount,
          orderNumber: order.order_number,
          createdBy: draft.created_by,
        });
      // Every completed money payment is a cash book receipt in the same transaction
      await this.cashBook.postSalesOrderPayment(tx, {
        orderId: order.id,
        paymentId: payment.id,
        method: p.payment_method,
        accountId: qr?.cashAccountId ?? null,
        amount: p.amount,
        categoryCode: 'sale',
        createdBy: draft.created_by,
        at: draft.at,
      });
    }
    if (posting) {
      await this.settleIn(tx, order.id, draft.created_by);
    }

    return tx.sales_orders.findUniqueOrThrow({
      where: { id: order.id },
      include: includeFull,
    });
  }

  /**
   * What happens when an order becomes confirmed/completed: stock is deducted
   * exactly once (row locks, recorded cost) and loyalty points are redeemed.
   */
  async postConfirmedIn(
    tx: Tx,
    orderId: string,
    opts: { userId?: string; computed?: ComputedTotals } = {},
  ) {
    const order = await tx.sales_orders.findUniqueOrThrow({
      where: { id: orderId },
      include: { sales_order_items: true, stores: true },
    });
    const locationId = order.location_id ?? order.stores?.default_warehouse_id;
    if (!locationId)
      throw new BadRequestException(
        'Store has no selling location (default warehouse)',
      );

    const already = await tx.inventory_transactions.count({
      where: {
        reference_type: 'sales_order',
        reference_id: orderId,
        transaction_type: 'SALE',
      },
    });
    if (already > 0) return; // stock already deducted for this order

    const items = [...order.sales_order_items].sort((a, b) =>
      (a.product_id ?? '').localeCompare(b.product_id ?? ''),
    );
    // Available = on hand − reserved by pending orders (inventory-operations D7); units move factor × quantity
    await assertAvailable(
      tx,
      locationId,
      items.map((item) => ({
        productId: item.product_variant_id ? null : item.product_id,
        variantId: item.product_variant_id,
        quantity: item.quantity * item.unit_factor,
        name: item.product_name,
        sku: item.product_sku ?? '',
      })),
    );

    for (const item of items) {
      await tx.inventory_transactions.create({
        data: {
          location_id: locationId,
          product_id: item.product_variant_id ? null : item.product_id,
          product_variant_id: item.product_variant_id,
          transaction_type: 'SALE',
          quantity: -Math.abs(item.quantity * item.unit_factor),
          unit_cost: item.unit_cost,
          total_cost: item.unit_cost
            ? new Prisma.Decimal(Number(item.unit_cost) * item.quantity)
            : null,
          reference_type: 'sales_order',
          reference_id: orderId,
          created_by: opts.userId,
        },
      });
    }

    const points = order.loyalty_points_redeemed ?? 0;
    if (points > 0 && order.customer_id) {
      await this.loyalty.redeemPoints(
        {
          customerId: order.customer_id,
          points,
          orderId,
          orderType: 'sales_order',
        },
        tx,
      );
    }
  }

  /**
   * After payments change: receivable = total - completed payments (created only
   * when a balance remains), payment status, and loyalty earning on full payment.
   */
  async settleIn(tx: Tx, orderId: string, userId?: string) {
    const order = await tx.sales_orders.findUniqueOrThrow({
      where: { id: orderId },
      include: { sales_order_payments: true },
    });
    const total = Number(order.total_amount);
    const paid = order.sales_order_payments
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + Number(p.amount), 0);
    const balance = Math.max(0, total - paid);
    const paymentStatus =
      paid <= 0
        ? PaymentStatus.UNPAID
        : paid >= total
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIAL;

    if (order.customer_id && REVENUE_STATUSES.has(order.status ?? '')) {
      const existing = await tx.customer_receivables.findFirst({
        where: { sales_order_id: orderId },
      });
      const data = {
        original_amount: new Prisma.Decimal(total),
        paid_amount: new Prisma.Decimal(paid),
        balance: new Prisma.Decimal(balance),
        status: balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      };
      if (existing) {
        await tx.customer_receivables.update({
          where: { id: existing.id },
          data,
        });
      } else if (balance > 0) {
        await tx.customer_receivables.create({
          data: {
            customer_id: order.customer_id,
            sales_order_id: orderId,
            ...data,
          },
        });
      }
    }

    // Database triggers may already have flipped payment_status, so "became paid" is
    // detected by the absence of an earn transaction for this order.
    const alreadyEarned =
      paymentStatus === PaymentStatus.PAID &&
      (await tx.loyalty_point_transactions.count({
        where: {
          reference_type: 'sales_order',
          reference_id: orderId,
          transaction_type: 'earn',
        },
      })) > 0;
    const becamePaid = paymentStatus === PaymentStatus.PAID && !alreadyEarned;
    await tx.sales_orders.update({
      where: { id: orderId },
      data: {
        paid_amount: new Prisma.Decimal(paid),
        payment_status: paymentStatus,
        payment_date:
          paymentStatus === PaymentStatus.PAID
            ? (order.payment_date ?? new Date())
            : null,
      },
    });

    if (
      becamePaid &&
      order.customer_id &&
      REVENUE_STATUSES.has(order.status ?? '')
    ) {
      const eligible = total - Number(order.loyalty_discount_amount ?? 0);
      const earned = await this.loyalty.earnPoints(
        {
          customerId: order.customer_id,
          orderId,
          orderType: 'sales_order',
          amount: eligible,
          createdBy: userId,
        },
        tx,
      );
      if (earned.pointsEarned > 0) {
        await tx.sales_orders.update({
          where: { id: orderId },
          data: { loyalty_points_earned: earned.pointsEarned },
        });
      }
    }
  }

  /** Summary of a computed cart for screens and TOTAL_CHANGED errors. */
  static breakdown(t: ComputedTotals) {
    return {
      subtotal: t.subtotal,
      line_discounts: t.lineDiscounts,
      line_promotion_discount: t.linePromotionDiscount,
      order_promotion_discount: t.orderPromotionDiscount,
      order_discount: t.orderDiscount,
      voucher_discount: t.voucherDiscount,
      loyalty_discount: t.loyaltyDiscount,
      tax: t.tax,
      shipping: t.shipping,
      total: t.total,
      promotions: [
        ...t.linePromotions.map((a) => ({
          id: a.promotion.id,
          code: a.promotion.code,
          name: a.promotion.name,
          type: a.promotion.type,
          amount: a.total,
          lines: [...a.perLine.entries()].map(([k, v]) => ({
            index: Number(k),
            amount: v,
          })),
        })),
        ...(t.orderPromotion
          ? [
              {
                id: t.orderPromotion.promotion.id,
                code: t.orderPromotion.promotion.code,
                name: t.orderPromotion.promotion.name,
                type: t.orderPromotion.promotion.type,
                amount: t.orderPromotion.total,
                lines: [],
              },
            ]
          : []),
      ],
      voucher: t.voucher,
      lines: t.lines.map((l, i) => ({
        index: i,
        product_id: l.price.productId,
        product_variant_id: l.price.variantId,
        unit_id: l.input.unit_id ?? null,
        unit_name: l.unitName,
        unit_factor: l.unitFactor,
        unit_price: l.unitPrice,
        price_book_name: l.price.priceBookName,
        promotion_discount: l.promotionDiscount,
        line_total: l.lineTotal,
      })),
    };
  }

  /** Applied promotions and voucher on the order, voucher use counted (promotions-vouchers D5–D6). */
  private async recordDiscounts(
    tx: Tx,
    orderId: string,
    customerId: string | null,
    totals: ComputedTotals,
    itemIds: string[],
  ) {
    const rows: Prisma.sales_order_discountsCreateManyInput[] = [];
    for (const a of totals.linePromotions) {
      for (const [k, amount] of a.perLine) {
        if (amount > 0)
          rows.push({
            sales_order_id: orderId,
            sales_order_item_id: itemIds[Number(k)],
            source_type: 'promotion',
            promotion_id: a.promotion.id,
            amount: new Prisma.Decimal(amount),
            description: a.promotion.name,
          });
      }
    }
    if (totals.orderPromotion)
      rows.push({
        sales_order_id: orderId,
        source_type: 'promotion',
        promotion_id: totals.orderPromotion.promotion.id,
        amount: new Prisma.Decimal(totals.orderPromotion.total),
        description: totals.orderPromotion.promotion.name,
      });
    const v = totals.voucher;
    if (v?.ok && v.amount > 0) {
      rows.push({
        sales_order_id: orderId,
        source_type: 'voucher',
        voucher_id: v.voucherId,
        amount: new Prisma.Decimal(v.amount),
        description: `${v.campaignName} (${v.code})`,
      });
      await redeemVoucher(tx, {
        voucherId: v.voucherId,
        campaignId: v.campaignId,
        orderId,
        customerId,
        amount: v.amount,
        code: v.code,
      });
    }
    if (rows.length) await tx.sales_order_discounts.createMany({ data: rows });
  }

  /** Server-side prices and totals (design D2/D5). */
  async computeTotals(
    tx: Tx,
    draft: PostingDraft,
    customerId: string | null,
    /** voucherReport: return a rejected voucher with its reason instead of throwing (cart preview). */
    opts: { voucherReport?: boolean } = {},
  ): Promise<ComputedTotals> {
    const at = draft.at ?? new Date();
    const resolved = await this.prices.resolveMany(
      draft.lines,
      {
        at,
        storeId: draft.store_id,
        customerId,
        priceBookId: draft.price_book_id ?? null,
      },
      tx,
    );
    const changes: PriceChange[] = [];
    const unitIds = [...new Set(draft.lines.map((l) => l.unit_id).filter((u): u is string => !!u))];
    const units = unitIds.length
      ? new Map((await tx.product_units.findMany({ where: { id: { in: unitIds } } })).map((u) => [u.id, u]))
      : new Map<string, never>();
    const lines: ComputedLine[] = draft.lines.map((input) => {
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
        throw new BadRequestException(
          'Quantity must be a positive whole number',
        );
      }
      const base = resolved.get(PriceResolverService.key(input))!;
      // A selling unit multiplies price and cost by its factor unless it has its own price
      const unit = input.unit_id ? units.get(input.unit_id) : undefined;
      if (input.unit_id && (!unit || unit.product_id !== base.productId || !unit.is_active || input.product_variant_id))
        throw new BadRequestException(`Đơn vị bán không hợp lệ cho ${base.name}`);
      const factor = unit?.factor ?? 1;
      const price = unit
        ? {
            ...base,
            name: `${base.name} (${unit.name})`,
            unitPrice: unit.price != null ? Number(unit.price) : base.unitPrice * factor,
            basePrice: base.basePrice * factor,
            unitCost: base.unitCost * factor,
          }
        : base;
      if (
        draft.enforcePrice &&
        input.expected_unit_price != null &&
        Math.round(input.expected_unit_price) !== Math.round(price.unitPrice)
      ) {
        changes.push({
          product_id: price.productId,
          product_variant_id: price.variantId,
          sku: price.sku,
          name: price.name,
          expected_unit_price: input.expected_unit_price,
          unit_price: price.unitPrice,
        });
      }
      const discountPerUnit = input.discount_amount ?? 0;
      const taxPerUnit = input.tax_amount ?? 0;
      if (discountPerUnit < 0 || discountPerUnit > price.unitPrice) {
        throw new BadRequestException(
          `Line discount for ${price.name} exceeds its price`,
        );
      }
      return {
        input,
        price,
        unitPrice: price.unitPrice,
        discountPerUnit,
        taxPerUnit,
        unitName: unit?.name ?? null,
        unitFactor: factor,
        promotionDiscount: 0,
        lineTotal:
          (price.unitPrice - discountPerUnit + taxPerUnit) * input.quantity,
      };
    });
    if (changes.length) throw new PriceChangedException(changes);

    // Steps 3–4: promotions (promotions-vouchers D2–D4)
    const promotions = draft.skipPromotions
      ? []
      : await loadPromotions(tx, {
          at,
          storeId: draft.store_id,
          customerId,
          channel: draft.channel,
        });
    const attrs = promotions.length
      ? await productAttributes(tx, [
          ...new Set(lines.map((l) => l.price.productId)),
        ])
      : new Map<
          string,
          { categoryId: string | null; brandId: string | null }
        >();
    const engine = evaluatePromotions(
      lines.map((l, i) => ({
        key: String(i),
        productId: l.price.productId,
        variantId: l.price.variantId,
        categoryId: attrs.get(l.price.productId)?.categoryId ?? null,
        brandId: attrs.get(l.price.productId)?.brandId ?? null,
        unitPrice: l.unitPrice,
        manualDiscount: l.discountPerUnit,
        quantity: l.input.quantity,
      })),
      promotions,
    );
    lines.forEach((l, i) => {
      l.promotionDiscount = engine.byLine.get(String(i)) ?? 0;
      l.lineTotal -= l.promotionDiscount;
    });

    const subtotal = lines.reduce(
      (s, l) => s + l.unitPrice * l.input.quantity,
      0,
    );
    const lineDiscounts = lines.reduce(
      (s, l) => s + l.discountPerUnit * l.input.quantity,
      0,
    );
    const tax = lines.reduce((s, l) => s + l.taxPerUnit * l.input.quantity, 0);
    const afterLines =
      subtotal - lineDiscounts - engine.lineTotal - engine.orderTotal;

    let orderDiscount = 0;
    let discountPercent = 0;
    if (draft.discount_type === 'percent') {
      discountPercent = draft.discount_value;
      if (discountPercent < 0 || discountPercent > 100)
        throw new BadRequestException(
          'Discount percent must be between 0 and 100',
        );
      orderDiscount = Math.round((afterLines * discountPercent) / 100);
    } else {
      orderDiscount = draft.discount_value ?? 0;
      if (orderDiscount < 0)
        throw new BadRequestException('Discount cannot be negative');
    }
    if (orderDiscount > afterLines)
      throw new BadRequestException('Discount amount cannot exceed subtotal');

    // Step 6: voucher on what is left after the manual order discount
    let voucher: AppliedVoucher | null = null;
    const code = draft.voucher_code?.trim();
    if (code) {
      const loaded = await loadVoucher(tx, code, customerId);
      const check = loaded
        ? checkVoucher(loaded.rule, {
            at,
            storeId: draft.store_id,
            channel: draft.channel,
            customerId,
            base: afterLines - orderDiscount,
            promotionsApplied: engine.line.length > 0 || !!engine.order,
          })
        : ({ ok: false, reason: 'Mã không tồn tại' } as VoucherCheck);
      voucher = check.ok
        ? {
            code: loaded.code,
            ok: true,
            amount: check.amount,
            voucherId: loaded.voucherId,
            campaignId: loaded.campaignId,
            campaignName: loaded.campaignName,
          }
        : {
            code: code.toUpperCase(),
            ok: false,
            amount: 0,
            reason: (check as { reason: string }).reason,
          };
      if (!voucher.ok && !opts.voucherReport)
        throw new VoucherRejectedException(voucher.code, voucher.reason);
    }
    const voucherDiscount = voucher?.ok ? voucher.amount : 0;

    let loyaltyDiscount = 0;
    const points = draft.points_to_redeem ?? 0;
    if (points > 0) {
      if (!customerId)
        throw new BadRequestException('Loyalty points need a customer');
      const preview = await this.loyalty
        .forTransaction(tx)
        .calculateRedemption({
          customerId,
          orderAmount: afterLines - orderDiscount - voucherDiscount + tax,
          pointsToRedeem: points,
        });
      if (points < preview.minRedemptionPoints)
        throw new BadRequestException(
          `Minimum redemption is ${preview.minRedemptionPoints} points`,
        );
      if (points > preview.maxRedeemablePoints)
        throw new BadRequestException(
          `Maximum redeemable points is ${preview.maxRedeemablePoints}`,
        );
      loyaltyDiscount = points * preview.redemptionRate;
    }

    const shipping = draft.shipping_cost ?? 0;
    const total =
      afterLines -
      orderDiscount -
      voucherDiscount -
      loyaltyDiscount +
      tax +
      shipping;
    if (total < 0)
      throw new BadRequestException('Order total cannot be negative');
    return {
      lines,
      subtotal,
      lineDiscounts,
      linePromotionDiscount: engine.lineTotal,
      orderPromotionDiscount: engine.orderTotal,
      linePromotions: engine.line,
      orderPromotion: engine.order,
      orderDiscount,
      voucherDiscount,
      voucher,
      discountPercent,
      loyaltyDiscount,
      tax,
      shipping,
      total,
    };
  }

  /** Payment rules from the checkout spec: no non-cash overpayment, credit only for known customers with permission. */
  private validatePayments(
    draft: PostingDraft,
    totals: ComputedTotals,
    payments: PostingPaymentInput[],
    hasCustomer: boolean,
  ) {
    if (!payments.length) {
      if (draft.status === 'completed' && !draft.allowCredit) {
        throw new PaymentRuleException('Đơn hoàn tất phải được thanh toán');
      }
      return;
    }
    for (const p of payments) {
      if (!(p.amount > 0))
        throw new PaymentRuleException('Số tiền thanh toán phải lớn hơn 0');
      if (p.payment_method === 'cash' && p.amount_tendered != null) {
        if (p.amount_tendered < p.amount)
          throw new PaymentRuleException(
            'Tiền khách đưa nhỏ hơn số tiền thanh toán',
          );
        const change = Math.round(p.amount_tendered - p.amount);
        if (p.change_given != null && Math.round(p.change_given) !== change) {
          throw new PaymentRuleException('Tiền thối không khớp');
        }
      }
    }
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    if (paid > totals.total + 0.5) {
      throw new PaymentRuleException(
        'Tổng thanh toán vượt quá giá trị đơn hàng',
      );
    }
    if (draft.status === 'completed' && paid < totals.total - 0.5) {
      if (!hasCustomer)
        throw new PaymentRuleException('Khách lẻ phải thanh toán đủ');
      if (!draft.allowCredit)
        throw new PaymentRuleException('Bán nợ cần quyền bán hàng công nợ');
    }
  }
}
