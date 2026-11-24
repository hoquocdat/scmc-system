import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CashBookPostingService } from '../cash-book/cash-book-posting.service';
import { Action, CaslAbilityFactory } from '../casl/casl-ability.factory';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportScope } from '../reports/report-scope';
import { col, ReportResult } from '../reports/report-types';
import {
  PostingDraft,
  SalesPostingService,
} from '../sales/sales-posting.service';
import { moveCustomerCredit } from './customer-credit';
import { ReturnListQueryDto, ReturnRequestDto } from './dto/sales-returns.dto';
import {
  allocateOrderReductions,
  proportionalPoints,
  refundFor,
  ReturnQuantityError,
} from './return-math';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

export interface Actor {
  id: string;
}

const RETURNABLE_STATUSES = new Set([
  'confirmed',
  'processing',
  'ready',
  'completed',
]);
const num = (v: Prisma.Decimal | number | null | undefined) =>
  v == null ? 0 : Number(v);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VN_PERIOD = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: '2-digit',
  month: '2-digit',
});

/** Approval limit and return window (design D8); environment until a settings screen exists. */
export const returnSettings = () => ({
  approvalLimit: Number(process.env.RETURN_APPROVAL_LIMIT ?? 2_000_000),
  windowDays: Number(process.env.RETURN_WINDOW_DAYS ?? 30),
});

export class ReturnRuleException extends UnprocessableEntityException {
  constructor(message: string) {
    super({ code: 'RETURN_RULE', message });
  }
}

export class ReturnApprovalRequiredException extends ForbiddenException {
  constructor(reason: string) {
    super({
      code: 'RETURN_APPROVAL_REQUIRED',
      message: `Cần quản lý duyệt: ${reason}`,
    });
  }
}

const orderInclude = {
  sales_order_items: { orderBy: { created_at: 'asc' } },
  sales_order_payments: true,
  customer_receivables: true,
  stores: true,
  customers: {
    select: { id: true, full_name: true, phone: true, credit_balance: true },
  },
} satisfies Prisma.sales_ordersInclude;

type LoadedOrder = Prisma.sales_ordersGetPayload<{
  include: typeof orderInclude;
}>;

interface PlannedItem {
  orderItem: LoadedOrder['sales_order_items'][number];
  quantity: number;
  lineRefund: number;
  unitRefund: number;
  restock: boolean;
  locationId: string | null;
  reasonCode: string;
  reasonNote?: string;
}

export interface ReturnPlan {
  order: LoadedOrder;
  items: PlannedItem[];
  goodsAmount: number;
  receivableReduction: number;
  refundDue: number;
  pointsReversed: number;
  pointsRestored: number;
  fullyReturned: boolean;
  approvalReasons: string[];
}

