import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import { UserContextService } from '../../src/auth/user-context.service';
import { CashBookAccountsService } from '../../src/cash-book/cash-book-accounts.service';
import { CashBookPostingService } from '../../src/cash-book/cash-book-posting.service';
import { CaslAbilityFactory } from '../../src/casl/casl-ability.factory';
import { CustomersService } from '../../src/customers/customers.service';
import { LoyaltyService } from '../../src/loyalty/loyalty.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { PayrollService } from '../../src/payroll/payroll.service';
import { PosCheckoutService } from '../../src/pos/pos-checkout.service';
import { CheckoutPaymentMethod } from '../../src/pos/dto/checkout.dto';
import { PosService } from '../../src/pos/pos.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PaymentMethod } from '../../src/sales/dto/create-payment.dto';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { SalesService } from '../../src/sales/sales.service';
import { SupplierPaymentMethod } from '../../src/supplier-payments/dto/create-supplier-payment.dto';
import { SupplierPaymentsService } from '../../src/supplier-payments/supplier-payments.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

const D = (n: number) => new Prisma.Decimal(n);

/** Every money flow writes its cash book entry in the same transaction (spec finance/cash-book). */
describe('cash book entries from money flows', () => {
  let fx: SalesFixtures;
  let cashBook: CashBookPostingService;
  let accounts: CashBookAccountsService;
  let checkout: PosCheckoutService;
  let shifts: PosService;
  let sales: SalesService;
  let customers: CustomersService;
  let workshop: PaymentsService;
  let suppliers: SupplierPaymentsService;
  let payroll: PayrollService;
  let currentUser: string | null = null;

  const entriesFor = (sourceType: string, sourceId: string) =>
    testDb.cash_book_entries.findMany({
      where: { source_type: sourceType, source_id: sourceId },
      include: { cash_book_categories: true, cash_book_accounts: true },
      orderBy: { created_at: 'asc' },
    });
  const balance = async (accountId: string) =>
    (await accounts.balances({ accountIds: [accountId] })).get(accountId)
      ?.balance ?? 0;

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    const userContext = {
      getUserId: () => currentUser,
      getUser: () => null,
    } as unknown as UserContextService;
    cashBook = new CashBookPostingService(prisma);
    accounts = new CashBookAccountsService(prisma);
    const loyalty = new LoyaltyService(prisma);
    const posting = new SalesPostingService(
      prisma,
      new PriceResolverService(prisma),
      loyalty,
      cashBook,
    );
    const casl = new CaslAbilityFactory(prisma);
    const activity = new ActivityLogsService(prisma);
    shifts = new PosService(prisma, casl, activity, cashBook);
    checkout = new PosCheckoutService(prisma, posting, casl, activity, {
      get: () => 'secret',
    } as unknown as ConfigService);
    sales = new SalesService(prisma, userContext, loyalty, posting, cashBook);
    customers = new CustomersService(prisma, userContext, cashBook);
    workshop = new PaymentsService(prisma, userContext, cashBook);
    suppliers = new SupplierPaymentsService(prisma, cashBook);
    payroll = new PayrollService(prisma, cashBook, {} as never);
    await testDb.inventory.updateMany({
      where: { location_id: fx.store.locationId },
      data: { quantity_on_hand: 500 },
    });
  });
  afterAll(closeTestDb);

  it('a POS cash sale posts one receipt net of change, on the drawer, linked to order and shift', async () => {
    const shift = await shifts.openShift(
      { id: fx.users.sales_associate },
      { store_id: fx.store.id, opening_cash: 0 },
    );
    const order = await checkout.checkout(
      { id: fx.users.sales_associate },
      {
        client_request_id: randomUUID(),
        lines: [
          {
            product_id: fx.products.sticker,
            quantity: 9,
            expected_unit_price: 50_000,
          },
        ],
        payments: [
          {
            method: CheckoutPaymentMethod.CASH,
            amount: 450_000,
            amount_tendered: 500_000,
          },
        ],
      },
    );
    const payment = order.sales_order_payments[0];
    const [entry] = await entriesFor('sales_order_payment', payment.id);
    expect(entry).toMatchObject({
      direction: 'in',
      account_id: fx.accounts.hcmDrawer,
      pos_session_id: shift.id,
      is_automatic: true,
    });
    expect(Number(entry.amount)).toBe(450_000);
    expect(entry.cash_book_categories.code).toBe('sale');
    expect(entry.entry_number).toMatch(/^PT-/);
  });

  it('a manager paying from the drawer during a cashier shift is counted in that shift', async () => {
    const shift =
      (await testDb.pos_sessions.findFirst({
        where: { store_id: fx.store.id, status: 'open' },
      })) ??
      (await shifts.openShift(
        { id: fx.users.sales_associate },
        { store_id: fx.store.id, opening_cash: 0 },
      ));
    const post = (accountId: string) =>
      testDb.$transaction((tx) =>
        cashBook.post(tx as never, {
          accountId,
          direction: 'out',
          amount: 70_000,
          categoryCode: 'shipping',
          linkOpenShiftOf: fx.users.manager,
          isAutomatic: false,
        }),
      );
    const atCounter = await post(fx.accounts.hcmDrawer);
    expect(atCounter.pos_session_id).toBe(shift.id);
    // no open shift at the other branch: nothing to link
    const elsewhere = await post(fx.accounts.hnDrawer);
    expect(elsewhere.pos_session_id).toBeNull();
  });

  it('a split POS payment posts each method to its mapped account', async () => {
    const order = await checkout.checkout(
      { id: fx.users.sales_associate },
      {
        client_request_id: randomUUID(),
        lines: [
          {
            product_id: fx.products.jeans,
            quantity: 1,
            expected_unit_price: 1_000_000,
          },
        ],
        payments: [
          {
            method: CheckoutPaymentMethod.CASH,
            amount: 400_000,
            amount_tendered: 400_000,
          },
          { method: CheckoutPaymentMethod.CARD, amount: 600_000 },
        ],
      },
    );
    const byMethod: Record<string, string> = {};
    for (const p of order.sales_order_payments) {
      const [e] = await entriesFor('sales_order_payment', p.id);
      byMethod[p.payment_method] = e.account_id;
    }
    expect(byMethod).toEqual({
      cash: fx.accounts.hcmDrawer,
      card: fx.accounts.hcmBank,
    });
  });

  it('a failing checkout leaves no cash book entry', async () => {
    const before = await testDb.cash_book_entries.count();
    await expect(
      checkout.checkout(
        { id: fx.users.sales_associate },
        {
          client_request_id: randomUUID(),
          lines: [
            {
              product_id: fx.products.jeans,
              quantity: 1,
              expected_unit_price: 1,
            },
          ],
          payments: [
            {
              method: CheckoutPaymentMethod.CASH,
              amount: 1,
              amount_tendered: 1,
            },
          ],
        },
      ),
    ).rejects.toThrow();
    expect(await testDb.cash_book_entries.count()).toBe(before);
  });

  it('a back-office order payment posts a sale receipt', async () => {
    currentUser = fx.users.manager;
    const draft = await sales.create({
      customer_id: fx.customers.plain,
      customer_name: 'x',
      channel: 'retail_store',
      store_id: fx.store.id,
      items: [{ product_id: fx.products.jeans, quantity: 1, unit_price: 0 }],
    } as never);
    await sales.confirm(draft.id);
    const payment = await sales.addPayment({
      sales_order_id: draft.id,
      payment_method: PaymentMethod.BANK_TRANSFER,
      amount: 1_000_000,
    });
    const [e] = await entriesFor('sales_order_payment', payment.id);
    expect(e).toMatchObject({
      account_id: fx.accounts.hcmBank,
      counterparty_type: 'customer',
      counterparty_id: fx.customers.plain,
    });
    expect(e.cash_book_categories.code).toBe('sale');
  });

  it('a receivable collection posts a "Thu nợ khách hàng" receipt on the mapped account', async () => {
    currentUser = fx.users.finance;
    const draft = await sales.create({
      customer_id: fx.customers.plain,
      customer_name: 'x',
      channel: 'retail_store',
      store_id: fx.store.id,
      items: [{ product_id: fx.products.jeans, quantity: 2, unit_price: 0 }],
    } as never);
    await sales.confirm(draft.id);
    await customers.recordReceivablePayment({
      customer_id: fx.customers.plain,
      sales_order_id: draft.id,
      amount: 2_000_000,
      payment_method: 'bank_transfer',
    } as never);
    const payment = await testDb.sales_order_payments.findFirstOrThrow({
      where: { sales_order_id: draft.id },
    });
    const [e] = await entriesFor('sales_order_payment', payment.id);
    expect(Number(e.amount)).toBe(2_000_000);
    expect(e.account_id).toBe(fx.accounts.hcmBank);
    expect(e.cash_book_categories.code).toBe('receivable_collection');
  });

  it('a workshop deposit posts to the branch drawer, and deleting it posts a reversal', async () => {
    currentUser = fx.users.store_manager;
    const bike = await testDb.bikes.create({
      data: {
        brand: 'Honda',
        model: 'CB',
        license_plate: `59-${Date.now()}`,
        owner_id: fx.customers.member,
      },
    });
    const order = await testDb.service_orders.create({
      data: {
        order_number: `SV-${Date.now()}`.slice(0, 20),
        motorcycle_id: bike.id,
        customer_id: fx.customers.member,
        store_id: fx.store2.id,
      },
    });
    const before = await balance(fx.accounts.hnDrawer);
    const payment = await workshop.create({
      service_order_id: order.id,
      amount: 1_000_000,
      payment_method: 'cash',
      is_deposit: true,
    } as never);
    const [receipt] = await entriesFor('service_payment', payment.id);
    expect(receipt).toMatchObject({
      account_id: fx.accounts.hnDrawer,
      direction: 'in',
      counterparty_type: 'customer',
    });
    expect(receipt.cash_book_categories.code).toBe('workshop_service');
    expect(await balance(fx.accounts.hnDrawer)).toBe(before + 1_000_000);

    await workshop.remove(payment.id);
    const all = await entriesFor('service_payment', payment.id);
    expect(all).toHaveLength(2);
    expect(all[1]).toMatchObject({
      direction: 'out',
      reverses_entry_id: receipt.id,
    });
    expect(all[0].status).toBe('posted');
    expect(await balance(fx.accounts.hnDrawer)).toBe(before);
    expect(await testDb.payments.count({ where: { id: payment.id } })).toBe(0);
  });

  it('a workshop payment without a branch posts to the default branch', async () => {
    const bike = await testDb.bikes.create({
      data: {
        brand: 'RE',
        model: 'C350',
        license_plate: `30-${Date.now()}`,
        owner_id: fx.customers.member,
      },
    });
    const order = await testDb.service_orders.create({
      data: {
        order_number: `SV2-${Date.now()}`.slice(0, 20),
        motorcycle_id: bike.id,
        customer_id: fx.customers.member,
      },
    });
    const payment = await workshop.create({
      service_order_id: order.id,
      amount: 300_000,
      payment_method: 'transfer',
    } as never);
    const [e] = await entriesFor('service_payment', payment.id);
    expect(e.account_id).toBe(fx.accounts.hcmBank); // HCMC is the default store; transfer normalised to bank_transfer
  });

  it('a supplier payment posts a payment entry on the chosen account, or the default mapping', async () => {
    const supplier = await testDb.suppliers.create({
      data: { name: 'Momotaro VN' },
    });
    await testDb.purchase_orders.create({
      data: {
        order_number: `PO-${Date.now()}`.slice(0, 20),
        supplier_id: supplier.id,
        status: 'approved',
        subtotal: D(50_000_000),
        total_amount: D(50_000_000),
      },
    });
    const chosen = await suppliers.create(
      {
        supplier_id: supplier.id,
        amount: 20_000_000,
        payment_method: SupplierPaymentMethod.BANK_TRANSFER,
        cash_account_id: fx.accounts.hnBank,
      } as never,
      fx.users.finance,
    );
    const [e1] = await entriesFor('supplier_payment', chosen.id);
    expect(e1).toMatchObject({
      account_id: fx.accounts.hnBank,
      direction: 'out',
      counterparty_type: 'supplier',
      counterparty_name: 'Momotaro VN',
    });
    expect(Number(e1.amount)).toBe(20_000_000);
    expect(e1.cash_book_categories.code).toBe('supplier_payment');

    const fallback = await suppliers.create(
      {
        supplier_id: supplier.id,
        amount: 1_000_000,
        payment_method: SupplierPaymentMethod.CASH,
      } as never,
      fx.users.finance,
    );
    const [e2] = await entriesFor('supplier_payment', fallback.id);
    expect(e2.account_id).toBe(fx.accounts.hcmDrawer);
  });

  it('marking payroll paid posts one entry per slip; a failure leaves the period unpaid', async () => {
    const employees = [
      fx.users.sales_associate,
      fx.users.technician,
      fx.users.store_manager,
    ];
    const period = await testDb.payroll_periods.create({
      data: {
        period_code: `P-${Date.now()}`.slice(0, 20),
        period_name: 'Tháng 3/2026',
        period_year: 2026,
        period_month: 3,
        period_start_date: new Date('2026-03-01'),
        period_end_date: new Date('2026-03-31'),
        status: 'finalized',
      },
    });
    const nets = [8_000_000, 9_000_000, 10_000_000];
    const slips: { id: string }[] = [];
    for (const [i, employee] of employees.entries()) {
      slips.push(
        await testDb.payroll_slips.create({
          data: {
            payroll_period_id: period.id,
            employee_id: employee,
            status: 'finalized',
            net_pay: D(nets[i]),
          },
        }),
      );
    }

    // A failing posting (inactive chosen account) leaves everything unchanged
    await testDb.cash_book_accounts.update({
      where: { id: fx.accounts.hcmBank },
      data: { is_active: false },
    });
    await expect(
      payroll.markPaid(
        period.id,
        {
          payment_method: 'bank_transfer',
          cash_account_id: fx.accounts.hcmBank,
        },
        fx.users.finance,
      ),
    ).rejects.toThrow();
    expect(
      (
        await testDb.payroll_periods.findUniqueOrThrow({
          where: { id: period.id },
        })
      ).status,
    ).toBe('finalized');
    expect(
      await testDb.payroll_slips.count({
        where: { payroll_period_id: period.id, status: 'paid' },
      }),
    ).toBe(0);
    await testDb.cash_book_accounts.update({
      where: { id: fx.accounts.hcmBank },
      data: { is_active: true },
    });

    await payroll.markPaid(
      period.id,
      { payment_method: 'bank_transfer', cash_account_id: fx.accounts.hcmBank },
      fx.users.finance,
    );
    const entries = await testDb.cash_book_entries.findMany({
      where: {
        source_type: 'payroll_slip',
        source_id: { in: slips.map((s) => s.id) },
      },
    });
    expect(entries).toHaveLength(3);
    expect(entries.reduce((s, e) => s + Number(e.amount), 0)).toBe(27_000_000);
    expect(
      entries.every(
        (e) =>
          e.account_id === fx.accounts.hcmBank &&
          e.counterparty_type === 'employee' &&
          e.direction === 'out',
      ),
    ).toBe(true);
  });

  it('completeness: every completed payment and paid slip has exactly one automatic entry', async () => {
    const missing = await testDb.$queryRaw<
      { kind: string; id: string; n: number }[]
    >`
      SELECT 'sales_order_payment' AS kind, p.id::text, COUNT(e.id)::int AS n
      FROM sales_order_payments p
      LEFT JOIN cash_book_entries e ON e.source_type = 'sales_order_payment' AND e.source_id = p.id AND e.reverses_entry_id IS NULL
      WHERE p.status = 'completed' GROUP BY p.id
      UNION ALL
      SELECT 'service_payment', p.id::text, COUNT(e.id)::int
      FROM payments p
      LEFT JOIN cash_book_entries e ON e.source_type = 'service_payment' AND e.source_id = p.id AND e.reverses_entry_id IS NULL
      GROUP BY p.id
      UNION ALL
      SELECT 'supplier_payment', p.id::text, COUNT(e.id)::int
      FROM supplier_payments p
      LEFT JOIN cash_book_entries e ON e.source_type = 'supplier_payment' AND e.source_id = p.id
      GROUP BY p.id
      UNION ALL
      SELECT 'payroll_slip', s.id::text, COUNT(e.id)::int
      FROM payroll_slips s
      LEFT JOIN cash_book_entries e ON e.source_type = 'payroll_slip' AND e.source_id = s.id
      WHERE s.status = 'paid' AND COALESCE(s.net_pay, 0) > 0 GROUP BY s.id`;
    const kinds = new Set(missing.map((m) => m.kind));
    expect([...kinds].sort()).toEqual([
      'payroll_slip',
      'sales_order_payment',
      'service_payment',
      'supplier_payment',
    ]);
    expect(missing.filter((m) => m.n !== 1)).toEqual([]);
  });
});
