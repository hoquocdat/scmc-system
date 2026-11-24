import { spendCreditForPayment } from '../sales-returns/customer-credit';
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
}

export interface PostingPaymentInput {
  payment_method: string;
  amount: number;
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
  lineTotal: number;
}

export interface ComputedTotals {
  lines: ComputedLine[];
  subtotal: number;
  lineDiscounts: number;
  orderDiscount: number;
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
      lines: dto.items.map((i) => ({
        product_id: i.product_id,
        product_variant_id: i.product_variant_id ?? null,
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

    for (const line of totals.lines) {
      await tx.sales_order_items.create({
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
          notes: line.input.notes,
        },
      });
    }

    if (posting) {
      await this.postConfirmedIn(tx, order.id, {
        userId: draft.created_by,
        computed: totals,
      });
    }
    for (const p of payments) {
      const payment = await tx.sales_order_payments.create({
        data: {
          sales_order_id: order.id,
          payment_method: p.payment_method,
          amount: new Prisma.Decimal(p.amount),
          amount_tendered:
            p.amount_tendered != null
              ? new Prisma.Decimal(p.amount_tendered)
              : null,
          change_given:
            p.change_given != null ? new Prisma.Decimal(p.change_given) : null,
          transaction_id: p.transaction_id,
          authorization_code: p.authorization_code,
          notes: p.notes,
          status: 'completed',
          received_by: draft.created_by,
          payment_date: draft.at ?? new Date(),
        },
      });
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
    const shortages: StockShortage[] = [];
    for (const item of items) {
      const rows = await tx.$queryRaw<
        { id: string; quantity_on_hand: number }[]
      >`
        SELECT id, quantity_on_hand FROM inventory
        WHERE location_id = ${locationId}::uuid
          AND ${
            item.product_variant_id
              ? Prisma.sql`product_variant_id = ${item.product_variant_id}::uuid`
              : Prisma.sql`product_id = ${item.product_id}::uuid AND product_variant_id IS NULL`
          }
        ORDER BY id FOR UPDATE`;
      const available = rows.reduce(
        (s, r) => s + Number(r.quantity_on_hand),
        0,
      );
      if (rows.length === 0 || available < item.quantity) {
        shortages.push({
          product_id: item.product_id ?? '',
          product_variant_id: item.product_variant_id,
          sku: item.product_sku ?? '',
          name: item.product_name,
          requested: item.quantity,
          available,
        });
      }
    }
    if (shortages.length) throw new InsufficientStockException(shortages);

    for (const item of items) {
      await tx.inventory_transactions.create({
        data: {
          location_id: locationId,
          product_id: item.product_variant_id ? null : item.product_id,
          product_variant_id: item.product_variant_id,
          transaction_type: 'SALE',
          quantity: -Math.abs(item.quantity),
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

  /** Server-side prices and totals (design D2/D5). */
  async computeTotals(
    tx: Tx,
    draft: PostingDraft,
    customerId: string | null,
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
    const lines: ComputedLine[] = draft.lines.map((input) => {
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
        throw new BadRequestException(
          'Quantity must be a positive whole number',
        );
      }
      const price = resolved.get(PriceResolverService.key(input));
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
        lineTotal:
          (price.unitPrice - discountPerUnit + taxPerUnit) * input.quantity,
      };
    });
    if (changes.length) throw new PriceChangedException(changes);

    const subtotal = lines.reduce(
      (s, l) => s + l.unitPrice * l.input.quantity,
      0,
    );
    const lineDiscounts = lines.reduce(
      (s, l) => s + l.discountPerUnit * l.input.quantity,
      0,
    );
    const tax = lines.reduce((s, l) => s + l.taxPerUnit * l.input.quantity, 0);
    const afterLines = subtotal - lineDiscounts;

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

    let loyaltyDiscount = 0;
    const points = draft.points_to_redeem ?? 0;
    if (points > 0) {
      if (!customerId)
        throw new BadRequestException('Loyalty points need a customer');
      const preview = await this.loyalty
        .forTransaction(tx)
        .calculateRedemption({
          customerId,
          orderAmount: afterLines - orderDiscount + tax,
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
    const total = afterLines - orderDiscount - loyaltyDiscount + tax + shipping;
    if (total < 0)
      throw new BadRequestException('Order total cannot be negative');
    return {
      lines,
      subtotal,
      lineDiscounts,
      orderDiscount,
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