/** Sales returns and exchanges (spec sales/returns). */
@Injectable()
export class SalesReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: SalesPostingService,
    private readonly cashBook: CashBookPostingService,
    private readonly loyalty: LoyaltyService,
    private readonly casl: CaslAbilityFactory,
    private readonly activity: ActivityLogsService,
  ) {}

  // ---------- reading ----------

  /** Order by number or id with its returnable lines (D10). */
  async lookup(code: string) {
    const c = code.trim();
    const found = await this.prisma.sales_orders.findFirst({
      where: UUID_RE.test(c)
        ? { id: c }
        : { order_number: { equals: c, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`Không tìm thấy đơn hàng ${c}`);
    const order = await this.loadOrder(this.prisma, found.id, false);
    const previous = await this.previousTotals(this.prisma, order.id);
    const paid = this.paidValues(order);
    const blocked = this.blockedReason(order);
    return {
      id: order.id,
      order_number: order.order_number,
      order_date: order.order_date ?? order.created_at,
      status: order.status,
      channel: order.channel,
      store_id: order.store_id,
      store_name: order.stores?.name ?? null,
      location_id:
        order.location_id ?? order.stores?.default_warehouse_id ?? null,
      customer: order.customers
        ? {
            ...order.customers,
            credit_balance: num(order.customers.credit_balance),
          }
        : null,
      customer_name: order.customer_name,
      total_amount: num(order.total_amount),
      paid_amount: this.collected(order),
      refunded_amount: previous.refunds,
      receivable_balance: this.receivableBalance(order),
      return_status: order.return_status,
      returnable: !blocked,
      blocked_reason: blocked,
      lines: order.sales_order_items.map((i) => {
        const paidValue = paid.get(i.id) ?? 0;
        const remaining = i.quantity - i.returned_quantity;
        return {
          id: i.id,
          product_id: i.product_id,
          product_variant_id: i.product_variant_id,
          product_name: i.product_name,
          product_sku: i.product_sku,
          variant_name: i.variant_name,
          quantity: i.quantity,
          returned_quantity: i.returned_quantity,
          remaining,
          unit_price: num(i.unit_price),
          paid_value: paidValue,
          refundable_amount: Math.max(0, paidValue - num(i.returned_amount)),
          unit_refund:
            remaining > 0 ? refundFor(this.refundable(i, paidValue), 1) : 0,
        };
      }),
    };
  }

  async get(id: string) {
    const r = await this.prisma.sales_returns.findFirst({
      where: { id },
      include: {
        sales_return_items: true,
        sales_return_refunds: {
          include: { cash_book_accounts: { select: { id: true, name: true } } },
        },
        sales_orders_sales_returns_sales_order_idTosales_orders: {
          select: {
            id: true,
            order_number: true,
            total_amount: true,
            order_date: true,
          },
        },
        sales_orders_sales_returns_exchange_order_idTosales_orders: {
          select: { id: true, order_number: true, total_amount: true },
        },
        customers: { select: { id: true, full_name: true, phone: true } },
        stores: {
          select: { id: true, name: true, address: true, phone: true },
        },
        user_profiles_sales_returns_created_byTouser_profiles: {
          select: { id: true, full_name: true },
        },
        user_profiles_sales_returns_approved_byTouser_profiles: {
          select: { id: true, full_name: true },
        },
      },
    });
    if (!r) throw new NotFoundException('Không tìm thấy phiếu trả hàng');
    const entries = await this.prisma.cash_book_entries.findMany({
      where: { source_type: 'sales_return', source_id: id },
      select: { id: true, entry_number: true, amount: true, account_id: true },
    });
    return { ...r, cash_book_entries: entries };
  }

  async list(q: ReturnListQueryDto, all = false): Promise<ReportResult> {
    const scope = new ReportScope({
      from: q.from,
      to: q.to,
      storeId: q.storeId,
    });
    const search = q.search?.trim();
    const where: Prisma.sales_returnsWhereInput = {
      ...(q.orderId
        ? { sales_order_id: q.orderId }
        : { created_at: { gte: scope.start, lt: scope.endExclusive } }),
      ...(q.storeId ? { store_id: q.storeId } : {}),
      ...(q.customerId ? { customer_id: q.customerId } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(search
        ? {
            OR: [
              { return_number: { contains: search, mode: 'insensitive' } },
              {
                sales_orders_sales_returns_sales_order_idTosales_orders: {
                  order_number: { contains: search, mode: 'insensitive' },
                },
              },
              {
                customers: {
                  full_name: { contains: search, mode: 'insensitive' },
                },
              },
              { customers: { phone: { contains: search } } },
            ],
          }
        : {}),
    };
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const [rows, total, sums] = await Promise.all([
      this.prisma.sales_returns.findMany({
        where,
        include: {
          sales_orders_sales_returns_sales_order_idTosales_orders: {
            select: { order_number: true },
          },
          sales_orders_sales_returns_exchange_order_idTosales_orders: {
            select: { order_number: true },
          },
          customers: { select: { full_name: true, phone: true } },
          stores: { select: { name: true } },
          user_profiles_sales_returns_created_byTouser_profiles: {
            select: { full_name: true },
          },
          _count: { select: { sales_return_items: true } },
        },
        orderBy: { created_at: 'desc' },
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.sales_returns.count({ where }),
      this.prisma.sales_returns.aggregate({
        where,
        _sum: {
          goods_amount: true,
          refund_amount: true,
          receivable_reduction: true,
        },
      }),
    ]);
    return {
      report: 'sales.returns',
      title: { vi: 'Trả hàng', en: 'Sales returns' },
      scope: scope.toJSON(),
      columns: [
        col('createdAt', 'Thời gian', 'Date', 'datetime'),
        col('returnNumber', 'Số phiếu', 'Number'),
        col('orderNumber', 'Đơn gốc', 'Order'),
        col('kind', 'Loại', 'Kind'),
        col('customer', 'Khách hàng', 'Customer'),
        col('store', 'Chi nhánh', 'Branch'),
        col('goodsAmount', 'Giá trị hàng trả', 'Returned value', 'money'),
        col(
          'receivableReduction',
          'Trừ công nợ',
          'Receivable reduced',
          'money',
        ),
        col('refundAmount', 'Hoàn tiền', 'Refunded', 'money'),
        col('exchangeOrder', 'Đơn đổi', 'Exchange order'),
        col('createdBy', 'Người tạo', 'Created by'),
      ],
      rows: rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at.toISOString(),
        returnNumber: r.return_number,
        orderId: r.sales_order_id,
        orderNumber:
          r.sales_orders_sales_returns_sales_order_idTosales_orders
            .order_number,
        kind: r.kind === 'exchange' ? 'Đổi hàng' : 'Trả hàng',
        customer: r.customers
          ? `${r.customers.full_name} · ${r.customers.phone ?? ''}`
          : 'Khách lẻ',
        store: r.stores?.name ?? '',
        goodsAmount: num(r.goods_amount),
        receivableReduction: num(r.receivable_reduction),
        refundAmount: num(r.refund_amount),
        exchangeOrder:
          r.sales_orders_sales_returns_exchange_order_idTosales_orders
            ?.order_number ?? '',
        createdBy:
          r.user_profiles_sales_returns_created_byTouser_profiles?.full_name ??
          '',
        itemCount: r._count.sales_return_items,
      })),
      totals: {
        goodsAmount: num(sums._sum.goods_amount),
        receivableReduction: num(sums._sum.receivable_reduction),
        refundAmount: num(sums._sum.refund_amount),
      },
      meta: { page, pageSize, total },
    };
  }

  async customerCredit(customerId: string) {
    const customer = await this.prisma.customers.findFirst({
      where: { id: customerId },
      select: { id: true, credit_balance: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    const transactions =
      await this.prisma.customer_credit_transactions.findMany({
        where: { customer_id: customerId },
        orderBy: { created_at: 'desc' },
        take: 100,
      });
    return {
      balance: num(customer.credit_balance),
      transactions: transactions.map((t) => ({
        ...t,
        amount: num(t.amount),
        balance_after: num(t.balance_after),
      })),
    };
  }

  // ---------- preview / create ----------

  /** Amounts a return (or exchange) would produce, without writing anything. */
  async preview(actor: Actor, dto: ReturnRequestDto) {
    const order = await this.loadOrder(this.prisma, dto.sales_order_id, false);
    const plan = await this.plan(this.prisma, order, dto, new Date());
    const exchange = dto.exchange
      ? await this.exchangeTotals(this.prisma, order, dto, actor)
      : null;
    const exchangeApplied = exchange
      ? Math.min(plan.refundDue, exchange.total)
      : 0;
    const ability = await this.casl.createForUser(actor.id);
    return {
      goods_amount: plan.goodsAmount,
      receivable_reduction: plan.receivableReduction,
      refund_due: plan.refundDue,
      exchange_total: exchange?.total ?? 0,
      exchange_lines: exchange?.lines ?? [],
      exchange_applied: exchangeApplied,
      customer_pays: exchange ? exchange.total - exchangeApplied : 0,
      refund_after_exchange: plan.refundDue - exchangeApplied,
      points_reversed: plan.pointsReversed,
      points_restored: plan.pointsRestored,
      needs_approval: plan.approvalReasons.length > 0,
      approval_reasons: plan.approvalReasons,
      can_approve: ability.can(Action.Approve, 'sales_returns'),
      lines: plan.items.map((i) => ({
        sales_order_item_id: i.orderItem.id,
        quantity: i.quantity,
        line_refund: i.lineRefund,
      })),
    };
  }

  /** Posts a return or an exchange in one transaction (D2–D9). */
  async create(actor: Actor, dto: ReturnRequestDto) {
    const ability = await this.casl.createForUser(actor.id);
    const canApprove = ability.can(Action.Approve, 'sales_returns');
    const at = new Date();
    const created = await this.prisma.$transaction(
      async (tx) => {
        const order = await this.loadOrder(tx, dto.sales_order_id, true);
        const plan = await this.plan(tx, order, dto, at);
        if (plan.approvalReasons.length && !canApprove)
          throw new ReturnApprovalRequiredException(
            plan.approvalReasons.join('; '),
          );
        if (plan.goodsAmount <= 0 && !dto.exchange)
          throw new ReturnRuleException('Giá trị hàng trả bằng 0');

        const shift = order.store_id
          ? await tx.pos_sessions.findFirst({
              where: {
                user_id: actor.id,
                store_id: order.store_id,
                status: 'open',
              },
              select: { id: true },
            })
          : null;
        const number = await this.nextNumber(tx, at);
        const ret = await tx.sales_returns.create({
          data: {
            return_number: number,
            sales_order_id: order.id,
            store_id: order.store_id,
            customer_id: order.customer_id,
            pos_session_id: shift?.id ?? null,
            kind: dto.exchange ? 'exchange' : 'return',
            goods_amount: new Prisma.Decimal(plan.goodsAmount),
            receivable_reduction: new Prisma.Decimal(plan.receivableReduction),
            refund_amount: new Prisma.Decimal(0),
            points_reversed: plan.pointsReversed,
            points_restored: plan.pointsRestored,
            reason: dto.reason,
            notes: dto.notes,
            approved_by: plan.approvalReasons.length ? actor.id : null,
            created_by: actor.id,
            created_at: at,
          },
        });

        await this.postItems(tx, ret.id, plan, actor, at);
        await this.reduceReceivable(tx, order, plan.receivableReduction);

        // Exchange first, then refund what is left (D7, D4)
        let remaining = plan.refundDue;
        let exchangeOrderId: string | null = null;
        if (dto.exchange) {
          const { orderId, applied } = await this.postExchange(
            tx,
            order,
            dto,
            actor,
            shift?.id ?? null,
            number,
            remaining,
            at,
          );
          exchangeOrderId = orderId;
          if (applied > 0) {
            await tx.sales_return_refunds.create({
              data: {
                sales_return_id: ret.id,
                method: 'exchange',
                amount: new Prisma.Decimal(applied),
              },
            });
          }
          remaining -= applied;
        }
        const refunded = await this.postRefunds(
          tx,
          ret.id,
          number,
          order,
          dto,
          remaining,
          actor,
          at,
        );

        if (order.customer_id) {
          await this.loyalty.applyReturn(tx, {
            customerId: order.customer_id,
            returnId: ret.id,
            returnNumber: number,
            reverse: plan.pointsReversed,
            restore: plan.pointsRestored,
            createdBy: actor.id,
          });
        }
        await tx.sales_orders.update({
          where: { id: order.id },
          data: {
            returned_amount: new Prisma.Decimal(
              num(order.returned_amount) + plan.goodsAmount,
            ),
            return_status: plan.fullyReturned ? 'full' : 'partial',
            updated_at: at,
          },
        });
        await tx.sales_returns.update({
          where: { id: ret.id },
          data: {
            refund_amount: new Prisma.Decimal(refunded),
            exchange_order_id: exchangeOrderId,
          },
        });
        return { id: ret.id, number, order, plan, refunded, exchangeOrderId };
      },
      { timeout: 30_000 },
    );

    await this.activity.logActivity({
      userId: actor.id,
      entityType: 'sales_return',
      entityId: created.id,
      action: created.exchangeOrderId ? 'create_exchange' : 'create_return',
      newValues: {
        return_number: created.number,
        order_number: created.order.order_number,
        goods_amount: created.plan.goodsAmount,
        receivable_reduction: created.plan.receivableReduction,
        refund_amount: created.refunded,
        exchange_order_id: created.exchangeOrderId,
        items: created.plan.items.map((i) => ({
          sku: i.orderItem.product_sku,
          quantity: i.quantity,
          refund: i.lineRefund,
          restock: i.restock,
        })),
      },
    });
    return this.get(created.id);
  }

  // ---------- internals ----------

  private async loadOrder(
    db: Db,
    orderId: string,
    lock: boolean,
  ): Promise<LoadedOrder> {
    if (lock) {
      const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM sales_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    const order = await db.sales_orders.findFirst({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  private blockedReason(order: LoadedOrder): string | null {
    if (!RETURNABLE_STATUSES.has(order.status ?? ''))
      return `Đơn ở trạng thái "${order.status}" không trả hàng được`;
    if (order.channel === 'ecommerce')
      return 'Đơn thương mại điện tử không trả tại cửa hàng';
    if (order.sales_order_items.every((i) => i.returned_quantity >= i.quantity))
      return 'Đơn đã được trả hết';
    return null;
  }

  /** What was paid for each line (D3): order discount and loyalty discount shared over lines. */
  private paidValues(order: LoadedOrder): Map<string, number> {
    return allocateOrderReductions(
      order.sales_order_items.map((i) => ({
        id: i.id,
        unit_price: num(i.unit_price),
        discount_amount: num(i.discount_amount),
        tax_amount: num(i.tax_amount),
        quantity: i.quantity,
      })),
      num(order.discount_amount) + num(order.loyalty_discount_amount),
    );
  }

  private refundable(
    i: LoadedOrder['sales_order_items'][number],
    paidValue: number,
  ) {
    return {
      paidValue,
      quantity: i.quantity,
      returnedQuantity: i.returned_quantity,
      returnedAmount: num(i.returned_amount),
    };
  }

  private collected(order: LoadedOrder): number {
    return order.sales_order_payments
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + num(p.amount), 0);
  }

  private receivableBalance(order: LoadedOrder): number {
    const r = order.customer_receivables;
    return r && r.status !== 'paid' ? Math.max(0, num(r.balance)) : 0;
  }

  private async previousTotals(db: Db, orderId: string) {
    const agg = await db.sales_returns.aggregate({
      where: { sales_order_id: orderId },
      _sum: {
        refund_amount: true,
        points_reversed: true,
        points_restored: true,
      },
    });
    // Exchange value counts as refunded money: it paid for the replacement order
    const exchange = await db.sales_return_refunds.aggregate({
      where: { method: 'exchange', sales_returns: { sales_order_id: orderId } },
      _sum: { amount: true },
    });
    return {
      refunds: num(agg._sum.refund_amount) + num(exchange._sum.amount),
      pointsReversed: agg._sum.points_reversed ?? 0,
      pointsRestored: agg._sum.points_restored ?? 0,
    };
  }

  private async plan(
    db: Db,
    order: LoadedOrder,
    dto: ReturnRequestDto,
    at: Date,
  ): Promise<ReturnPlan> {
    const blocked = this.blockedReason(order);
    if (blocked) throw new ReturnRuleException(blocked);
    const paid = this.paidValues(order);
    const seen = new Set<string>();
    const defaultLocation =
      order.location_id ?? order.stores?.default_warehouse_id ?? null;

    const items: PlannedItem[] = [];
    for (const it of dto.items) {
      if (seen.has(it.sales_order_item_id))
        throw new BadRequestException('Một dòng hàng chỉ được chọn một lần');
      seen.add(it.sales_order_item_id);
      const orderItem = order.sales_order_items.find(
        (i) => i.id === it.sales_order_item_id,
      );
      if (!orderItem)
        throw new BadRequestException('Dòng hàng không thuộc đơn này');
      let lineRefund: number;
      try {
        lineRefund = refundFor(
          this.refundable(orderItem, paid.get(orderItem.id) ?? 0),
          it.quantity,
        );
      } catch (e) {
        if (e instanceof ReturnQuantityError)
          throw new ReturnRuleException(
            `${orderItem.product_name}: ${e.message}`,
          );
        throw e;
      }
      const restock = it.restock ?? true;
      const locationId = restock ? (it.location_id ?? defaultLocation) : null;
      if (restock && !locationId)
        throw new ReturnRuleException('Chưa chọn kho nhận hàng trả');
      items.push({
        orderItem,
        quantity: it.quantity,
        lineRefund,
        unitRefund: Math.round(lineRefund / it.quantity),
        restock,
        locationId,
        reasonCode: it.reason_code ?? 'other',
        reasonNote: it.reason_note,
      });
    }

    const goodsAmount = items.reduce((s, i) => s + i.lineRefund, 0);
    const receivableReduction = Math.min(
      goodsAmount,
      this.receivableBalance(order),
    );
    const refundDue = goodsAmount - receivableReduction;
    const previous = await this.previousTotals(db, order.id);
    const refundable = this.collected(order) - previous.refunds;
    if (refundDue > refundable + 0.5)
      throw new ReturnRuleException(
        `Chỉ còn ${Math.max(0, refundable).toLocaleString('vi-VN')} đ đã thu có thể hoàn lại`,
      );

    const returnedNow = new Map(items.map((i) => [i.orderItem.id, i.quantity]));
    const fullyReturned = order.sales_order_items.every(
      (i) => i.returned_quantity + (returnedNow.get(i.id) ?? 0) >= i.quantity,
    );
    const orderValue = num(order.total_amount) - num(order.shipping_cost);
    const pointsReversed = proportionalPoints(
      order.loyalty_points_earned ?? 0,
      previous.pointsReversed,
      goodsAmount,
      orderValue,
      fullyReturned,
    );
    const pointsRestored = proportionalPoints(
      order.loyalty_points_redeemed ?? 0,
      previous.pointsRestored,
      goodsAmount,
      orderValue,
      fullyReturned,
    );

    const { approvalLimit, windowDays } = returnSettings();
    const approvalReasons: string[] = [];
    if (goodsAmount > approvalLimit)
      approvalReasons.push(
        `giá trị trả vượt ${approvalLimit.toLocaleString('vi-VN')} đ`,
      );
    const orderDate = order.order_date ?? order.created_at ?? at;
    if (at.getTime() - orderDate.getTime() > windowDays * 86_400_000)
      approvalReasons.push(`quá ${windowDays} ngày kể từ ngày mua`);

    return {
      order,
      items,
      goodsAmount,
      receivableReduction,
      refundDue,
      pointsReversed,
      pointsRestored,
      fullyReturned,
      approvalReasons,
    };
  }

  private async nextNumber(tx: Tx, at: Date): Promise<string> {
    const period = VN_PERIOD.format(at).replace(/\D/g, '');
    const rows = await tx.$queryRaw<
      { n: number }[]
    >`SELECT next_document_number('TH', ${period}) AS n`;
    return `TH-${period}-${String(rows[0].n).padStart(5, '0')}`;
  }

  private async postItems(
    tx: Tx,
    returnId: string,
    plan: ReturnPlan,
    actor: Actor,
    at: Date,
  ) {
    for (const i of plan.items) {
      const oi = i.orderItem;
      await tx.sales_return_items.create({
        data: {
          sales_return_id: returnId,
          sales_order_item_id: oi.id,
          product_id: oi.product_id,
          product_variant_id: oi.product_variant_id,
          product_name: oi.variant_name
            ? `${oi.product_name}`
            : oi.product_name,
          product_sku: oi.product_sku,
          quantity: i.quantity,
          unit_refund: new Prisma.Decimal(i.unitRefund),
          line_refund: new Prisma.Decimal(i.lineRefund),
          unit_cost: oi.unit_cost,
          restock: i.restock,
          location_id: i.locationId,
          reason_code: i.reasonCode,
          reason_note: i.reasonNote,
        },
      });
      if (i.restock) {
        await this.ensureStockRow(
          tx,
          i.locationId,
          oi.product_id,
          oi.product_variant_id,
        );
      }
      await tx.inventory_transactions.create({
        data: {
          location_id:
            i.locationId ??
            plan.order.location_id ??
            plan.order.stores.default_warehouse_id,
          product_id: oi.product_variant_id ? null : oi.product_id,
          product_variant_id: oi.product_variant_id,
          transaction_type: i.restock ? 'RETURN' : 'RETURN_DAMAGED',
          quantity: i.quantity,
          unit_cost: oi.unit_cost,
          total_cost: oi.unit_cost
            ? new Prisma.Decimal(num(oi.unit_cost) * i.quantity)
            : null,
          reference_type: 'sales_return',
          reference_id: returnId,
          reason_code: i.reasonCode,
          created_by: actor.id,
          created_at: at,
        },
      });
      await tx.sales_order_items.update({
        where: { id: oi.id },
        data: {
          returned_quantity: oi.returned_quantity + i.quantity,
          returned_amount: new Prisma.Decimal(
            num(oi.returned_amount) + i.lineRefund,
          ),
        },
      });
    }
  }

  /** The stock trigger only updates existing rows: create the row at 0 first. */
  private async ensureStockRow(
    tx: Tx,
    locationId: string,
    productId: string | null,
    variantId: string | null,
  ) {
    const location = await tx.stock_locations.findFirst({
      where: { id: locationId },
      select: { is_active: true },
    });
    if (!location || location.is_active === false)
      throw new ReturnRuleException('Kho nhận hàng trả không hợp lệ');
    const existing = await tx.inventory.findFirst({
      where: variantId
        ? { location_id: locationId, product_variant_id: variantId }
        : {
            location_id: locationId,
            product_id: productId,
            product_variant_id: null,
          },
      select: { id: true },
    });
    if (!existing) {
      await tx.inventory.create({
        data: {
          location_id: locationId,
          product_id: variantId ? null : productId,
          product_variant_id: variantId,
          quantity_on_hand: 0,
        },
      });
    }
  }

  private async reduceReceivable(tx: Tx, order: LoadedOrder, amount: number) {
    const r = order.customer_receivables;
    if (!r || amount <= 0) return;
    const balance = Math.max(0, num(r.balance) - amount);
    await tx.customer_receivables.update({
      where: { id: r.id },
      data: {
        balance: new Prisma.Decimal(balance),
        original_amount: new Prisma.Decimal(
          Math.max(0, num(r.original_amount) - amount),
        ),
        status: balance <= 0 ? 'paid' : r.status,
        updated_at: new Date(),
      },
    });
  }

  private exchangeDraft(
    order: LoadedOrder,
    dto: ReturnRequestDto,
    actor: Actor,
    shiftId: string | null,
    number: string,
    exchangePaid: number,
  ): PostingDraft {
    const payments = [
      ...(exchangePaid > 0
        ? [
            {
              payment_method: 'exchange',
              amount: exchangePaid,
              notes: `Giá trị hàng trả ${number}`,
            },
          ]
        : []),
      ...(dto.exchange?.payments ?? []).map((p) => ({
        payment_method: p.method,
        amount: p.amount,
        amount_tendered: p.method === 'cash' ? p.amount_tendered : undefined,
        change_given:
          p.method === 'cash' && p.amount_tendered != null
            ? Math.max(0, p.amount_tendered - p.amount)
            : undefined,
        transaction_id: p.reference,
      })),
    ];
    return {
      channel: shiftId ? 'pos' : order.channel,
      status: 'completed',
      store_id: order.store_id,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      discount_type: 'fixed',
      discount_value: 0,
      created_by: actor.id,
      pos_session_id: shiftId ?? undefined,
      notes: `Đổi hàng từ ${order.order_number} (${number})`,
      lines: dto.exchange.lines.map((l) => ({
        product_id: l.product_id,
        product_variant_id: l.product_variant_id ?? null,
        quantity: l.quantity,
        expected_unit_price: l.expected_unit_price,
      })),
      payments,
      enforcePrice: dto.exchange.lines.some(
        (l) => l.expected_unit_price != null,
      ),
    };
  }

  private async exchangeTotals(
    db: Db,
    order: LoadedOrder,
    dto: ReturnRequestDto,
    actor: Actor,
  ) {
    const draft = this.exchangeDraft(order, dto, actor, null, 'preview', 0);
    const totals = await this.posting.computeTotals(
      db as Tx,
      { ...draft, enforcePrice: false },
      order.customer_id,
    );
    return {
      total: totals.total,
      lines: totals.lines.map((l) => ({
        product_id: l.price.productId,
        product_variant_id: l.price.variantId,
        name: l.price.name,
        sku: l.price.sku,
        quantity: l.input.quantity,
        unit_price: l.unitPrice,
        price_book_name: l.price.priceBookName,
        line_total: l.lineTotal,
      })),
    };
  }

  private async postExchange(
    tx: Tx,
    order: LoadedOrder,
    dto: ReturnRequestDto,
    actor: Actor,
    shiftId: string | null,
    number: string,
    available: number,
    at: Date,
  ) {
    if (!order.store_id)
      throw new ReturnRuleException('Đơn gốc không có chi nhánh');
    const probe = this.exchangeDraft(order, dto, actor, shiftId, number, 0);
    const totals = await this.posting.computeTotals(
      tx,
      probe,
      order.customer_id,
    );
    const applied = Math.min(available, totals.total);
    const created = await this.posting.createOrderIn(tx, {
      ...this.exchangeDraft(order, dto, actor, shiftId, number, applied),
      at,
    });
    return { orderId: created.id, applied };
  }

  private async postRefunds(
    tx: Tx,
    returnId: string,
    number: string,
    order: LoadedOrder,
    dto: ReturnRequestDto,
    due: number,
    actor: Actor,
    at: Date,
  ): Promise<number> {
    const refunds = dto.refunds ?? [];
    const sum = refunds.reduce((s, r) => s + r.amount, 0);
    if (Math.abs(sum - due) > 0.5)
      throw new ReturnRuleException(
        `Cần hoàn ${due.toLocaleString('vi-VN')} đ nhưng các khoản hoàn cộng lại ${sum.toLocaleString('vi-VN')} đ`,
      );
    for (const r of refunds) {
      if (r.method === 'store_credit') {
        if (!order.customer_id)
          throw new ReturnRuleException(
            'Giữ tiền cho khách cần đơn có khách hàng',
          );
        await moveCustomerCredit(tx, {
          customerId: order.customer_id,
          amount: r.amount,
          sourceType: 'sales_return',
          sourceId: returnId,
          note: `Trả hàng ${number}`,
          createdBy: actor.id,
        });
      } else {
        await this.cashBook.post(tx, {
          storeId: order.store_id,
          method: r.method,
          accountId: r.cash_account_id ?? null,
          direction: 'out',
          amount: r.amount,
          categoryCode: 'sales_return',
          counterparty: order.customer_id
            ? {
                type: 'customer',
                id: order.customer_id,
                name: order.customer_name,
              }
            : { type: 'other', name: order.customer_name },
          source: { type: 'sales_return', id: returnId },
          linkOpenShiftOf: actor.id,
          isAutomatic: true,
          note: `Trả hàng ${number} · đơn ${order.order_number}`,
          createdBy: actor.id,
          at,
        });
      }
      await tx.sales_return_refunds.create({
        data: {
          sales_return_id: returnId,
          method: r.method,
          amount: new Prisma.Decimal(r.amount),
          cash_account_id: r.cash_account_id ?? null,
        },
      });
    }
    return sum;
  }
}
