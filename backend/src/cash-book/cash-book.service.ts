import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { reportDateStart, ReportScope } from '../reports/report-scope';
import { col, ReportResult } from '../reports/report-types';
import { CashBookAccountsService } from './cash-book-accounts.service';
import {
  CashBookPostingService,
  CashDirection,
  CounterpartyType,
} from './cash-book-posting.service';
import {
  AutomaticEntryException,
  CashBookRuleException,
} from './cash-book.errors';
import {
  BalanceQueryDto,
  CancelEntryDto,
  CreateAccountDto,
  CreateCategoryDto,
  CreateOpeningBalanceDto,
  CreateTransferDto,
  CreateVoucherDto,
  EntryQueryDto,
  SetMethodAccountDto,
  UpdateAccountDto,
  UpdateCategoryDto,
} from './dto/cash-book.dto';

export interface Actor {
  id: string;
}

const entryInclude = {
  cash_book_accounts: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      is_pos_drawer: true,
    },
  },
  cash_book_categories: {
    select: { id: true, code: true, name: true, direction: true },
  },
  stores: { select: { id: true, name: true } },
  user_profiles_cash_book_entries_created_byTouser_profiles: {
    select: { id: true, full_name: true },
  },
  user_profiles_cash_book_entries_cancelled_byTouser_profiles: {
    select: { id: true, full_name: true },
  },
} satisfies Prisma.cash_book_entriesInclude;

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Cash book API: accounts, method mapping, categories, manual vouchers,
 * transfers, opening balances, cancellation, entries list and balances.
 */
