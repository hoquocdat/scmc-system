import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CashAccountNotConfiguredException,
  CashBookRuleException,
} from './cash-book.errors';

type Tx = Prisma.TransactionClient;

export type CashDirection = 'in' | 'out';
export type CounterpartyType = 'customer' | 'supplier' | 'employee' | 'other';

/** Payment methods as stored by the money writers, normalised to the mapping keys. */
export const CASH_BOOK_METHODS = [
  'cash',
  'card',
  'bank_transfer',
  'ewallet_momo',
  'ewallet_zalopay',
  'ewallet_vnpay',
] as const;
export type CashBookMethod = (typeof CASH_BOOK_METHODS)[number];

export function normalizeMethod(
  method: string | null | undefined,
): CashBookMethod {
  const m = (method ?? '').toLowerCase();
  if (m === 'transfer') return 'bank_transfer';
  if ((CASH_BOOK_METHODS as readonly string[]).includes(m))
    return m as CashBookMethod;
  throw new CashAccountNotConfiguredException(
    `Phương thức thanh toán không hỗ trợ: ${method}`,
  );
}

export interface PostInput {
  /** Branch the money belongs to; resolved from the account when an account is chosen. */
  storeId?: string | null;
  /** Payment method used to pick the account through the branch mapping. */
  method?: string | null;
  /** Explicit account (overrides the mapping). */
  accountId?: string | null;
  direction: CashDirection;
  amount: number;
  categoryCode: string;
  counterparty?: {
    type: CounterpartyType;
    id?: string | null;
    name?: string | null;
  } | null;
  source?: { type: string; id: string } | null;
  posSessionId?: string | null;
  /** Link the entry to this user's open shift at the branch when it lands on the POS drawer. */
  linkOpenShiftOf?: string | null;
  transferGroupId?: string | null;
  reversesEntryId?: string | null;
  isAutomatic: boolean;
  isOpening?: boolean;
  note?: string | null;
  createdBy?: string | null;
  at?: Date;
}

const VN_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Writes cash book entries for every money flow, inside the caller's
 * transaction (design D2): resolves the account (explicit, else branch mapping
 * for the method), numbers the entry PT/PC-YYYYMMDD-NNNN, links the POS shift.
 */
@Injectable()
export class CashBookPostingService {
  constructor(private readonly prisma: PrismaService) {}

  async defaultStoreId(tx: Tx): Promise<string> {
    const store =
      (await tx.stores.findFirst({
        where: { is_default: true, is_active: true },
      })) ??
      (await tx.stores.findFirst({
        where: { is_active: true },
        orderBy: { created_at: 'asc' },
      }));
    if (!store)
      throw new CashAccountNotConfiguredException(
        'Chưa có chi nhánh nào để ghi sổ quỹ',
      );
    return store.id;
  }

  /** Account for an entry: the explicit one, else the branch's mapping for the method. */
  async resolveAccount(
    tx: Tx,
    input: {
      storeId?: string | null;
      method?: string | null;
      accountId?: string | null;
    },
  ) {
    if (input.accountId) {
      const account = await tx.cash_book_accounts.findFirst({
        where: { id: input.accountId },
      });
      if (!account)
        throw new CashAccountNotConfiguredException(
          'Không tìm thấy tài khoản quỹ',
        );
      if (!account.is_active)
        throw new CashAccountNotConfiguredException(
          `Tài khoản quỹ "${account.name}" đã ngưng sử dụng`,
        );
      if (input.storeId && account.store_id !== input.storeId) {
        throw new CashBookRuleException(
          `Tài khoản quỹ "${account.name}" thuộc chi nhánh khác`,
        );
      }
      return account;
    }
    const storeId = input.storeId ?? (await this.defaultStoreId(tx));
    const method = normalizeMethod(input.method ?? 'cash');
    const mapping = await tx.cash_book_method_accounts.findFirst({
      where: { store_id: storeId, payment_method: method },
      include: { cash_book_accounts: true },
    });
    if (!mapping) {
      const store = await tx.stores.findFirst({
        where: { id: storeId },
        select: { name: true },
      });
      throw new CashAccountNotConfiguredException(
        `Chi nhánh "${store?.name ?? storeId}" chưa gán tài khoản quỹ cho phương thức ${method}`,
      );
    }
    if (!mapping.cash_book_accounts.is_active) {
      throw new CashAccountNotConfiguredException(
        `Tài khoản quỹ "${mapping.cash_book_accounts.name}" (phương thức ${method}) đã ngưng sử dụng`,
      );
    }
    return mapping.cash_book_accounts;
  }

