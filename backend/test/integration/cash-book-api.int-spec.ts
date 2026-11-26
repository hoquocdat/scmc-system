import 'reflect-metadata';
import {
  ExecutionContext,
  ForbiddenException,
  StreamableFile,
} from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import { UserContextService } from '../../src/auth/user-context.service';
import { CashBookAccountsService } from '../../src/cash-book/cash-book-accounts.service';
import { CashBookPostingService } from '../../src/cash-book/cash-book-posting.service';
import { CashBookController } from '../../src/cash-book/cash-book.controller';
import { CashBookService } from '../../src/cash-book/cash-book.service';
import {
  AutomaticEntryException,
  CashBookRuleException,
} from '../../src/cash-book/cash-book.errors';
import {
  Action,
  CaslAbilityFactory,
} from '../../src/casl/casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
} from '../../src/casl/check-policies.decorator';
import { PaymentsService } from '../../src/payments/payments.service';
import { CashMovementType } from '../../src/pos/dto/cash-movement.dto';
import { PosService } from '../../src/pos/pos.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ExportService } from '../../src/reports/export.service';
import { toReportDate } from '../../src/reports/report-scope';
import { ReportExportInterceptor } from '../../src/reports/report-export.interceptor';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

describe('cash book API', () => {
  let fx: SalesFixtures;
  let svc: CashBookService;
  let posting: CashBookPostingService;
  let accounts: CashBookAccountsService;
  let shifts: PosService;
  let workshop: PaymentsService;
  let casl: CaslAbilityFactory;
  let safeId: string;
  let currentUser: string | null = null;
  const u = (role: string) => ({ id: fx.users[role] });
  const category = (code: string, direction: 'in' | 'out') =>
    testDb.cash_book_categories.findFirstOrThrow({
      where: { code, direction },
    });
  const balance = async (id: string) =>
    (await accounts.balances({ accountIds: [id] })).get(id)?.balance ?? 0;

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    posting = new CashBookPostingService(prisma);
    accounts = new CashBookAccountsService(prisma);
    casl = new CaslAbilityFactory(prisma);
    const activity = new ActivityLogsService(prisma);
    svc = new CashBookService(prisma, posting, accounts, activity);
    shifts = new PosService(prisma, casl, activity, posting);
    workshop = new PaymentsService(
      prisma,
      {
        getUserId: () => currentUser,
        getUser: () => null,
      } as unknown as UserContextService,
      posting,
    );
    const safe = await svc.createAccount(u('finance'), {
      store_id: fx.store.id,
      code: 'HCM-SAFE',
      name: 'Két HCMC',
      type: 'cash',
    });
    safeId = safe.id;
  });
  afterAll(closeTestDb);

  describe('vouchers, transfers, opening balances, cancellation', () => {
    it('records a payment voucher with a PC number and reduces the balance', async () => {
      const rent = await category('rent', 'out');
      const before = await balance(fx.accounts.hcmBank);
      const v = await svc.createVoucher(u('finance'), 'out', {
        account_id: fx.accounts.hcmBank,
        amount: 30_000_000,
        category_id: rent.id,
        counterparty_type: 'other',
        counterparty_name: 'Chủ nhà',
        note: 'Thuê tháng 12',
      });
      expect(v.entry_number).toMatch(/^PC-/);
      expect(v.is_automatic).toBe(false);
      expect(await balance(fx.accounts.hcmBank)).toBe(before - 30_000_000);
      expect(
        await testDb.activity_logs.count({
          where: { entity_id: v.id, action: 'create_payment' },
        }),
      ).toBe(1);
    });

    it('refuses a wrong-direction category and system categories on manual vouchers', async () => {
      const rent = await category('rent', 'out');
      await expect(
        svc.createVoucher(u('finance'), 'in', {
          account_id: safeId,
          amount: 1,
          category_id: rent.id,
        }),
      ).rejects.toBeInstanceOf(CashBookRuleException);
      const sale = await category('sale', 'in');
      await expect(
        svc.createVoucher(u('finance'), 'in', {
          account_id: safeId,
          amount: 1,
          category_id: sale.id,
        }),
      ).rejects.toBeInstanceOf(CashBookRuleException);
    });

    it('transfers drawer to safe with one reference, refuses the same account, cancels both sides', async () => {
      const drawerBefore = await balance(fx.accounts.hcmDrawer);
      const safeBefore = await balance(safeId);
      const t = await svc.createTransfer(u('store_manager'), {
        from_account_id: fx.accounts.hcmDrawer,
        to_account_id: safeId,
        amount: 5_000_000,
      });
      expect(t.out.transfer_group_id).toBe(t.in.transfer_group_id);
      expect(await balance(fx.accounts.hcmDrawer)).toBe(
        drawerBefore - 5_000_000,
      );
      expect(await balance(safeId)).toBe(safeBefore + 5_000_000);
      await expect(
        svc.createTransfer(u('finance'), {
          from_account_id: safeId,
          to_account_id: safeId,
          amount: 1,
        }),
      ).rejects.toBeInstanceOf(CashBookRuleException);

      await svc.cancelEntry(u('finance'), t.in.id, { reason: 'nhầm két' });
      const both = await testDb.cash_book_entries.findMany({
        where: { transfer_group_id: t.transfer_group_id },
      });
      expect(
        both.every(
          (e) => e.status === 'cancelled' && e.cancel_reason === 'nhầm két',
        ),
      ).toBe(true);
      expect(await balance(fx.accounts.hcmDrawer)).toBe(drawerBefore);
      expect(await balance(safeId)).toBe(safeBefore);
    });

    it('allows one opening balance per account until it is cancelled', async () => {
      const ob = await svc.createOpeningBalance(u('finance'), {
        account_id: safeId,
        amount: 50_000_000,
        date: '2026-01-01',
      });
      expect(ob.is_opening).toBe(true);
      await expect(
        svc.createOpeningBalance(u('finance'), {
          account_id: safeId,
          amount: 1,
          date: '2026-01-02',
        }),
      ).rejects.toBeInstanceOf(CashBookRuleException);
      await svc.cancelEntry(u('finance'), ob.id, { reason: 'nhập lại' });
      const again = await svc.createOpeningBalance(u('finance'), {
        account_id: safeId,
        amount: 50_000_000,
        date: '2026-01-01',
      });
      expect(again.status).toBe('posted');
    });

    it('cancelled vouchers stay listed with the reason and leave the balance', async () => {
      const other = await category('other_income', 'in');
      const before = await balance(safeId);
      const v = await svc.createVoucher(u('finance'), 'in', {
        account_id: safeId,
        amount: 777_000,
        category_id: other.id,
      });
      const cancelled = await svc.cancelEntry(u('finance'), v.id, {
        reason: 'nhập sai số tiền',
      });
      expect(cancelled).toMatchObject({
        status: 'cancelled',
        cancel_reason: 'nhập sai số tiền',
        cancelled_by: fx.users.finance,
      });
      expect(await balance(safeId)).toBe(before);
      await expect(
        svc.cancelEntry(u('finance'), v.id, { reason: 'again' }),
      ).rejects.toBeInstanceOf(CashBookRuleException);
    });

    it('refuses to cancel an automatic entry', async () => {
      currentUser = fx.users.store_manager;
      const bike = await testDb.bikes.create({
        data: {
          brand: 'Honda',
          model: 'CB',
          license_plate: `59-A${Date.now()}`,
          owner_id: fx.customers.member,
        },
      });
      const order = await testDb.service_orders.create({
        data: {
          order_number: `SVA-${Date.now()}`.slice(0, 20),
          motorcycle_id: bike.id,
          customer_id: fx.customers.member,
          store_id: fx.store.id,
        },
      });
      const p = await workshop.create({
        service_order_id: order.id,
        amount: 100_000,
        payment_method: 'card',
      } as never);
      const entry = await testDb.cash_book_entries.findFirstOrThrow({
        where: { source_id: p.id },
      });
      await expect(
        svc.cancelEntry(u('finance'), entry.id, { reason: 'x' }),
      ).rejects.toBeInstanceOf(AutomaticEntryException);
    });
  });

  describe('accounts, mapping and categories rules', () => {
    it('refuses a second POS drawer and deactivating a mapped or drawer account', async () => {
      await expect(
        svc.createAccount(u('finance'), {
          store_id: fx.store.id,
          code: 'HCM-CASH2',
          name: 'Quầy 2',
          type: 'cash',
          is_pos_drawer: true,
        }),
      ).rejects.toBeInstanceOf(CashBookRuleException);
      await expect(
        svc.updateAccount(u('finance'), fx.accounts.hcmBank, {
          is_active: false,
        }),
      ).rejects.toThrow(/gán cho phương thức/);
      await expect(
        svc.updateAccount(u('finance'), safeId, { is_pos_drawer: true }),
      ).rejects.toBeInstanceOf(CashBookRuleException);
    });

    it('maps a method only to an active account of the same branch', async () => {
      const momo = await svc.createAccount(u('finance'), {
        store_id: fx.store.id,
        code: 'HCM-MOMO',
        name: 'MoMo HCMC',
        type: 'ewallet',
      });
      await svc.setMethodAccount(u('finance'), {
        store_id: fx.store.id,
        payment_method: 'ewallet_momo',
        account_id: momo.id,
      });
      const e = await testDb.$transaction((tx) =>
        posting.post(tx, {
          storeId: fx.store.id,
          method: 'ewallet_momo',
          direction: 'in',
          amount: 10,
          categoryCode: 'sale',
          isAutomatic: true,
        }),
      );
      expect(e.account_id).toBe(momo.id);
      await expect(
        svc.setMethodAccount(u('finance'), {
          store_id: fx.store2.id,
          payment_method: 'ewallet_momo',
          account_id: momo.id,
        }),
      ).rejects.toThrow(/cùng chi nhánh/);
      const inactive = await svc.createAccount(u('finance'), {
        store_id: fx.store.id,
        code: 'HCM-OLD',
        name: 'Cũ',
        type: 'bank',
      });
      await svc.updateAccount(u('finance'), inactive.id, { is_active: false });
      await expect(
        svc.setMethodAccount(u('finance'), {
          store_id: fx.store.id,
          payment_method: 'cash',
          account_id: inactive.id,
        }),
      ).rejects.toThrow(/ngưng sử dụng/);
    });

    it('adds categories and protects system ones', async () => {
      const c = await svc.createCategory(u('finance'), {
        name: 'Điện nước',
        direction: 'out',
      });
      expect((await svc.listCategories('out')).some((x) => x.id === c.id)).toBe(
        true,
      );
      const sale = await category('sale', 'in');
      await expect(
        svc.deleteCategory(u('finance'), sale.id),
      ).rejects.toBeInstanceOf(CashBookRuleException);
      await expect(
        svc.updateCategory(u('finance'), sale.id, { is_active: false }),
      ).rejects.toBeInstanceOf(CashBookRuleException);
      await svc.deleteCategory(u('finance'), c.id);
    });
  });

  describe('list, statement and export', () => {
    it('shows an account statement with opening, running and closing balances', async () => {
      const acct = await svc.createAccount(u('finance'), {
        store_id: fx.store2.id,
        code: 'HN-SAFE',
        name: 'Két HN',
        type: 'cash',
      });
      const inc = await category('other_income', 'in');
      const exp = await category('other_expense', 'out');
      await svc.createOpeningBalance(u('finance'), {
        account_id: acct.id,
        amount: 10_000_000,
        date: '2026-03-01',
      });
      await svc.createVoucher(u('finance'), 'in', {
        account_id: acct.id,
        amount: 1_000_000,
        category_id: inc.id,
        entry_date: '2026-03-04T10:00:00+07:00',
      });
      await svc.createVoucher(u('finance'), 'in', {
        account_id: acct.id,
        amount: 5_000_000,
        category_id: inc.id,
        entry_date: '2026-03-05T09:00:00+07:00',
      });
      await svc.createVoucher(u('finance'), 'out', {
        account_id: acct.id,
        amount: 2_000_000,
        category_id: exp.id,
        entry_date: '2026-03-05T15:00:00+07:00',
      });
      await svc.createVoucher(u('finance'), 'out', {
        account_id: acct.id,
        amount: 300_000,
        category_id: exp.id,
        entry_date: '2026-03-05T23:30:00+07:00',
      });

      const r = await svc.listEntries({
        accountId: acct.id,
        from: '2026-03-05',
        to: '2026-03-05',
      });
      expect(r.meta).toMatchObject({
        opening: 11_000_000,
        receipts: 5_000_000,
        payments: 2_300_000,
        closing: 13_700_000,
        total: 3,
      });
      expect(r.rows.map((x) => x.runningBalance)).toEqual([
        16_000_000, 14_000_000, 13_700_000,
      ]);

      const page2 = await svc.listEntries({
        accountId: acct.id,
        from: '2026-03-05',
        to: '2026-03-05',
        page: 2,
        pageSize: 2,
      });
      expect(page2.rows.map((x) => x.runningBalance)).toEqual([13_700_000]);
    });

    it('filters by direction, category, source and status', async () => {
      const today = toReportDate(new Date());
      const manual = await svc.listEntries({
        from: '2026-01-01',
        to: today,
        sourceType: 'manual',
        status: 'cancelled',
      });
      expect(manual.rows.every((r) => r.isCancelled && !r.isAutomatic)).toBe(
        true,
      );
      const outs = await svc.listEntries({
        from: '2026-01-01',
        to: today,
        direction: 'out',
        storeId: fx.store.id,
      });
      expect(outs.rows.length).toBeGreaterThan(0);
      expect(
        outs.rows.every(
          (r) => r.direction === 'out' && r.storeId === fx.store.id,
        ),
      ).toBe(true);
    });

    it('exports every matching row through the report export interceptor', async () => {
      const prisma = testDb as unknown as PrismaService;
      const interceptor = new ReportExportInterceptor(
        new ExportService(),
        casl,
        new ActivityLogsService(prisma),
        prisma,
      );
      const q = {
        from: '2026-01-01',
        to: toReportDate(new Date()),
        pageSize: 1,
        format: 'csv' as const,
      };
      const result = await svc.listEntries(q, true);
      expect(result.rows.length).toBe(result.meta?.total);
      const req = {
        user: { id: fx.users.finance },
        query: q,
        ip: '::1',
        headers: {},
      };
      const res = { setHeader: () => undefined };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      } as unknown as ExecutionContext;
      const file = await lastValueFrom(
        await interceptor.intercept(ctx, { handle: () => of(result) }),
      );
      const chunks: Buffer[] = [];
      for await (const c of (file as StreamableFile).getStream())
        chunks.push(Buffer.from(c));
      const lines = Buffer.concat(chunks).toString('utf8').trim().split('\r\n');
      expect(lines.length).toBe(1 + result.rows.length + 1); // header + rows + totals

      const storeCtx = {
        switchToHttp: () => ({
          getRequest: () => ({ ...req, user: { id: fx.users.store_manager } }),
          getResponse: () => res,
        }),
      } as unknown as ExecutionContext;
      const out = await lastValueFrom(
        await interceptor.intercept(storeCtx, { handle: () => of(result) }),
      );
      expect(out).toBeInstanceOf(StreamableFile); // store manager has reports:export
      const assocCtx = {
        switchToHttp: () => ({
          getRequest: () => ({
            ...req,
            user: { id: fx.users.sales_associate },
          }),
          getResponse: () => res,
        }),
      } as unknown as ExecutionContext;
      await expect(
        interceptor.intercept(assocCtx, { handle: () => of(result) }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('POS shifts on the cash book', () => {
    it('a cash drop into the safe is a transfer linked to the shift', async () => {
      const shift = await shifts.openShift(u('sales_associate'), {
        store_id: fx.store.id,
        opening_cash: 1_000_000,
      });
      const safeBefore = await balance(safeId);
      const movement = await shifts.addCashMovement(u('sales_associate'), {
        pos_session_id: shift.id,
        transaction_type: CashMovementType.CASH_OUT,
        amount: 5_000_000,
        reason: 'nộp két',
        target_account_id: safeId,
      });
      expect(movement).toMatchObject({
        direction: 'out',
        account_id: fx.accounts.hcmDrawer,
        pos_session_id: shift.id,
      });
      const pair = await testDb.cash_book_entries.findMany({
        where: { transfer_group_id: movement.transfer_group_id },
      });
      expect(pair.map((e) => [e.account_id, e.direction]).sort()).toEqual(
        [
          [fx.accounts.hcmDrawer, 'out'],
          [safeId, 'in'],
        ].sort(),
      );
      expect(await balance(safeId)).toBe(safeBefore + 5_000_000);
      const summary = await shifts.getSummary(shift.id);
      expect(summary).toMatchObject({
        cash_out: 5_000_000,
        expected_cash: 1_000_000 - 5_000_000,
      });
      await expect(
        shifts.addCashMovement(u('sales_associate'), {
          pos_session_id: shift.id,
          transaction_type: CashMovementType.CASH_OUT,
          amount: 1,
          reason: 'x',
          target_account_id: fx.accounts.hnBank,
        }),
      ).rejects.toThrow(/cùng chi nhánh/);
    });

    it('workshop cash taken by the cashier during the shift counts in expected cash', async () => {
      currentUser = fx.users.sales_associate;
      const shift = await shifts.getCurrentShift(u('sales_associate'));
      const before = (await shifts.getSummary(shift.id)).expected_cash;
      const bike = await testDb.bikes.create({
        data: {
          brand: 'Honda',
          model: 'CB',
          license_plate: `59-S${Date.now()}`,
          owner_id: fx.customers.member,
        },
      });
      const order = await testDb.service_orders.create({
        data: {
          order_number: `SVS-${Date.now()}`.slice(0, 20),
          motorcycle_id: bike.id,
          customer_id: fx.customers.member,
          store_id: fx.store.id,
        },
      });
      await workshop.create({
        service_order_id: order.id,
        amount: 500_000,
        payment_method: 'cash',
        is_deposit: true,
      } as never);
      expect((await shifts.getSummary(shift.id)).expected_cash).toBe(
        before + 500_000,
      );
    });

    it('closing short books a "Chênh lệch kiểm quỹ" payment; an exact count books nothing', async () => {
      const shift = await shifts.getCurrentShift(u('sales_associate'));
      const expected = (await shifts.getSummary(shift.id)).expected_cash;
      const drawerBefore = await balance(fx.accounts.hcmDrawer);
      const closed = await shifts.closeShift(shift.id, u('sales_associate'), {
        closing_cash: expected - 50_000,
      });
      expect(Number(closed.cash_difference)).toBe(-50_000);
      const diff = await testDb.cash_book_entries.findMany({
        where: {
          pos_session_id: shift.id,
          cash_book_categories: { code: 'cash_count_difference' },
        },
      });
      expect(diff).toHaveLength(1);
      expect(diff[0]).toMatchObject({
        direction: 'out',
        account_id: fx.accounts.hcmDrawer,
      });
      expect(Number(diff[0].amount)).toBe(50_000);
      expect(await balance(fx.accounts.hcmDrawer)).toBe(drawerBefore - 50_000);

      const exact = await shifts.openShift(u('sales_associate'), {
        store_id: fx.store.id,
        opening_cash: 300_000,
      });
      await shifts.closeShift(exact.id, u('sales_associate'), {
        closing_cash: 300_000,
      });
      expect(
        await testDb.cash_book_entries.count({
          where: { pos_session_id: exact.id },
        }),
      ).toBe(0);
    });
  });

  it('declares a cash_book policy on every endpoint with the designed actions', () => {
    const proto = CashBookController.prototype;
    const expected: Record<string, Action> = {
      listEntries: Action.Read,
      getEntry: Action.Read,
      balances: Action.Read,
      listAccounts: Action.Read,
      methodMap: Action.Read,
      listCategories: Action.Read,
      createReceipt: Action.Receive,
      createPayment: Action.Pay,
      createTransfer: Action.Transfer,
      cancel: Action.Cancel,
      createOpeningBalance: Action.Configure,
      createAccount: Action.Configure,
      updateAccount: Action.Configure,
      setMethodAccount: Action.Configure,
      createCategory: Action.Configure,
      updateCategory: Action.Configure,
      deleteCategory: Action.Configure,
    };
    for (const name of Object.getOwnPropertyNames(proto).filter(
      (n) => n !== 'constructor',
    )) {
      const policies = Reflect.getMetadata(
        CHECK_POLICIES_KEY,
        proto[name as keyof typeof proto] as unknown as object,
      ) as PolicyHandler[];
      expect({ name, policy: policies?.[0] }).toEqual({
        name,
        policy: { action: expected[name], subject: 'cash_book' },
      });
    }
  });
});
