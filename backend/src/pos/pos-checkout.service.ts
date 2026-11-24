import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { Action, CaslAbilityFactory } from '../casl/casl-ability.factory';
import { PrismaService } from '../prisma/prisma.service';
import {
  PostingDraft,
  SalesPostingService,
} from '../sales/sales-posting.service';
import {
  DiscountApprovalRequiredException,
  ShiftNotOpenException,
} from '../sales/sales.errors';
import {
  APPROVAL_TTL_SECONDS,
  signApproval,
  verifyApproval,
} from './approval-token';
import { CheckoutDto } from './dto/checkout.dto';
import { DiscountApprovalDto } from './dto/discount-approval.dto';
import { PosSessionStatus } from './dto/pos-session-query.dto';
import { PosUser } from './pos.service';

const orderInclude = {
  customers: true,
  stores: true,
  user_profiles_sales_orders_created_byTouser_profiles: true,
  user_profiles_sales_orders_discount_approved_byTouser_profiles: true,
  pos_sessions: true,
  sales_order_items: { include: { products: true, product_variants: true } },
  sales_order_payments: true,
} satisfies Prisma.sales_ordersInclude;

/** A POS order with everything the receipt needs. */
export type PosOrder = Prisma.sales_ordersGetPayload<{
  include: typeof orderInclude;
}>;

export interface PosReceipt extends PosOrder {
  idempotent_replay: boolean;
  reprint?: boolean;
  loyalty: { points_balance: number; tier: string | null } | null;
}

/**
 * POS checkout (design D3, D4, D9): one request records the whole sale through
 * SalesPostingService, inside the caller's open shift, idempotent on
 * client_request_id, with role discount limits and approval tokens.
 */