@Injectable()
export class CashBookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: CashBookPostingService,
    private readonly accounts: CashBookAccountsService,
    private readonly activity: ActivityLogsService,
  ) {}

  private log(
    actor: Actor,
    entityType: string,
    entityId: string,
    action: string,
    newValues: Record<string, unknown>,
  ) {
    return this.activity.logActivity({
      userId: actor.id,
      entityType,
      entityId,
      action,
      newValues,
    });
  }

  // ==================== ACCOUNTS & MAPPING ====================

  async listAccounts(storeId?: string, at?: Date) {
    const accounts = await this.prisma.cash_book_accounts.findMany({
      where: storeId ? { store_id: storeId } : {},
      include: { stores: { select: { id: true, name: true, code: true } } },
      orderBy: [
        { store_id: 'asc' },
        { is_pos_drawer: 'desc' },
        { type: 'asc' },
        { name: 'asc' },
      ],
    });
    const balances = await this.accounts.balances({ storeId, at });
    return accounts.map((a) => ({
      ...a,
      balance: balances.get(a.id)?.balance ?? 0,
      opening_date: balances.get(a.id)?.openingDate ?? null,
    }));
  }

  async createAccount(actor: Actor, dto: CreateAccountDto) {
    const store = await this.prisma.stores.findFirst({
      where: { id: dto.store_id },
    });
    if (!store) throw new NotFoundException('Không tìm thấy chi nhánh');
    if (dto.is_pos_drawer && dto.type !== 'cash')
      throw new CashBookRuleException('Chỉ tài khoản tiền mặt mới là quầy POS');
    if (dto.is_pos_drawer) await this.assertNoOtherDrawer(dto.store_id);
    const account = await this.prisma.cash_book_accounts
      .create({ data: { ...dto, is_pos_drawer: dto.is_pos_drawer ?? false } })
      .catch((e: unknown) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        )
          throw new CashBookRuleException(
            `Mã tài khoản "${dto.code}" đã tồn tại`,
          );
        throw e;
      });
    await this.log(actor, 'cash_book_account', account.id, 'create', {
      ...dto,
    });
    return account;
  }

  private async assertNoOtherDrawer(storeId: string, exceptId?: string) {
    const other = await this.prisma.cash_book_accounts.findFirst({
      where: {
        store_id: storeId,
        is_pos_drawer: true,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
    });
    if (other)
      throw new CashBookRuleException(
        `Chi nhánh đã có tài khoản quầy POS "${other.name}"`,
      );
  }

  async updateAccount(actor: Actor, id: string, dto: UpdateAccountDto) {
    const account = await this.prisma.cash_book_accounts.findFirst({
      where: { id },
    });
    if (!account) throw new NotFoundException('Không tìm thấy tài khoản quỹ');
    if (dto.is_pos_drawer && account.type !== 'cash')
      throw new CashBookRuleException('Chỉ tài khoản tiền mặt mới là quầy POS');
    if (dto.is_pos_drawer && !account.is_pos_drawer)
      await this.assertNoOtherDrawer(account.store_id, id);
    if (dto.is_active === false) {
      const mapped = await this.prisma.cash_book_method_accounts.findMany({
        where: { account_id: id },
      });
      if (mapped.length) {
        throw new CashBookRuleException(
          `Tài khoản đang được gán cho phương thức ${mapped.map((m) => m.payment_method).join(', ')}; hãy gán tài khoản khác trước`,
        );
      }
      if (account.is_pos_drawer)
        throw new CashBookRuleException(
          'Không thể ngưng tài khoản quầy POS của chi nhánh',
        );
    }
    const updated = await this.prisma.cash_book_accounts.update({
      where: { id },
      data: { ...dto, updated_at: new Date() },
    });
    await this.log(actor, 'cash_book_account', id, 'update', { ...dto });
    return updated;
  }

  async methodMap(storeId?: string) {
    return this.prisma.cash_book_method_accounts.findMany({
      where: storeId ? { store_id: storeId } : {},
      include: {
        cash_book_accounts: { select: { id: true, name: true, type: true } },
        stores: { select: { id: true, name: true } },
      },
      orderBy: [{ store_id: 'asc' }, { payment_method: 'asc' }],
    });
  }

  async setMethodAccount(actor: Actor, dto: SetMethodAccountDto) {
    const account = await this.prisma.cash_book_accounts.findFirst({
      where: { id: dto.account_id },
    });
    if (!account) throw new NotFoundException('Không tìm thấy tài khoản quỹ');
    if (!account.is_active)
      throw new CashBookRuleException(
        'Không thể gán phương thức cho tài khoản đã ngưng sử dụng',
      );
    if (account.store_id !== dto.store_id)
      throw new CashBookRuleException('Tài khoản phải thuộc cùng chi nhánh');
    const row = await this.prisma.cash_book_method_accounts.upsert({
      where: {
        store_id_payment_method: {
          store_id: dto.store_id,
          payment_method: dto.payment_method,
        },
      },
      update: { account_id: dto.account_id, updated_at: new Date() },
      create: {
        store_id: dto.store_id,
        payment_method: dto.payment_method,
        account_id: dto.account_id,
      },
    });
    await this.log(actor, 'cash_book_account', dto.account_id, 'map_method', {
      ...dto,
    });
    return row;
  }

  // ==================== CATEGORIES ====================

  listCategories(direction?: 'in' | 'out') {
    return this.prisma.cash_book_categories.findMany({
      where: direction ? { direction } : {},
      orderBy: [{ direction: 'asc' }, { is_system: 'desc' }, { name: 'asc' }],
    });
  }

  async createCategory(actor: Actor, dto: CreateCategoryDto) {
    const code = `custom_${randomUUID().slice(0, 8)}`;
    const category = await this.prisma.cash_book_categories.create({
      data: { code, name: dto.name.trim(), direction: dto.direction },
    });
    await this.log(actor, 'cash_book_category', category.id, 'create', {
      ...dto,
    });
    return category;
  }

  async updateCategory(actor: Actor, id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.cash_book_categories.findFirst({
      where: { id },
    });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');
    if (category.is_system && dto.is_active === false)
      throw new CashBookRuleException('Không thể ngưng danh mục hệ thống');
    const updated = await this.prisma.cash_book_categories.update({
      where: { id },
      data: { ...dto, updated_at: new Date() },
    });
    await this.log(actor, 'cash_book_category', id, 'update', { ...dto });
    return updated;
  }

  async deleteCategory(actor: Actor, id: string) {
    const category = await this.prisma.cash_book_categories.findFirst({
      where: { id },
    });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');
    if (category.is_system)
      throw new CashBookRuleException('Không thể xóa danh mục hệ thống');
    const used = await this.prisma.cash_book_entries.count({
      where: { category_id: id },
    });
    if (used > 0)
      throw new CashBookRuleException(
        'Danh mục đã có phiếu; hãy ngưng sử dụng thay vì xóa',
      );
    await this.prisma.cash_book_categories.delete({ where: { id } });
    await this.log(actor, 'cash_book_category', id, 'delete', {
      name: category.name,
    });
    return { deleted: true };
  }

  // ==================== VOUCHERS / TRANSFERS / OPENING ====================

  async createVoucher(
    actor: Actor,
    direction: CashDirection,
    dto: CreateVoucherDto,
  ) {
    const category = await this.prisma.cash_book_categories.findFirst({
      where: { id: dto.category_id },
    });
    if (!category || !category.is_active)
      throw new CashBookRuleException('Danh mục không hợp lệ hoặc đã ngưng');
    if (category.direction !== direction)
      throw new CashBookRuleException(
        direction === 'in'
          ? 'Danh mục không phải danh mục thu'
          : 'Danh mục không phải danh mục chi',
      );
    const reserved = [
      'sale',
      'receivable_collection',
      'workshop_service',
      'shift_cash_in',
      'shift_cash_out',
      'opening_balance',
      'transfer_in',
      'transfer_out',
      'cash_count_difference',
      'reversal',
      'supplier_payment',
      'payroll',
    ];
    if (reserved.includes(category.code))
      throw new CashBookRuleException(
        'Danh mục này chỉ dùng cho phiếu tự động',
      );

    const entry = await this.prisma.$transaction((tx) =>
      this.posting.post(tx, {
        accountId: dto.account_id,
        direction,
        amount: dto.amount,
        categoryCode: category.code,
        counterparty: dto.counterparty_type
          ? {
              type: dto.counterparty_type as CounterpartyType,
              id: dto.counterparty_id,
              name: dto.counterparty_name,
            }
          : null,
        source: null,
        isAutomatic: false,
        // a drawer voucher recorded now belongs to the open shift (not a back-dated one)
        linkOpenShiftOf: dto.entry_date ? null : actor.id,
        note: dto.note,
        createdBy: actor.id,
        at: dto.entry_date ? new Date(dto.entry_date) : undefined,
      }),
    );
    await this.log(
      actor,
      'cash_book_entry',
      entry.id,
      direction === 'in' ? 'create_receipt' : 'create_payment',
      {
        entry_number: entry.entry_number,
        amount: dto.amount,
        account_id: dto.account_id,
      },
    );
    return this.getEntry(entry.id);
  }

  async createTransfer(actor: Actor, dto: CreateTransferDto) {
    const result = await this.prisma.$transaction((tx) =>
      this.posting.transfer(tx, {
        fromAccountId: dto.from_account_id,
        toAccountId: dto.to_account_id,
        amount: dto.amount,
        note: dto.note,
        createdBy: actor.id,
        linkOpenShiftOf: dto.entry_date ? null : actor.id,
        at: dto.entry_date ? new Date(dto.entry_date) : undefined,
      }),
    );
    await this.log(actor, 'cash_book_entry', result.out.id, 'create_transfer', {
      transfer_group_id: result.transferGroupId,
      amount: dto.amount,
      from: dto.from_account_id,
      to: dto.to_account_id,
    });
    return {
      transfer_group_id: result.transferGroupId,
      out: await this.getEntry(result.out.id),
      in: await this.getEntry(result.in.id),
    };
  }

  async createOpeningBalance(actor: Actor, dto: CreateOpeningBalanceDto) {
    const existing = await this.prisma.cash_book_entries.findFirst({
      where: { account_id: dto.account_id, is_opening: true, status: 'posted' },
    });
    if (existing)
      throw new CashBookRuleException(
        `Tài khoản đã có số dư đầu kỳ (${existing.entry_number}); hãy hủy trước khi nhập lại`,
      );
    const entry = await this.prisma.$transaction((tx) =>
      this.posting.post(tx, {
        accountId: dto.account_id,
        direction: 'in',
        amount: dto.amount,
        categoryCode: 'opening_balance',
        isAutomatic: false,
        isOpening: true,
        note: dto.note ?? 'Số dư đầu kỳ',
        createdBy: actor.id,
        at: reportDateStart(dto.date),
      }),
    );
    await this.log(actor, 'cash_book_entry', entry.id, 'opening_balance', {
      account_id: dto.account_id,
      amount: dto.amount,
      date: dto.date,
    });
    return this.getEntry(entry.id);
  }

  /** Cancels a manual voucher, a transfer (both sides) or an opening balance; automatic entries are refused. */
  async cancelEntry(actor: Actor, id: string, dto: CancelEntryDto) {
    const entry = await this.prisma.cash_book_entries.findFirst({
      where: { id },
    });
    if (!entry) throw new NotFoundException('Không tìm thấy phiếu');
    if (entry.is_automatic) throw new AutomaticEntryException();
    if (entry.status === 'cancelled')
      throw new CashBookRuleException('Phiếu đã bị hủy');
    const ids = entry.transfer_group_id
      ? (
          await this.prisma.cash_book_entries.findMany({
            where: { transfer_group_id: entry.transfer_group_id },
            select: { id: true },
          })
        ).map((e) => e.id)
      : [id];
    await this.prisma.cash_book_entries.updateMany({
      where: { id: { in: ids }, status: 'posted' },
      data: {
        status: 'cancelled',
        cancelled_at: new Date(),
        cancelled_by: actor.id,
        cancel_reason: dto.reason,
      },
    });
    await this.log(actor, 'cash_book_entry', id, 'cancel', {
      reason: dto.reason,
      entries: ids,
    });
    return this.getEntry(id);
  }

  // ==================== READ ====================

  async getEntry(id: string) {
    const entry = await this.prisma.cash_book_entries.findFirst({
      where: { id },
      include: entryInclude,
    });
    if (!entry) throw new NotFoundException('Không tìm thấy phiếu');
    const attachments = await this.prisma.images.findMany({
      where: { entity_type: 'cash_book_entry', entity_id: id },
      orderBy: { created_at: 'asc' },
    });
    return { ...entry, attachments };
  }

  async balances(q: BalanceQueryDto) {
    const at = q.date ? reportDateStart(addDays(q.date, 1)) : undefined;
    const accounts = await this.listAccounts(q.storeId, at);
    const byStore = new Map<
      string,
      { store_id: string; store_name: string; balance: number }
    >();
    for (const a of accounts) {
      const cur = byStore.get(a.store_id) ?? {
        store_id: a.store_id,
        store_name: a.stores?.name ?? '',
        balance: 0,
      };
      cur.balance += a.balance;
      byStore.set(a.store_id, cur);
    }
    return {
      at: at ?? new Date(),
      accounts,
      stores: [...byStore.values()],
      total: accounts.reduce((s, a) => s + a.balance, 0),
    };
  }

  /**
   * Entries in a period with filters; with one account selected: opening
   * balance at the start of the period, running balance per entry, totals and
   * closing balance. Shaped as a ReportResult so the export interceptor can
   * turn it into xlsx/csv.
   */
  async listEntries(q: EntryQueryDto, all = false): Promise<ReportResult> {
    const scope = new ReportScope({
      from: q.from,
      to: q.to,
      storeId: q.storeId,
    });
    const where: Prisma.cash_book_entriesWhereInput = {
      entry_date: { gte: scope.start, lt: scope.endExclusive },
      ...(q.storeId ? { store_id: q.storeId } : {}),
      ...(q.accountId ? { account_id: q.accountId } : {}),
      ...(q.direction ? { direction: q.direction } : {}),
      ...(q.categoryId ? { category_id: q.categoryId } : {}),
      ...(q.counterpartyType ? { counterparty_type: q.counterpartyType } : {}),
      ...(q.counterparty
        ? {
            counterparty_name: {
              contains: q.counterparty,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(q.sourceType
        ? q.sourceType === 'manual'
          ? { is_automatic: false }
          : { source_type: q.sourceType }
        : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const [total, rows, sums] = await Promise.all([
      this.prisma.cash_book_entries.count({ where }),
      this.prisma.cash_book_entries.findMany({
        where,
        include: entryInclude,
        orderBy: [{ entry_date: 'asc' }, { entry_number: 'asc' }],
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.cash_book_entries.groupBy({
        by: ['direction'],
        where: { ...where, status: 'posted' },
        _sum: { amount: true },
      }),
    ]);
    const receipts = Number(
      sums.find((s) => s.direction === 'in')?._sum.amount ?? 0,
    );
    const payments = Number(
      sums.find((s) => s.direction === 'out')?._sum.amount ?? 0,
    );

    let opening: number | null = null;
    let closing: number | null = null;
    const running = new Map<string, number>();
    if (q.accountId) {
      const startBal = await this.accounts.balances({
        at: scope.start,
        accountIds: [q.accountId],
      });
      opening = startBal.get(q.accountId)?.balance ?? 0;
      const openingDate = startBal.get(q.accountId)?.openingDate ?? null;
      // running balance over every posted entry of the period before this page
      const before =
        all || page === 1
          ? []
          : await this.prisma.cash_book_entries.findMany({
              where: { ...where, status: 'posted' },
              orderBy: [{ entry_date: 'asc' }, { entry_number: 'asc' }],
              take: (page - 1) * pageSize,
              select: { direction: true, amount: true, entry_date: true },
            });
      const counts = (d: Date) => !openingDate || d >= openingDate;
      let bal =
        opening +
        before
          .filter((e) => counts(e.entry_date))
          .reduce(
            (s, e) =>
              s + (e.direction === 'in' ? Number(e.amount) : -Number(e.amount)),
            0,
          );
      for (const e of rows) {
        if (e.status === 'posted' && counts(e.entry_date))
          bal += e.direction === 'in' ? Number(e.amount) : -Number(e.amount);
        running.set(e.id, bal);
      }
      const end = await this.accounts.balances({
        at: scope.endExclusive,
        accountIds: [q.accountId],
      });
      closing = end.get(q.accountId)?.balance ?? 0;
    }

    return {
      report: 'finance.cash-book',
      title: { vi: 'Sổ quỹ', en: 'Cash book' },
      scope: scope.toJSON(),
      columns: [
        col('entryDate', 'Thời gian', 'Date', 'datetime'),
        col('entryNumber', 'Số phiếu', 'Number'),
        col('account', 'Tài khoản', 'Account'),
        col('category', 'Loại thu chi', 'Category'),
        col('counterparty', 'Người nộp/nhận', 'Counterparty'),
        col('note', 'Diễn giải', 'Description'),
        col('receipt', 'Thu', 'In', 'money'),
        col('payment', 'Chi', 'Out', 'money'),
        ...(q.accountId
          ? [col('runningBalance', 'Tồn quỹ', 'Balance', 'money')]
          : []),
        col('status', 'Trạng thái', 'Status'),
      ],
      rows: rows.map((e) => ({
        id: e.id,
        entryDate: e.entry_date,
        entryNumber: e.entry_number,
        accountId: e.account_id,
        account: e.cash_book_accounts.name,
        storeId: e.store_id,
        store: e.stores.name,
        categoryCode: e.cash_book_categories.code,
        category: e.cash_book_categories.name,
        direction: e.direction,
        counterpartyType: e.counterparty_type,
        counterparty: e.counterparty_name ?? '',
        note: e.note ?? '',
        receipt: e.direction === 'in' ? Number(e.amount) : null,
        payment: e.direction === 'out' ? Number(e.amount) : null,
        runningBalance: q.accountId ? (running.get(e.id) ?? null) : null,
        status: e.status === 'posted' ? 'Đã ghi sổ' : 'Đã hủy',
        isCancelled: e.status === 'cancelled',
        isAutomatic: e.is_automatic,
        sourceType: e.source_type,
        sourceId: e.source_id,
        posSessionId: e.pos_session_id,
        transferGroupId: e.transfer_group_id,
        createdBy:
          e.user_profiles_cash_book_entries_created_byTouser_profiles
            ?.full_name ?? null,
        cancelReason: e.cancel_reason,
      })),
      totals: { receipt: receipts, payment: payments },
      meta: {
        page: all ? 1 : page,
        pageSize: all ? total : pageSize,
        total,
        opening,
        closing,
        receipts,
        payments,
        net: receipts - payments,
      },
    };
  }

  assertDirection(direction: string): CashDirection {
    if (direction !== 'in' && direction !== 'out')
      throw new BadRequestException('direction must be in or out');
    return direction;
  }
}