  async categoryId(
    tx: Tx,
    code: string,
    direction: CashDirection,
  ): Promise<string> {
    const category = await tx.cash_book_categories.findFirst({
      where: { code, direction },
    });
    if (!category)
      throw new CashBookRuleException(
        `Không có danh mục thu/chi "${code}" (${direction})`,
      );
    return category.id;
  }

  async nextNumber(
    tx: Tx,
    direction: CashDirection,
    at: Date,
  ): Promise<string> {
    const prefix = direction === 'in' ? 'PT' : 'PC';
    const period = VN_DATE.format(at).replace(/-/g, '');
    const rows = await tx.$queryRaw<
      { n: number }[]
    >`SELECT next_document_number(${prefix}, ${period}) AS n`;
    return `${prefix}-${period}-${String(rows[0].n).padStart(4, '0')}`;
  }

  async post(tx: Tx, input: PostInput) {
    if (!(input.amount > 0))
      throw new CashBookRuleException('Số tiền phải lớn hơn 0');
    const amount = Math.round(input.amount * 100) / 100;
    const account = await this.resolveAccount(tx, input);
    const at = input.at ?? new Date();

    let posSessionId = input.posSessionId ?? null;
    if (!posSessionId && input.linkOpenShiftOf && account.is_pos_drawer) {
      const shift = await tx.pos_sessions.findFirst({
        where: {
          user_id: input.linkOpenShiftOf,
          store_id: account.store_id,
          status: 'open',
        },
        select: { id: true },
      });
      posSessionId = shift?.id ?? null;
    }

    // Prisma batches findUnique across concurrent interactive transactions, which can stall a
    // transaction holding the document counter lock; all lookups here use findFirst, and the
    // counter is taken last so its row lock is held as briefly as possible.
    const categoryId = await this.categoryId(
      tx,
      input.categoryCode,
      input.direction,
    );
    const entryNumber = await this.nextNumber(tx, input.direction, at);
    return tx.cash_book_entries.create({
      data: {
        entry_number: entryNumber,
        account_id: account.id,
        store_id: account.store_id,
        direction: input.direction,
        amount: new Prisma.Decimal(amount),
        entry_date: at,
        category_id: categoryId,
        counterparty_type: input.counterparty?.type ?? null,
        counterparty_id: input.counterparty?.id ?? null,
        counterparty_name: input.counterparty?.name ?? null,
        source_type: input.source?.type ?? null,
        source_id: input.source?.id ?? null,
        pos_session_id: posSessionId,
        transfer_group_id: input.transferGroupId ?? null,
        reverses_entry_id: input.reversesEntryId ?? null,
        is_automatic: input.isAutomatic,
        is_opening: input.isOpening ?? false,
        note: input.note ?? null,
        created_by: input.createdBy ?? null,
      },
    });
  }

  /**
   * Reverses every posted automatic entry of a source that is not reversed yet
   * (for example a deleted workshop payment), with opposite-direction entries.
   */
  async reverse(
    tx: Tx,
    sourceType: string,
    sourceId: string,
    reason: string,
    by?: string | null,
  ) {
    const entries = await tx.cash_book_entries.findMany({
      where: {
        source_type: sourceType,
        source_id: sourceId,
        status: 'posted',
        is_automatic: true,
        reverses_entry_id: null,
      },
    });
    const created: Awaited<ReturnType<CashBookPostingService['post']>>[] = [];
    for (const e of entries) {
      const already = await tx.cash_book_entries.count({
        where: { reverses_entry_id: e.id, status: 'posted' },
      });
      if (already > 0) continue;
      const direction: CashDirection = e.direction === 'in' ? 'out' : 'in';
      created.push(
        await this.post(tx, {
          accountId: e.account_id,
          direction,
          amount: Number(e.amount),
          categoryCode: 'reversal',
          counterparty: e.counterparty_type
            ? {
                type: e.counterparty_type as CounterpartyType,
                id: e.counterparty_id,
                name: e.counterparty_name,
              }
            : null,
          source: { type: sourceType, id: sourceId },
          posSessionId: e.pos_session_id,
          reversesEntryId: e.id,
          isAutomatic: true,
          note: `Đảo ${e.entry_number}: ${reason}`,
          createdBy: by,
        }),
      );
    }
    return created;
  }

