import { randomUUID } from 'crypto';
import { CashBookAccountsService } from '../../src/cash-book/cash-book-accounts.service';
import { CashBookPostingService } from '../../src/cash-book/cash-book-posting.service';
import { CashAccountNotConfiguredException } from '../../src/cash-book/cash-book.errors';
import {
  Action,
  CaslAbilityFactory,
} from '../../src/casl/casl-ability.factory';
import { PrismaService } from '../../src/prisma/prisma.service';
import { StoresService } from '../../src/stores/stores.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

describe('cash book core', () => {
  let fx: SalesFixtures;
  let posting: CashBookPostingService;
  let accounts: CashBookAccountsService;
  const prisma = () => testDb as unknown as PrismaService;

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    posting = new CashBookPostingService(prisma());
    accounts = new CashBookAccountsService(prisma());
  });
  afterAll(closeTestDb);

  it('grants cash book actions per role as designed', async () => {
    const casl = new CaslAbilityFactory(prisma());
    const matrix: Record<string, Action[]> = {
      manager: [
        Action.Read,
        Action.Receive,
        Action.Pay,
        Action.Transfer,
        Action.Cancel,
        Action.Configure,
      ],
      finance: [
        Action.Read,
        Action.Receive,
        Action.Pay,
        Action.Transfer,
        Action.Cancel,
        Action.Configure,
      ],
      store_manager: [Action.Read, Action.Receive, Action.Transfer],
      sales_associate: [],
      technician: [],
    };
    for (const [role, allowed] of Object.entries(matrix)) {
      const ability = await casl.createForUser(fx.users[role]);
      for (const action of [
        Action.Read,
        Action.Receive,
        Action.Pay,
        Action.Transfer,
        Action.Cancel,
        Action.Configure,
      ]) {
        expect({ role, action, can: ability.can(action, 'cash_book') }).toEqual(
          { role, action, can: allowed.includes(action) },
        );
      }
    }
  });

  it('resolves the account from the branch mapping and normalises "transfer"', async () => {
    const card = await testDb.$transaction((tx) =>
      posting.post(tx, {
        storeId: fx.store.id,
        method: 'card',
        direction: 'in',
        amount: 1_000_000,
        categoryCode: 'sale',
        isAutomatic: true,
      }),
    );
    expect(card.account_id).toBe(fx.accounts.hcmBank);
    expect(card.entry_number).toMatch(/^PT-\d{8}-\d{4}$/);

    const transfer = await testDb.$transaction((tx) =>
      posting.post(tx, {
        storeId: fx.store2.id,
        method: 'transfer',
        direction: 'in',
        amount: 10,
        categoryCode: 'workshop_service',
        isAutomatic: true,
      }),
    );
    expect(transfer.account_id).toBe(fx.accounts.hnBank);

    const cash = await testDb.$transaction((tx) =>
      posting.post(tx, {
        storeId: fx.store.id,
        method: 'cash',
        direction: 'out',
        amount: 5,
        categoryCode: 'shift_cash_out',
        isAutomatic: true,
      }),
    );
    expect(cash.account_id).toBe(fx.accounts.hcmDrawer);
    expect(cash.entry_number).toMatch(/^PC-/);
  });

  it('refuses a missing mapping, an inactive account and an account of another branch', async () => {
    await testDb.cash_book_method_accounts.delete({
      where: {
        store_id_payment_method: {
          store_id: fx.store2.id,
          payment_method: 'ewallet_vnpay',
        },
      },
    });
    await expect(
      testDb.$transaction((tx) =>
        posting.post(tx, {
          storeId: fx.store2.id,
          method: 'ewallet_vnpay',
          direction: 'in',
          amount: 1,
          categoryCode: 'sale',
          isAutomatic: true,
        }),
      ),
    ).rejects.toBeInstanceOf(CashAccountNotConfiguredException);

    await testDb.cash_book_accounts.update({
      where: { id: fx.accounts.hnBank },
      data: { is_active: false },
    });
    await expect(
      testDb.$transaction((tx) =>
        posting.post(tx, {
          storeId: fx.store2.id,
          method: 'card',
          direction: 'in',
          amount: 1,
          categoryCode: 'sale',
          isAutomatic: true,
        }),
      ),
    ).rejects.toBeInstanceOf(CashAccountNotConfiguredException);
    await testDb.cash_book_accounts.update({
      where: { id: fx.accounts.hnBank },
      data: { is_active: true },
    });

    await expect(
      testDb.$transaction((tx) =>
        posting.post(tx, {
          storeId: fx.store.id,
          accountId: fx.accounts.hnDrawer,
          direction: 'in',
          amount: 1,
          categoryCode: 'other_income',
          isAutomatic: false,
        }),
      ),
    ).rejects.toThrow(/chi nhánh khác/);
  });

  it('numbers 20 concurrent entries uniquely', async () => {
    const entries = await Promise.all(
      Array.from({ length: 20 }, () =>
        testDb.$transaction((tx) =>
          posting.post(tx, {
            storeId: fx.store.id,
            method: 'cash',
            direction: 'in',
            amount: 1_000,
            categoryCode: 'other_income',
            isAutomatic: false,
          }),
        ),
      ),
    );
    expect(new Set(entries.map((e) => e.entry_number)).size).toBe(20);
  });

  it('computes balances from the opening balance date, posted entries only', async () => {
    const acct = await testDb.cash_book_accounts.create({
      data: {
        store_id: fx.store.id,
        code: `SAFE-${randomUUID().slice(0, 6)}`,
        name: 'Két HCMC',
        type: 'cash',
      },
    });
    const post = (
      direction: 'in' | 'out',
      amount: number,
      at: string,
      extra: Partial<Parameters<CashBookPostingService['post']>[1]> = {},
    ) =>
      testDb.$transaction((tx) =>
        posting.post(tx, {
          accountId: acct.id,
          direction,
          amount,
          categoryCode: direction === 'in' ? 'other_income' : 'other_expense',
          isAutomatic: false,
          at: new Date(at),
          ...extra,
        }),
      );

    await post('in', 999_999, '2026-02-15T10:00:00+07:00'); // before the opening balance: not counted
    await post('in', 10_000_000, '2026-03-01T00:00:00+07:00', {
      categoryCode: 'opening_balance',
      isOpening: true,
    });
    await post('in', 5_000_000, '2026-03-10T10:00:00+07:00');
    await post('out', 2_000_000, '2026-03-20T10:00:00+07:00');
    const cancelled = await post('out', 700_000, '2026-03-21T10:00:00+07:00');
    await testDb.cash_book_entries.update({
      where: { id: cancelled.id },
      data: { status: 'cancelled' },
    });

    const endOfMarch = await accounts.balances({
      at: new Date('2026-04-01T00:00:00+07:00'),
      accountIds: [acct.id],
    });
    expect(endOfMarch.get(acct.id)?.balance).toBe(13_000_000);
    const midMarch = await accounts.balances({
      at: new Date('2026-03-15T00:00:00+07:00'),
      accountIds: [acct.id],
    });
    expect(midMarch.get(acct.id)?.balance).toBe(15_000_000);
  });

  it('creates a drawer, a bank account and a full mapping for a new branch', async () => {
    const stores = new StoresService(prisma(), accounts);
    const store = await stores.create({
      name: 'SCMC Da Nang',
      code: `DN${Date.now() % 10000}`,
    } as never);
    const accts = await testDb.cash_book_accounts.findMany({
      where: { store_id: store.id },
    });
    expect(accts.map((a) => [a.type, a.is_pos_drawer]).sort()).toEqual([
      ['bank', false],
      ['cash', true],
    ]);
    const map = await testDb.cash_book_method_accounts.findMany({
      where: { store_id: store.id },
    });
    expect(map).toHaveLength(6);
    const drawer = accts.find((a) => a.is_pos_drawer);
    expect(map.find((m) => m.payment_method === 'cash')?.account_id).toBe(
      drawer.id,
    );
    expect(
      map
        .filter((m) => m.payment_method !== 'cash')
        .every((m) => m.account_id !== drawer.id),
    ).toBe(true);
  });
});
