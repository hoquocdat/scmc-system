import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CASH_BOOK_METHODS } from './cash-book-posting.service';

type Tx = Prisma.TransactionClient;

/** Balance and default-account helpers shared by the cash book and the modules that create branches. */
@Injectable()
export class CashBookAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /** A POS drawer and a bank account for a new branch, with every method mapped (design D5). */
  async createDefaultsFor(
    tx: Tx,
    store: { id: string; code: string; name: string },
  ) {
    const drawer = await tx.cash_book_accounts.create({
      data: {
        store_id: store.id,
        code: `${store.code}-CASH`,
        name: `Tiền mặt quầy ${store.name}`,
        type: 'cash',
        is_pos_drawer: true,
      },
    });
    const bank = await tx.cash_book_accounts.create({
      data: {
        store_id: store.id,
        code: `${store.code}-BANK`,
        name: `Ngân hàng ${store.name}`,
        type: 'bank',
      },
    });
    await tx.cash_book_method_accounts.createMany({
      data: CASH_BOOK_METHODS.map((m) => ({
        store_id: store.id,
        payment_method: m,
        account_id: m === 'cash' ? drawer.id : bank.id,
      })),
    });
    return { drawer, bank };
  }

  /**
   * Balance of each account at an instant (exclusive): opening balance plus
   * receipts minus payments, posted entries only, counting from the account's
   * opening balance date when it has one (design D6).
   */
  async balances(
    opts: { at?: Date; storeId?: string; accountIds?: string[] } = {},
    tx?: Tx,
  ) {
    const db = tx ?? this.prisma;
    const at = opts.at ?? new Date('9999-12-31T00:00:00Z');
    const rows = await db.$queryRaw<
      { account_id: string; balance: string; opening_date: Date | null }[]
    >`
      WITH opening AS (
        SELECT account_id, MIN(entry_date) AS opening_date
        FROM cash_book_entries WHERE is_opening AND status = 'posted' GROUP BY account_id
      )
      SELECT a.id AS account_id, o.opening_date,
             COALESCE(SUM(CASE WHEN e.direction = 'in' THEN e.amount ELSE -e.amount END), 0) AS balance
      FROM cash_book_accounts a
      LEFT JOIN opening o ON o.account_id = a.id
      LEFT JOIN cash_book_entries e
        ON e.account_id = a.id AND e.status = 'posted' AND e.entry_date < ${at}
       AND (o.opening_date IS NULL OR e.entry_date >= o.opening_date)
      WHERE 1 = 1
        ${opts.storeId ? Prisma.sql`AND a.store_id = ${opts.storeId}::uuid` : Prisma.empty}
        ${opts.accountIds?.length ? Prisma.sql`AND a.id = ANY(${opts.accountIds}::uuid[])` : Prisma.empty}
      GROUP BY a.id, o.opening_date`;
    return new Map(
      rows.map((r) => [
        r.account_id,
        { balance: Number(r.balance), openingDate: r.opening_date },
      ]),
    );
  }
}