  /**
   * Receipt for one completed payment on a sales order (POS sale, back-office
   * payment or receivable collection). Amount is what was applied to the order,
   * so cash change is already excluded. Linked to the order's shift, or to the
   * receiving user's open shift at the branch when the money lands in the drawer.
   */
  async postSalesOrderPayment(
    tx: Tx,
    input: {
      orderId: string;
      paymentId: string;
      method: string;
      amount: number;
      categoryCode: 'sale' | 'receivable_collection';
      createdBy?: string | null;
      at?: Date;
    },
  ) {
    const order = await tx.sales_orders.findFirst({
      where: { id: input.orderId },
      select: {
        id: true,
        order_number: true,
        store_id: true,
        customer_id: true,
        customer_name: true,
        pos_session_id: true,
      },
    });
    if (!order)
      throw new CashBookRuleException('Không tìm thấy đơn hàng để ghi sổ quỹ');
    return this.post(tx, {
      storeId: order.store_id,
      method: input.method,
      direction: 'in',
      amount: input.amount,
      categoryCode: input.categoryCode,
      counterparty: order.customer_id
        ? { type: 'customer', id: order.customer_id, name: order.customer_name }
        : { type: 'other', name: order.customer_name },
      source: { type: 'sales_order_payment', id: input.paymentId },
      posSessionId: order.pos_session_id,
      linkOpenShiftOf: input.createdBy,
      isAutomatic: true,
      note: `${input.categoryCode === 'sale' ? 'Thanh toán' : 'Thu nợ'} đơn ${order.order_number}`,
      createdBy: input.createdBy,
      at: input.at,
    });
  }

  /**
   * Moves money between two accounts: a payment on the source and a receipt on
   * the destination sharing a transfer_group_id (design D7).
   */
  async transfer(
    tx: Tx,
    input: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      note?: string | null;
      createdBy?: string | null;
      at?: Date;
      /** Shift to link on the drawer side (POS cash drop / float). */
      posSessionId?: string | null;
      sessionSide?: 'from' | 'to';
      isAutomatic?: boolean;
    },
  ) {
    if (input.fromAccountId === input.toAccountId) {
      throw new CashBookRuleException('Tài khoản nguồn và đích phải khác nhau');
    }
    const groupId = randomUUID();
    const out = await this.post(tx, {
      accountId: input.fromAccountId,
      direction: 'out',
      amount: input.amount,
      categoryCode: 'transfer_out',
      transferGroupId: groupId,
      posSessionId: input.sessionSide === 'from' ? input.posSessionId : null,
      isAutomatic: input.isAutomatic ?? false,
      note: input.note,
      createdBy: input.createdBy,
      at: input.at,
    });
    const inn = await this.post(tx, {
      accountId: input.toAccountId,
      direction: 'in',
      amount: input.amount,
      categoryCode: 'transfer_in',
      transferGroupId: groupId,
      posSessionId: input.sessionSide === 'to' ? input.posSessionId : null,
      isAutomatic: input.isAutomatic ?? false,
      note: input.note,
      createdBy: input.createdBy,
      at: input.at,
    });
    return { transferGroupId: groupId, out, in: inn };
  }

  /** The branch's POS drawer account. */
  async drawerOf(tx: Tx, storeId: string) {
    const drawer = await tx.cash_book_accounts.findFirst({
      where: { store_id: storeId, is_pos_drawer: true },
    });
    if (!drawer)
      throw new CashAccountNotConfiguredException(
        'Chi nhánh chưa có tài khoản tiền mặt quầy (POS drawer)',
      );
    if (!drawer.is_active)
      throw new CashAccountNotConfiguredException(
        `Tài khoản "${drawer.name}" đã ngưng sử dụng`,
      );
    return drawer;
  }

  /** Shorthand used by the money writers when they are not already in a transaction. */
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
