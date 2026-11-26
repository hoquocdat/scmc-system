import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import { UserContextService } from '../../src/auth/user-context.service';
import { CashBookAccountsService } from '../../src/cash-book/cash-book-accounts.service';
import { CashBookPostingService } from '../../src/cash-book/cash-book-posting.service';
import { CashBookService } from '../../src/cash-book/cash-book.service';
import { CaslAbilityFactory } from '../../src/casl/casl-ability.factory';
import { CustomersService } from '../../src/customers/customers.service';
import { LoyaltyService } from '../../src/loyalty/loyalty.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { PayrollService } from '../../src/payroll/payroll.service';
import { CheckoutPaymentMethod } from '../../src/pos/dto/checkout.dto';
import { PosCheckoutService } from '../../src/pos/pos-checkout.service';
import { PosService } from '../../src/pos/pos.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { SalesService } from '../../src/sales/sales.service';
import { SupplierPaymentMethod } from '../../src/supplier-payments/dto/create-supplier-payment.dto';
import { SupplierPaymentsService } from '../../src/supplier-payments/supplier-payments.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

const D = (n: number) => new Prisma.Decimal(n);
const vnDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

/**
 * Task 7.1: one business day at the HCMC branch, end to end, checked against
 * figures computed by hand.
 *
 * Drawer: 2,000,000 opening + 450,000 POS sale − 300,000 shift transfer to bank
 *   + 1,000,000 workshop deposit − 1,000,000 its reversal + 200,000 other income
 *   − 1,000,000 transfer to bank − 50,000 count shortfall = 1,300,000
 * Bank: 50,000,000 opening + 300,000 + 2,000,000 receivable − 5,000,000 supplier
 *   − 17,000,000 payroll − 3,000,000 rent + 1,000,000 = 28,300,000
 * Shift expected cash: every drawer movement during the shift counts, including
 *   finance's 200,000 receipt and 1,000,000 transfer to the bank (the cash really
 *   entered and left the drawer): 2,000,000 + 450,000 − 300,000 + 200,000
 *   − 1,000,000 = 1,350,000; counted 1,300,000 → short 50,000
 */
