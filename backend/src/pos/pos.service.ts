import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CashBookPostingService } from '../cash-book/cash-book-posting.service';
import { Action, CaslAbilityFactory } from '../casl/casl-ability.factory';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePaymentMethod } from '../reports/report-types';
import { CashMovementDto, CashMovementType } from './dto/cash-movement.dto';
import { ClosePosSessionDto } from './dto/close-pos-session.dto';
import { OpenShiftDto } from './dto/open-shift.dto';
import {
  PosSessionQueryDto,
  PosSessionStatus,
} from './dto/pos-session-query.dto';

export interface PosUser {
  id: string;
}

const sessionInclude = {
  stores: true,
  stock_locations: true,
  user_profiles: true,
  user_profiles_pos_sessions_closed_byTouser_profiles: true,
  pos_session_transactions: { orderBy: { created_at: 'desc' as const } },
};

/**
 * Cashier shifts (pos_sessions): open, resume, cash in/out, close with
 * reconciliation, summaries. One open shift per user (unique index in 021).
 */
@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casl: CaslAbilityFactory,
    private readonly activity: ActivityLogsService,
    private readonly cashBook: CashBookPostingService,
  ) {}

  /** True when the user may see and close other users' shifts (pos:supervise). */
  async canManage(userId: string): Promise<boolean> {
    const ability = await this.casl.createForUser(userId);
    return ability.can(Action.Supervise, 'pos');
  }

  private async assertAccess(session: { user_id: string }, user: PosUser) {
    if (session.user_id === user.id) return;
    if (!(await this.canManage(user.id))) {
      throw new ForbiddenException(
        "You don't have permission to access another user's shift",
      );
    }
  }

  async openShift(user: PosUser, dto: OpenShiftDto) {
    const store = await this.prisma.stores.findUnique({
      where: { id: dto.store_id },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (!store.default_warehouse_id) {
      throw new BadRequestException(
        'Store has no selling location (default warehouse)',
      );
    }
    const existing = await this.prisma.pos_sessions.findFirst({
      where: { user_id: user.id, status: PosSessionStatus.OPEN },
      include: sessionInclude,
    });
    if (existing) {
      throw new ConflictException({
        message: 'Bạn đang có một ca mở',
        session: existing,
      });
    }
    try {
      const session = await this.prisma.pos_sessions.create({
        data: {
          session_number: await this.nextSessionNumber(),
          store_id: store.id,
          location_id: store.default_warehouse_id,
          user_id: user.id,
          opening_cash: new Prisma.Decimal(dto.opening_cash),
          status: PosSessionStatus.OPEN,
          notes: dto.notes,
        },
        include: sessionInclude,
      });
      await this.activity.logActivity({
        userId: user.id,
        entityType: 'pos_session',
        entityId: session.id,
        action: 'open',
        newValues: {
          store_id: store.id,
          opening_cash: dto.opening_cash,
          session_number: session.session_number,
        },
      });
      return session;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bạn đang có một ca mở');
      }
      throw error;
    }
  }

  /** PS-YYYYMMDD-NNNN from the shared document counter (never reused). */
  private async nextSessionNumber(): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ period: string; n: number }[]>`
      SELECT p.period, next_document_number('PS', p.period) AS n
      FROM (SELECT TO_CHAR((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYYMMDD') AS period) p`;
    return `PS-${rows[0].period}-${String(rows[0].n).padStart(4, '0')}`;
  }

  async getCurrentShift(user: PosUser) {
    const session = await this.prisma.pos_sessions.findFirst({
      where: { user_id: user.id, status: PosSessionStatus.OPEN },
      include: sessionInclude,
    });
    if (!session) throw new NotFoundException('Không có ca đang mở');
    return session;
  }

  async findAll(query: PosSessionQueryDto, user: PosUser) {
    const {
      page = 1,
      limit = 20,
      sort_by = 'opened_at',
      sort_order = 'desc',
      from_date,
      to_date,
      ...filters
    } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.pos_sessionsWhereInput = {};
    const manage = await this.canManage(user.id);
    where.user_id = manage ? filters.user_id : user.id;
    if (filters.location_id) where.location_id = filters.location_id;
    if (filters.store_id) where.store_id = filters.store_id;
    if (filters.status) where.status = filters.status;
    if (from_date || to_date) {
      where.opened_at = {};
      if (from_date) where.opened_at.gte = new Date(from_date);
      if (to_date) where.opened_at.lte = new Date(to_date);
    }
    const [sessions, total] = await Promise.all([
      this.prisma.pos_sessions.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: { stores: true, stock_locations: true, user_profiles: true },
      }),
      this.prisma.pos_sessions.count({ where }),
    ]);
    return {
      data: sessions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user?: PosUser) {
    const session = await this.prisma.pos_sessions.findUnique({
      where: { id },
      include: sessionInclude,
    });
    if (!session)
      throw new NotFoundException(`POS session with ID "${id}" not found`);
    if (user) await this.assertAccess(session, user);
    return session;
  }

  /**
   * Cash put into / taken out of the drawer during a shift, recorded in the
   * cash book on the branch's POS drawer (linked to the shift). With a target
   * account (e.g. the safe) it is a transfer between the drawer and that account.
   */
  async addCashMovement(user: PosUser, dto: CashMovementDto) {
    const session = await this.findOne(dto.pos_session_id, user);
    if (session.status !== PosSessionStatus.OPEN) {
      throw new ConflictException('Ca đã đóng, không thể ghi nhận thu/chi');
    }
    if (!(dto.amount > 0))
      throw new BadRequestException('Số tiền phải lớn hơn 0');
    if (!session.store_id)
      throw new BadRequestException('Ca không gắn chi nhánh');
    const storeId = session.store_id;
    const isOut = dto.transaction_type === CashMovementType.CASH_OUT;
    const note = [dto.reason, dto.notes].filter(Boolean).join(' - ');

    const entry = await this.prisma.$transaction(async (tx) => {
      const drawer = await this.cashBook.drawerOf(tx, storeId);
      if (dto.target_account_id) {
        const target = await tx.cash_book_accounts.findFirst({
          where: { id: dto.target_account_id },
        });
        if (!target || target.store_id !== storeId) {
          throw new BadRequestException(
            'Tài khoản đích phải thuộc cùng chi nhánh',
          );
        }
        const t = await this.cashBook.transfer(tx, {
          fromAccountId: isOut ? drawer.id : target.id,
          toAccountId: isOut ? target.id : drawer.id,
          amount: dto.amount,
          note,
          createdBy: user.id,
          posSessionId: session.id,
          sessionSide: isOut ? 'from' : 'to',
          isAutomatic: true,
        });
        return isOut ? t.out : t.in;
      }
      return this.cashBook.post(tx, {
        accountId: drawer.id,
        direction: isOut ? 'out' : 'in',
        amount: dto.amount,
        categoryCode: isOut ? 'shift_cash_out' : 'shift_cash_in',
        source: { type: 'pos_session', id: session.id },
        posSessionId: session.id,
        isAutomatic: true,
        note,
        createdBy: user.id,
      });
    });

    await this.activity.logActivity({
      userId: user.id,
      entityType: 'pos_session',
      entityId: session.id,
      action: dto.transaction_type,
      newValues: {
        amount: dto.amount,
        reason: dto.reason,
        entry_number: entry.entry_number,
        target_account_id: dto.target_account_id,
      },
    });
    return entry;
  }

  /** Drawer entries of a shift (cash book, posted only), with category codes. */
  private async shiftDrawerEntries(sessionId: string, storeId: string | null) {
    if (!storeId) return [];
    const drawer = await this.prisma.cash_book_accounts.findFirst({
      where: { store_id: storeId, is_pos_drawer: true },
    });
    if (!drawer) return [];
    return this.prisma.cash_book_entries.findMany({
      where: {
        pos_session_id: sessionId,
        account_id: drawer.id,
        status: 'posted',
      },
      include: { cash_book_categories: true },
      orderBy: { entry_date: 'asc' },
    });
  }

  /** Sales, money per method, credit, movements and expected cash for a shift. */
  async getSummary(id: string, user?: PosUser) {
    const session = await this.findOne(id, user);
    const orders = await this.prisma.sales_orders.findMany({
      where: { pos_session_id: id, status: { not: 'cancelled' } },
      include: { sales_order_payments: true },
    });
    const byMethod = new Map<
      string,
      { method: string; amount: number; payments: number }
    >();
    let salesTotal = 0;
    let paidTotal = 0;
    for (const order of orders) {
      salesTotal += Number(order.total_amount);
      for (const p of order.sales_order_payments) {
        if (p.status !== 'completed') continue;
        const method = normalizePaymentMethod(p.payment_method);
        const amount = Number(p.amount);
        paidTotal += amount;
        const cur = byMethod.get(method) ?? { method, amount: 0, payments: 0 };
        cur.amount += amount;
        cur.payments += 1;
        byMethod.set(method, cur);
      }
    }

    // Expected cash comes from the cash book: every posted drawer entry linked to
    // the shift, except the closing difference entry itself.
    const entries = await this.shiftDrawerEntries(id, session.store_id);
    const counted = entries.filter(
      (e) => e.cash_book_categories.code !== 'cash_count_difference',
    );
    const signed = (e: { direction: string; amount: Prisma.Decimal }) =>
      e.direction === 'in' ? Number(e.amount) : -Number(e.amount);
    const cashReceived = counted
      .filter((e) => e.cash_book_categories.code === 'sale')
      .reduce((s, e) => s + signed(e), 0);
    const movements = counted.filter(
      (e) => e.cash_book_categories.code !== 'sale',
    );
    const cashIn = movements
      .filter((e) => e.direction === 'in')
      .reduce((s, e) => s + Number(e.amount), 0);
    const cashOut = movements
      .filter((e) => e.direction === 'out')
      .reduce((s, e) => s + Number(e.amount), 0);
    const expectedCash =
      Number(session.opening_cash ?? 0) +
      counted.reduce((s, e) => s + signed(e), 0);

    return {
      session_id: session.id,
      session_number: session.session_number,
      status: session.status,
      store: session.stores
        ? { id: session.stores.id, name: session.stores.name }
        : null,
      cashier: session.user_profiles
        ? {
            id: session.user_profiles.id,
            full_name: session.user_profiles.full_name,
          }
        : null,
      opened_at: session.opened_at,
      closed_at: session.closed_at,
      closed_by: session.user_profiles_pos_sessions_closed_byTouser_profiles
        ? {
            id: session.user_profiles_pos_sessions_closed_byTouser_profiles.id,
            full_name:
              session.user_profiles_pos_sessions_closed_byTouser_profiles
                .full_name,
          }
        : null,
      sales_count: orders.length,
      sales_total: salesTotal,
      paid_total: paidTotal,
      credit_given: Math.max(0, salesTotal - paidTotal),
      by_payment_method: [...byMethod.values()].sort(
        (a, b) => b.amount - a.amount,
      ),
      opening_cash: Number(session.opening_cash ?? 0),
      cash_received: cashReceived,
      cash_in: cashIn,
      cash_out: cashOut,
      movements: movements.map((e) => ({
        id: e.id,
        entry_number: e.entry_number,
        transaction_type: e.direction === 'in' ? 'cash_in' : 'cash_out',
        category: e.cash_book_categories.name,
        amount: e.direction === 'in' ? Number(e.amount) : -Number(e.amount),
        reason: e.note,
        created_at: e.entry_date,
      })),
      expected_cash: expectedCash,
      closing_cash:
        session.closing_cash != null ? Number(session.closing_cash) : null,
      cash_difference:
        session.status === PosSessionStatus.CLOSED &&
        session.cash_difference != null
          ? Number(session.cash_difference)
          : null,
    };
  }

  /** Closes a shift; a non-zero difference is booked on the drawer so its balance matches the count. */
  async closeShift(id: string, user: PosUser, dto: ClosePosSessionDto) {
    const session = await this.findOne(id, user);
    if (session.status === PosSessionStatus.CLOSED) {
      throw new ConflictException('Ca đã được đóng');
    }
    const summary = await this.getSummary(id);
    const difference =
      Math.round((dto.closing_cash - summary.expected_cash) * 100) / 100;
    const closed = await this.prisma.$transaction(async (tx) => {
      if (difference !== 0 && session.store_id) {
        const drawer = await this.cashBook.drawerOf(tx, session.store_id);
        await this.cashBook.post(tx, {
          accountId: drawer.id,
          direction: difference > 0 ? 'in' : 'out',
          amount: Math.abs(difference),
          categoryCode: 'cash_count_difference',
          source: { type: 'pos_session', id },
          posSessionId: id,
          isAutomatic: true,
          note: `Chênh lệch kiểm quỹ ca ${session.session_number}`,
          createdBy: user.id,
        });
      }
      return tx.pos_sessions.update({
        where: { id },
        data: {
          status: PosSessionStatus.CLOSED,
          closing_cash: new Prisma.Decimal(dto.closing_cash),
          expected_cash: new Prisma.Decimal(summary.expected_cash),
          cash_difference: new Prisma.Decimal(difference),
          closed_at: new Date(),
          closed_by: user.id,
          notes: dto.notes || session.notes,
        },
        include: sessionInclude,
      });
    });
    await this.activity.logActivity({
      userId: user.id,
      entityType: 'pos_session',
      entityId: id,
      action: 'close',
      newValues: {
        closing_cash: dto.closing_cash,
        expected_cash: summary.expected_cash,
        cash_difference: difference,
        closed_for: session.user_id,
      },
    });
    return closed;
  }
}