@Injectable()
export class PosCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: SalesPostingService,
    private readonly casl: CaslAbilityFactory,
    private readonly activity: ActivityLogsService,
    private readonly config: ConfigService,
  ) {}

  private get secret(): string {
    return (
      this.config.get<string>('JWT_SECRET') ||
      this.config.get<string>('SUPABASE_JWT_SECRET') ||
      'super-secret-jwt-token-with-at-least-32-characters-long'
    );
  }

  async checkout(user: PosUser, dto: CheckoutDto): Promise<PosReceipt> {
    const existing = await this.prisma.sales_orders.findFirst({
      where: { client_request_id: dto.client_request_id },
      include: orderInclude,
    });
    if (existing)
      return this.withLoyalty(existing, { idempotent_replay: true });

    const shift = await this.prisma.pos_sessions.findFirst({
      where: { user_id: user.id, status: PosSessionStatus.OPEN },
      include: { stores: true },
    });
    if (!shift || !shift.store_id) throw new ShiftNotOpenException();

    const customerId = await this.resolveCustomer(dto, user);
    const ability = await this.casl.createForUser(user.id);
    if (dto.price_book_id && !ability.can(Action.Apply, 'price_books')) {
      throw new ForbiddenException({
        code: 'PRICE_BOOK_FORBIDDEN',
        message: 'Bạn không có quyền chọn bảng giá',
      });
    }

    // Discount limit: the biggest discount share this user's roles allow
    const requestedPercent = await this.requestedDiscountPercent(dto);
    let approvedBy: string | undefined;
    if (requestedPercent > 0) {
      const limit = await this.discountLimitFor(user.id);
      if (limit != null && requestedPercent > limit + 1e-9) {
        const approval = dto.discount_approval_token
          ? verifyApproval(dto.discount_approval_token, this.secret)
          : null;
        if (
          !approval ||
          approval.rid !== dto.client_request_id ||
          approval.pct + 1e-9 < requestedPercent
        ) {
          throw new DiscountApprovalRequiredException(
            Math.round(requestedPercent * 100) / 100,
            limit,
          );
        }
        approvedBy = approval.by;
      }
    }

    const payments = dto.payments.map((p) => ({
      payment_method: p.method,
      amount: p.amount,
      amount_tendered: p.method === 'cash' ? p.amount_tendered : undefined,
      change_given:
        p.method === 'cash' && p.amount_tendered != null
          ? Math.max(0, p.amount_tendered - p.amount)
          : undefined,
      transaction_id: p.reference,
    }));

    const draft: PostingDraft = {
      channel: 'pos',
      status: 'completed',
      store_id: shift.store_id,
      customer_id: customerId,
      discount_type: dto.order_discount?.type ?? 'fixed',
      discount_value: dto.order_discount?.value ?? 0,
      points_to_redeem: dto.points_to_redeem ?? 0,
      notes: dto.notes,
      created_by: user.id,
      pos_session_id: shift.id,
      client_request_id: dto.client_request_id,
      discount_approved_by: approvedBy,
      price_book_id: dto.price_book_id ?? null,
      voucher_code: dto.voucher_code ?? null,
      expected_total: dto.expected_total ?? null,
      lines: dto.lines.map((l) => ({
        product_id: l.product_id,
        product_variant_id: l.product_variant_id ?? null,
        quantity: l.quantity,
        expected_unit_price: l.expected_unit_price,
        discount_amount: l.discount_amount ?? 0,
        notes: l.notes,
      })),
      payments,
      enforcePrice: true,
      allowCredit: !!customerId && ability.can(Action.Credit, 'pos'),
    };

    let orderId: string;
    try {
      const order = await this.posting.createOrder(draft);
      orderId = order.id;
    } catch (error) {
      // Two identical requests raced: the first one won, return its order.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.sales_orders.findFirst({
          where: { client_request_id: dto.client_request_id },
          include: orderInclude,
        });
        if (winner)
          return this.withLoyalty(winner, { idempotent_replay: true });
      }
      throw error;
    }

    await this.activity.logActivity({
      userId: user.id,
      entityType: 'sales_order',
      entityId: orderId,
      action: 'pos_checkout',
      newValues: {
        pos_session_id: shift.id,
        store_id: shift.store_id,
        client_request_id: dto.client_request_id,
        payments: payments.length,
        discount_approved_by: approvedBy,
      },
    });

    const order = await this.prisma.sales_orders.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });
    return this.withLoyalty(order, { idempotent_replay: false });
  }

  /** The order plus the customer's loyalty balance after the sale (for the receipt). */
  private async withLoyalty(
    order: PosOrder,
    flags: { idempotent_replay: boolean; reprint?: boolean },
  ): Promise<PosReceipt> {
    const loyalty = order.customer_id
      ? await this.prisma.customer_loyalty.findUnique({
          where: { customer_id: order.customer_id },
          include: { loyalty_tiers: true },
        })
      : null;
    return {
      ...order,
      ...flags,
      loyalty: loyalty
        ? {
            points_balance: loyalty.points_balance,
            tier: loyalty.loyalty_tiers?.name ?? null,
          }
        : null,
    };
  }

  private async resolveCustomer(
    dto: CheckoutDto,
    user: PosUser,
  ): Promise<string | null> {
    if (dto.customer_id) {
      const c = await this.prisma.customers.findUnique({
        where: { id: dto.customer_id },
      });
      if (!c) throw new NotFoundException('Customer not found');
      return c.id;
    }
    if (dto.new_customer) {
      const phone = dto.new_customer.phone.replace(/\s+/g, '');
      const existing = await this.prisma.customers.findFirst({
        where: { phone },
      });
      if (existing) return existing.id;
      const created = await this.prisma.customers.create({
        data: {
          full_name: dto.new_customer.name.trim(),
          phone,
          created_by_id: user.id,
        },
      });
      return created.id;
    }
    return null;
  }

  /** Discount share of the cart: (line discounts + order discount) / gross, in percent. */
  private async requestedDiscountPercent(dto: CheckoutDto): Promise<number> {
    const gross = dto.lines.reduce(
      (s, l) => s + l.expected_unit_price * l.quantity,
      0,
    );
    if (gross <= 0) return 0;
    const lineDiscounts = dto.lines.reduce(
      (s, l) => s + (l.discount_amount ?? 0) * l.quantity,
      0,
    );
    const afterLines = gross - lineDiscounts;
    const orderDiscount = !dto.order_discount
      ? 0
      : dto.order_discount.type === 'percent'
        ? (afterLines * dto.order_discount.value) / 100
        : dto.order_discount.value;
    return ((lineDiscounts + orderDiscount) / gross) * 100;
  }

  /** Highest max_discount_percent among the user's roles; null when any role is unlimited. */
  async discountLimitFor(userId: string): Promise<number | null> {
    const roles = await this.prisma.user_roles.findMany({
      where: { user_id: userId },
      include: { roles: true },
    });
    if (roles.length === 0) return 0;
    let max = 0;
    for (const r of roles) {
      const limit = r.roles?.max_discount_percent;
      if (limit == null) return null;
      max = Math.max(max, Number(limit));
    }
    return max;
  }

  /** Issues a short-lived approval token for one cart; the caller must hold pos:approve (checked by the controller policy). */
  async approveDiscount(approver: PosUser, dto: DiscountApprovalDto) {
    const limit = await this.discountLimitFor(approver.id);
    if (limit != null && dto.discount_percent > limit) {
      throw new ForbiddenException(
        `Người phê duyệt chỉ được duyệt tối đa ${limit}%`,
      );
    }
    const exp = Math.floor(Date.now() / 1000) + APPROVAL_TTL_SECONDS;
    const token = signApproval(
      {
        rid: dto.client_request_id,
        pct: dto.discount_percent,
        by: approver.id,
        exp,
      },
      this.secret,
    );
    await this.activity.logActivity({
      userId: approver.id,
      entityType: 'pos_discount_approval',
      entityId: dto.client_request_id,
      action: 'approve',
      newValues: { discount_percent: dto.discount_percent },
    });
    return {
      token,
      expires_at: new Date(exp * 1000).toISOString(),
      approved_by: approver.id,
      discount_percent: dto.discount_percent,
    };
  }

  /** Receipt data for a past POS order; the reprint is logged. */
  async reprint(user: PosUser, orderId: string) {
    const order = await this.prisma.sales_orders.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.channel !== 'pos')
      throw new BadRequestException('Only POS orders have receipts');
    await this.activity.logActivity({
      userId: user.id,
      entityType: 'sales_order',
      entityId: orderId,
      action: 'reprint',
      newValues: {},
    });
    return this.withLoyalty(order, { idempotent_replay: false, reprint: true });
  }
}