describe('cash book: a full day at one branch', () => {
  let fx: SalesFixtures;
  let book: CashBookService;
  let accounts: CashBookAccountsService;
  let checkout: PosCheckoutService;
  let shifts: PosService;
  let sales: SalesService;
  let customers: CustomersService;
  let workshop: PaymentsService;
  let suppliers: SupplierPaymentsService;
  let payroll: PayrollService;
  let currentUser: string | null = null;

  const balance = async (accountId: string) =>
    (await accounts.balances({ accountIds: [accountId] })).get(accountId)
      ?.balance ?? 0;
  const category = (code: string, direction: 'in' | 'out') =>
    testDb.cash_book_categories.findFirstOrThrow({
      where: { code, direction },
    });

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    const userContext = {
      getUserId: () => currentUser,
      getUser: () => null,
    } as unknown as UserContextService;
    const posting = new CashBookPostingService(prisma);
    accounts = new CashBookAccountsService(prisma);
    const activity = new ActivityLogsService(prisma);
    book = new CashBookService(prisma, posting, accounts, activity);
    const loyalty = new LoyaltyService(prisma);
    const salesPosting = new SalesPostingService(
      prisma,
      new PriceResolverService(prisma),
      loyalty,
      posting,
    );
    const casl = new CaslAbilityFactory(prisma);
    shifts = new PosService(prisma, casl, activity, posting);
    checkout = new PosCheckoutService(prisma, salesPosting, casl, activity, {
      get: () => 'secret',
    } as unknown as ConfigService);
    sales = new SalesService(
      prisma,
      userContext,
      loyalty,
      salesPosting,
      posting,
    );
    customers = new CustomersService(prisma, userContext, posting);
    workshop = new PaymentsService(prisma, userContext, posting);
    suppliers = new SupplierPaymentsService(prisma, posting);
    payroll = new PayrollService(prisma, posting, {} as never);
    await testDb.inventory.updateMany({
      where: { location_id: fx.store.locationId },
      data: { quantity_on_hand: 500 },
    });
  });
  afterAll(closeTestDb);

  it('balances and expected cash match the hand-computed figures', async () => {
    const finance = { id: fx.users.finance };
    const cashier = { id: fx.users.sales_associate };
    const { hcmDrawer, hcmBank } = fx.accounts;

    // 1. Go-live: opening balances dated yesterday
    await book.createOpeningBalance(finance, {
      account_id: hcmDrawer,
      amount: 2_000_000,
      date: vnDate(-1),
    });
    await book.createOpeningBalance(finance, {
      account_id: hcmBank,
      amount: 50_000_000,
      date: vnDate(-1),
    });

    // 2. Cashier opens a shift with the drawer float and sells for cash
    const shift = await shifts.openShift(cashier, {
      store_id: fx.store.id,
      opening_cash: 2_000_000,
    });
    await checkout.checkout(cashier, {
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
    });

    // 3. Cashier moves 300,000 from the drawer to the bank during the shift
    await shifts.addCashMovement(cashier, {
      pos_session_id: shift.id,
      transaction_type: 'cash_out',
      amount: 300_000,
      reason: 'Nộp ngân hàng',
      target_account_id: hcmBank,
    } as never);

    // 4. Receivable collection by bank transfer
    currentUser = fx.users.finance;
    const credit = await sales.create({
      customer_id: fx.customers.plain,
      customer_name: 'x',
      channel: 'retail_store',
      store_id: fx.store.id,
      items: [{ product_id: fx.products.jeans, quantity: 2, unit_price: 0 }],
    } as never);
    await sales.confirm(credit.id);
    await customers.recordReceivablePayment({
      customer_id: fx.customers.plain,
      sales_order_id: credit.id,
      amount: 2_000_000,
      payment_method: 'bank_transfer',
    } as never);

    // 5. Workshop deposit in cash, then deleted (reversal)
    currentUser = fx.users.store_manager;
    const bike = await testDb.bikes.create({
      data: {
        brand: 'Honda',
        model: 'CB',
        license_plate: `59-${Date.now()}`,
        owner_id: fx.customers.member,
      },
    });
    const serviceOrder = await testDb.service_orders.create({
      data: {
        order_number: `SVX-${Date.now()}`.slice(0, 20),
        motorcycle_id: bike.id,
        customer_id: fx.customers.member,
        store_id: fx.store.id,
      },
    });
    const deposit = await workshop.create({
      service_order_id: serviceOrder.id,
      amount: 1_000_000,
      payment_method: 'cash',
      is_deposit: true,
    } as never);
    await workshop.remove(deposit.id);

    // 6. Supplier payment from the bank
    const supplier = await testDb.suppliers.create({
      data: { name: 'Scenario Supplier' },
    });
    await testDb.purchase_orders.create({
      data: {
        order_number: `POX-${Date.now()}`.slice(0, 20),
        supplier_id: supplier.id,
        status: 'approved',
        subtotal: D(5_000_000),
        total_amount: D(5_000_000),
      },
    });
    await suppliers.create(
      {
        supplier_id: supplier.id,
        amount: 5_000_000,
        payment_method: SupplierPaymentMethod.BANK_TRANSFER,
        cash_account_id: hcmBank,
      } as never,
      fx.users.finance,
    );

    // 7. Payroll of two slips paid from the bank
    const period = await testDb.payroll_periods.create({
      data: {
        period_code: `PX-${Date.now()}`.slice(0, 20),
        period_name: 'Kỳ kiểm thử',
        period_year: 2026,
        period_month: 10,
        period_start_date: new Date('2026-10-01'),
        period_end_date: new Date('2026-10-31'),
        status: 'finalized',
      },
    });
    for (const [employee, net] of [
      [fx.users.technician, 8_000_000],
      [fx.users.store_manager, 9_000_000],
    ] as const) {
      await testDb.payroll_slips.create({
        data: {
          payroll_period_id: period.id,
          employee_id: employee,
          status: 'finalized',
          net_pay: D(net),
        },
      });
    }
    await payroll.markPaid(
      period.id,
      { payment_method: 'bank_transfer', cash_account_id: hcmBank },
      fx.users.finance,
    );

    // 8. Manual vouchers: rent from the bank, other income into the drawer
    await book.createVoucher(finance, 'out', {
      account_id: hcmBank,
      amount: 3_000_000,
      category_id: (await category('rent', 'out')).id,
      counterparty_type: 'other',
      counterparty_name: 'Chủ nhà',
    });
    await book.createVoucher(finance, 'in', {
      account_id: hcmDrawer,
      amount: 200_000,
      category_id: (await category('other_income', 'in')).id,
    });

    // 9. Finance moves 1,000,000 from the drawer to the bank
    await book.createTransfer(finance, {
      from_account_id: hcmDrawer,
      to_account_id: hcmBank,
      amount: 1_000_000,
    });

    // 10. Shift close: expected 1,350,000, counted 1,300,000
    const summary = await shifts.getSummary(shift.id, cashier);
    expect(summary.expected_cash).toBe(1_350_000);
    await shifts.closeShift(shift.id, cashier, { closing_cash: 1_300_000 });
    const difference = await testDb.cash_book_entries.findFirstOrThrow({
      where: {
        pos_session_id: shift.id,
        cash_book_categories: { code: 'cash_count_difference' },
      },
    });
    expect(difference.direction).toBe('out');
    expect(Number(difference.amount)).toBe(50_000);

    // Balances
    expect(await balance(hcmDrawer)).toBe(1_300_000);
    expect(await balance(hcmBank)).toBe(28_300_000);

    // The drawer's book for today agrees with the same figures
    const day = await book.listEntries({
      from: vnDate(),
      to: vnDate(),
      accountId: hcmDrawer,
    } as never);
    expect(day.meta).toMatchObject({
      opening: 2_000_000,
      receipts: 1_650_000,
      payments: 2_350_000,
      closing: 1_300_000,
    });
    const rows = day.rows as { runningBalance: number }[];
    expect(rows[rows.length - 1].runningBalance).toBe(1_300_000);

    // Every non-cash account of the other branch is untouched
    expect(await balance(fx.accounts.hnDrawer)).toBe(0);
    expect(await balance(fx.accounts.hnBank)).toBe(0);
  });
});
