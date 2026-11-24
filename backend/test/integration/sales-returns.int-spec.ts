import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import { UserContextService } from '../../src/auth/user-context.service';
import { CashBookPostingService } from '../../src/cash-book/cash-book-posting.service';
import {
  Action,
  CaslAbilityFactory,
} from '../../src/casl/casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
} from '../../src/casl/check-policies.decorator';
import { LoyaltyService } from '../../src/loyalty/loyalty.service';
import { CheckoutPaymentMethod } from '../../src/pos/dto/checkout.dto';
import { PosCheckoutService } from '../../src/pos/pos-checkout.service';
import { PosService } from '../../src/pos/pos.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ReturnRequestDto } from '../../src/sales-returns/dto/sales-returns.dto';
import { SalesReturnsController } from '../../src/sales-returns/sales-returns.controller';
import { SalesReturnsService } from '../../src/sales-returns/sales-returns.service';
import { PaymentMethod } from '../../src/sales/dto/create-payment.dto';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { SalesService } from '../../src/sales/sales.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

/** Spec sales/returns. */
describe('sales returns', () => {
  let fx: SalesFixtures;
  let returns: SalesReturnsService;
  let sales: SalesService;
  let checkout: PosCheckoutService;
  let shifts: PosService;
  let accounts: CashBookPostingService;
  let currentUser: string | null = null;
  let managerShift: string;
  const u = (role: string) => ({ id: fx.users[role] });

  const stock = async (productId: string, variantId: string | null = null) => {
    const rows = await testDb.inventory.findMany({
      where: variantId
        ? { location_id: fx.store.locationId, product_variant_id: variantId }
        : {
            location_id: fx.store.locationId,
            product_id: productId,
            product_variant_id: null,
          },
    });
    return rows.reduce((s, r) => s + (r.quantity_on_hand ?? 0), 0);
  };
  const drawerBalance = async () => {
    const rows = await testDb.cash_book_entries.findMany({
      where: { account_id: fx.accounts.hcmDrawer, status: 'posted' },
    });
    return rows.reduce(
      (s, e) => s + (e.direction === 'in' ? 1 : -1) * Number(e.amount),
      0,
    );
  };

  /** Back-office order, confirmed and paid as given (status confirmed, stock deducted). */
  const order = async (
    items: {
      product_id: string;
      product_variant_id?: string;
      quantity: number;
    }[],
    opts: {
      customer?: string | null;
      discount?: number;
      pay?: number | null;
    } = {},
  ) => {
    currentUser = fx.users.manager;
    const draft = await sales.create({
      customer_id:
        opts.customer === null
          ? undefined
          : (opts.customer ?? fx.customers.plain),
      customer_name: 'Khách',
      channel: 'retail_store',
      store_id: fx.store.id,
      discount_type: 'fixed',
      discount_amount: opts.discount ?? 0,
      items: items.map((i) => ({ ...i, unit_price: 0 })),
    } as never);
    await sales.confirm(draft.id);
    const total = Number(
      (await testDb.sales_orders.findUniqueOrThrow({ where: { id: draft.id } }))
        .total_amount,
    );
    const pay = opts.pay === undefined ? total : opts.pay;
    if (pay)
      await sales.addPayment({
        sales_order_id: draft.id,
        payment_method: PaymentMethod.CASH,
        amount: pay,
      } as never);
    const full = await testDb.sales_orders.findUniqueOrThrow({
      where: { id: draft.id },
      include: { sales_order_items: { orderBy: { created_at: 'asc' } } },
    });
    return full;
  };
  const itemOf = (o: Awaited<ReturnType<typeof order>>, productId: string) =>
    o.sales_order_items.find((i) => i.product_id === productId).id;
  const ret = (
    role: string,
    dto: Partial<ReturnRequestDto> & {
      sales_order_id: string;
      items: ReturnRequestDto['items'];
    },
  ) => returns.create(u(role), dto as ReturnRequestDto);

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    const userContext = {
      getUserId: () => currentUser,
      getUser: () => null,
    } as unknown as UserContextService;
    accounts = new CashBookPostingService(prisma);
    const loyalty = new LoyaltyService(prisma);
    const posting = new SalesPostingService(
      prisma,
      new PriceResolverService(prisma),
      loyalty,
      accounts,
    );
    const casl = new CaslAbilityFactory(prisma);
    const activity = new ActivityLogsService(prisma);
    shifts = new PosService(prisma, casl, activity, accounts);
    checkout = new PosCheckoutService(prisma, posting, casl, activity, {
      get: () => 'secret',
    } as unknown as ConfigService);
    sales = new SalesService(prisma, userContext, loyalty, posting, accounts);
    returns = new SalesReturnsService(
      prisma,
      posting,
      accounts,
      loyalty,
      casl,
      activity,
    );
    await testDb.inventory.updateMany({
      where: { location_id: fx.store.locationId },
      data: { quantity_on_hand: 500 },
    });
    managerShift = (
      await shifts.openShift(u('store_manager'), {
        store_id: fx.store.id,
        opening_cash: 0,
      })
    ).id;
  });
  afterAll(closeTestDb);

  describe('returnable lines', () => {
    it('partial return leaves the rest returnable; too many refused; number TH-YYMM-#####', async () => {
      const o = await order([
        { product_id: fx.products.sticker, quantity: 3 },
        { product_id: fx.products.jeans, quantity: 1 },
      ]);
      const r = await ret('store_manager', {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: itemOf(o, fx.products.sticker), quantity: 1 },
        ],
        refunds: [{ method: 'cash', amount: 50_000 }],
      });
      expect(r.return_number).toMatch(/^TH-\d{4}-\d{5}$/);
      const l = await returns.lookup(o.order_number);
      expect(l.lines.map((x) => [x.product_sku, x.remaining])).toEqual([
        ['STICKER', 2],
        ['JEANS-A', 1],
      ]);
      await expect(
        ret('store_manager', {
          sales_order_id: o.id,
          items: [
            {
              sales_order_item_id: itemOf(o, fx.products.sticker),
              quantity: 3,
            },
          ],
          refunds: [{ method: 'cash', amount: 150_000 }],
        }),
      ).rejects.toMatchObject({ response: { code: 'RETURN_RULE' } });
    });

    it('a cancelled order has nothing returnable', async () => {
      currentUser = fx.users.manager;
      const draft = await sales.create({
        customer_id: fx.customers.plain,
        customer_name: 'x',
        channel: 'retail_store',
        store_id: fx.store.id,
        items: [
          { product_id: fx.products.sticker, quantity: 1, unit_price: 0 },
        ],
      } as never);
      await sales.cancel(draft.id);
      const l = await returns.lookup(draft.id);
      expect(l.returnable).toBe(false);
    });

    it('two concurrent returns cannot exceed the sold quantity', async () => {
      const o = await order([{ product_id: fx.products.sticker, quantity: 1 }]);
      const dto = {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: o.sales_order_items[0].id, quantity: 1 },
        ],
        refunds: [{ method: 'cash' as const, amount: 50_000 }],
      };
      const results = await Promise.allSettled([
        ret('store_manager', dto),
        ret('store_manager', dto),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        (
          await testDb.sales_order_items.findUniqueOrThrow({
            where: { id: o.sales_order_items[0].id },
          })
        ).returned_quantity,
      ).toBe(1);
    });
  });

  describe('refund value and destination', () => {
    it('order discount is shared: jeans 1,000,000 + exhaust 2,500,000 − 350,000 → jeans refund 900,000, cash in the shift', async () => {
      const o = await order(
        [
          { product_id: fx.products.jeans, quantity: 1 },
          { product_id: fx.products.exhaust, quantity: 1 },
        ],
        { discount: 350_000 },
      );
      const preview = await returns.preview(u('store_manager'), {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: itemOf(o, fx.products.jeans), quantity: 1 },
        ],
      } as ReturnRequestDto);
      expect(preview.goods_amount).toBe(900_000);
      const before = await shifts.getSummary(managerShift, u('store_manager'));
      const r = await ret('store_manager', {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: itemOf(o, fx.products.jeans), quantity: 1 },
        ],
        refunds: [{ method: 'cash', amount: 900_000 }],
      });
      expect(r.cash_book_entries).toHaveLength(1);
      const entry = await testDb.cash_book_entries.findUniqueOrThrow({
        where: { id: r.cash_book_entries[0].id },
        include: { cash_book_categories: true },
      });
      expect(entry).toMatchObject({
        direction: 'out',
        account_id: fx.accounts.hcmDrawer,
        pos_session_id: managerShift,
      });
      expect(entry.cash_book_categories.code).toBe('sales_return');
      const after = await shifts.getSummary(managerShift, u('store_manager'));
      expect(after.expected_cash).toBe(before.expected_cash - 900_000);
    });

    it('unit by unit: 33,333 / 33,333 / 33,334, then the order is fully returned', async () => {
      const o = await order(
        [{ product_id: fx.products.sticker, quantity: 3 }],
        { discount: 50_000 },
      );
      const id = o.sales_order_items[0].id;
      const refunds: number[] = [];
      for (let n = 0; n < 3; n++) {
        const due = (
          await returns.preview(u('store_manager'), {
            sales_order_id: o.id,
            items: [{ sales_order_item_id: id, quantity: 1 }],
          } as ReturnRequestDto)
        ).refund_due;
        refunds.push(due);
        await ret('store_manager', {
          sales_order_id: o.id,
          items: [{ sales_order_item_id: id, quantity: 1 }],
          refunds: [{ method: 'cash', amount: due }],
        });
      }
      expect(refunds).toEqual([33_333, 33_333, 33_334]);
      const done = await testDb.sales_orders.findUniqueOrThrow({
        where: { id: o.id },
      });
      expect(done.return_status).toBe('full');
      expect(Number(done.returned_amount)).toBe(100_000);
    });

    it('credit sale: the receivable falls first, cash only for what was collected', async () => {
      const o = await order([{ product_id: fx.products.jeans, quantity: 2 }], {
        pay: 500_000,
      });
      const rec = () =>
        testDb.customer_receivables.findFirstOrThrow({
          where: { sales_order_id: o.id },
        });
      expect(Number((await rec()).balance)).toBe(1_500_000);
      const r1 = await ret('store_manager', {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: o.sales_order_items[0].id, quantity: 1 },
        ],
      });
      expect(Number(r1.receivable_reduction)).toBe(1_000_000);
      expect(Number(r1.refund_amount)).toBe(0);
      expect(Number((await rec()).balance)).toBe(500_000);
      const r2 = await ret('store_manager', {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: o.sales_order_items[0].id, quantity: 1 },
        ],
        refunds: [{ method: 'cash', amount: 500_000 }],
      });
      expect([
        Number(r2.receivable_reduction),
        Number(r2.refund_amount),
      ]).toEqual([500_000, 500_000]);
      expect((await rec()).status).toBe('paid');
    });

    it('refund lines that do not add up are refused', async () => {
      const o = await order([{ product_id: fx.products.jeans, quantity: 1 }]);
      await expect(
        ret('store_manager', {
          sales_order_id: o.id,
          items: [
            { sales_order_item_id: o.sales_order_items[0].id, quantity: 1 },
          ],
          refunds: [{ method: 'cash', amount: 800_000 }],
        }),
      ).rejects.toMatchObject({ response: { code: 'RETURN_RULE' } });
    });
  });

  describe('customer credit', () => {
    it('refund as credit, then spend it at POS: only the cash part reaches the cash book', async () => {
      const o = await order([{ product_id: fx.products.sticker, quantity: 6 }]);
      await ret('store_manager', {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: o.sales_order_items[0].id, quantity: 6 },
        ],
        refunds: [{ method: 'store_credit', amount: 300_000 }],
      });
      expect((await returns.customerCredit(fx.customers.plain)).balance).toBe(
        300_000,
      );
      const sale = await checkout.checkout(u('store_manager'), {
        client_request_id: randomUUID(),
        customer_id: fx.customers.plain,
        lines: [
          {
            product_id: fx.products.sticker,
            quantity: 10,
            expected_unit_price: 50_000,
          },
        ],
        payments: [
          { method: CheckoutPaymentMethod.STORE_CREDIT, amount: 300_000 },
          { method: CheckoutPaymentMethod.CASH, amount: 200_000 },
        ],
      } as never);
      const credit = await returns.customerCredit(fx.customers.plain);
      expect(credit.balance).toBe(0);
      expect(credit.transactions.map((t) => t.amount)).toEqual([
        -300_000, 300_000,
      ]);
      const entries = await testDb.cash_book_entries.findMany({
        where: {
          source_type: 'sales_order_payment',
          source_id: { in: sale.sales_order_payments.map((p) => p.id) },
        },
      });
      expect(entries.map((e) => Number(e.amount))).toEqual([200_000]);
      await expect(
        checkout.checkout(u('store_manager'), {
          client_request_id: randomUUID(),
          customer_id: fx.customers.plain,
          lines: [
            {
              product_id: fx.products.sticker,
              quantity: 1,
              expected_unit_price: 50_000,
            },
          ],
          payments: [
            { method: CheckoutPaymentMethod.STORE_CREDIT, amount: 50_000 },
          ],
        } as never),
      ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_CREDIT' } });
    });

    it('credit needs a customer', async () => {
      const o = await order(
        [{ product_id: fx.products.sticker, quantity: 1 }],
        { customer: null },
      );
      await expect(
        ret('store_manager', {
          sales_order_id: o.id,
          items: [
            { sales_order_item_id: o.sales_order_items[0].id, quantity: 1 },
          ],
          refunds: [{ method: 'store_credit', amount: 50_000 }],
        }),
      ).rejects.toMatchObject({ response: { code: 'RETURN_RULE' } });
    });
  });

  describe('stock and loyalty', () => {
    it('restock adds to the location; damaged changes nothing but is recorded', async () => {
      const o = await order([
        { product_id: fx.products.jeans, quantity: 1 },
        { product_id: fx.products.exhaust, quantity: 1 },
      ]);
      const [jeans0, exhaust0] = [
        await stock(fx.products.jeans),
        await stock(fx.products.exhaust),
      ];
      const r = await ret('store_manager', {
        sales_order_id: o.id,
        items: [
          {
            sales_order_item_id: itemOf(o, fx.products.jeans),
            quantity: 1,
            reason_code: 'wrong_size',
          },
          {
            sales_order_item_id: itemOf(o, fx.products.exhaust),
            quantity: 1,
            restock: false,
            reason_code: 'defective',
          },
        ],
        refunds: [{ method: 'bank_transfer', amount: 3_500_000 }],
      });
      expect(await stock(fx.products.jeans)).toBe(jeans0 + 1);
      expect(await stock(fx.products.exhaust)).toBe(exhaust0);
      const moves = await testDb.inventory_transactions.findMany({
        where: { reference_type: 'sales_return', reference_id: r.id },
      });
      expect(moves.map((m) => m.transaction_type).sort()).toEqual([
        'RETURN',
        'RETURN_DAMAGED',
      ]);
    });

    it('half the value returned reverses half the earned points and restores half the redeemed', async () => {
      const o = await order([{ product_id: fx.products.jeans, quantity: 2 }], {
        customer: fx.customers.member,
      });
      const earned = o.loyalty_points_earned ?? 0;
      expect(earned).toBeGreaterThan(0);
      await testDb.sales_orders.update({
        where: { id: o.id },
        data: { loyalty_points_redeemed: 50 },
      });
      const bal = async () =>
        (
          await testDb.customer_loyalty.findFirstOrThrow({
            where: { customer_id: fx.customers.member },
          })
        ).points_balance;
      const before = await bal();
      const r = await ret('store_manager', {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: o.sales_order_items[0].id, quantity: 1 },
        ],
        refunds: [{ method: 'cash', amount: 1_000_000 }],
      });
      expect([r.points_reversed, r.points_restored]).toEqual([
        Math.round(earned / 2),
        25,
      ]);
      expect(await bal()).toBe(before - Math.round(earned / 2) + 25);
      const r2 = await ret('store_manager', {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: o.sales_order_items[0].id, quantity: 1 },
        ],
        refunds: [{ method: 'cash', amount: 1_000_000 }],
      });
      expect(r.points_reversed + r2.points_reversed).toBe(earned);
      expect(r.points_restored + r2.points_restored).toBe(50);
    });
  });

  describe('exchanges', () => {
    it('same value: return and new order, stock both ways, no money moves', async () => {
      const o = await order([{ product_id: fx.products.jeans, quantity: 1 }]);
      const [jeans0, sticker0, drawer0] = [
        await stock(fx.products.jeans),
        await stock(fx.products.sticker),
        await drawerBalance(),
      ];
      const r = await ret('store_manager', {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: o.sales_order_items[0].id, quantity: 1 },
        ],
        exchange: {
          lines: [
            {
              product_id: fx.products.sticker,
              quantity: 20,
              expected_unit_price: 50_000,
            },
          ],
        },
      });
      expect(r.kind).toBe('exchange');
      expect(r.exchange_order_id).not.toBeNull();
      expect(Number(r.refund_amount)).toBe(0);
      expect(await stock(fx.products.jeans)).toBe(jeans0 + 1);
      expect(await stock(fx.products.sticker)).toBe(sticker0 - 20);
      expect(await drawerBalance()).toBe(drawer0);
      const newOrder = await testDb.sales_orders.findUniqueOrThrow({
        where: { id: r.exchange_order_id },
        include: { sales_order_payments: true },
      });
      expect(
        newOrder.sales_order_payments.map((p) => [
          p.payment_method,
          Number(p.amount),
        ]),
      ).toEqual([['exchange', 1_000_000]]);
      expect(newOrder.pos_session_id).toBe(managerShift);
    });

    it('more expensive replacement: exchange value plus a card payment, only the card in the cash book', async () => {
      const o = await order([{ product_id: fx.products.jeans, quantity: 1 }]);
      const r = await ret('store_manager', {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: o.sales_order_items[0].id, quantity: 1 },
        ],
        exchange: {
          lines: [
            {
              product_id: fx.products.exhaust,
              quantity: 1,
              expected_unit_price: 2_500_000,
            },
          ],
          payments: [{ method: 'card', amount: 1_500_000 }],
        },
      });
      const newOrder = await testDb.sales_orders.findUniqueOrThrow({
        where: { id: r.exchange_order_id },
        include: { sales_order_payments: true },
      });
      expect(
        newOrder.sales_order_payments
          .map((p) => [p.payment_method, Number(p.amount)])
          .sort(),
      ).toEqual([
        ['card', 1_500_000],
        ['exchange', 1_000_000],
      ]);
      const entries = await testDb.cash_book_entries.findMany({
        where: {
          source_type: 'sales_order_payment',
          source_id: { in: newOrder.sales_order_payments.map((p) => p.id) },
        },
      });
      expect(entries.map((e) => [e.account_id, Number(e.amount)])).toEqual([
        [fx.accounts.hcmBank, 1_500_000],
      ]);
    });
  });

  describe('approval and permissions', () => {
    it('above the limit a sales associate is refused; a store manager approves', async () => {
      const o = await order([{ product_id: fx.products.exhaust, quantity: 1 }]);
      const dto = {
        sales_order_id: o.id,
        items: [
          { sales_order_item_id: o.sales_order_items[0].id, quantity: 1 },
        ],
        refunds: [{ method: 'cash' as const, amount: 2_500_000 }],
      };
      await expect(ret('sales_associate', dto)).rejects.toMatchObject({
        response: { code: 'RETURN_APPROVAL_REQUIRED' },
      });
      const r = await ret('store_manager', dto);
      expect(r.approved_by).toBe(fx.users.store_manager);
      expect(
        await testDb.activity_logs.count({
          where: { entity_type: 'sales_return', entity_id: r.id },
        }),
      ).toBe(1);
    });

    it('routes and grants', async () => {
      const policy = (name: keyof SalesReturnsController) =>
        (
          Reflect.getMetadata(
            CHECK_POLICIES_KEY,
            SalesReturnsController.prototype[name] as object,
          ) as PolicyHandler[]
        )[0];
      expect(policy('create')).toEqual({
        action: Action.Create,
        subject: 'sales_returns',
      });
      expect(policy('preview')).toEqual({
        action: Action.Create,
        subject: 'sales_returns',
      });
      expect(policy('list')).toEqual({
        action: Action.Read,
        subject: 'sales_returns',
      });
      const casl = new CaslAbilityFactory(testDb as unknown as PrismaService);
      const can = async (role: string, a: Action) =>
        (await casl.createForUser(fx.users[role])).can(a, 'sales_returns');
      expect(await can('sales_associate', Action.Create)).toBe(true);
      expect(await can('sales_associate', Action.Approve)).toBe(false);
      expect(await can('store_manager', Action.Approve)).toBe(true);
      expect(await can('finance', Action.Read)).toBe(true);
      expect(await can('finance', Action.Create)).toBe(false);
      expect(await can('technician', Action.Read)).toBe(false);
    });

    it('list is a report envelope with totals', async () => {
      const list = await returns.list({});
      expect(list.report).toBe('sales.returns');
      expect(list.rows.length).toBeGreaterThan(0);
      expect(Number(list.totals?.goodsAmount)).toBeGreaterThan(0);
    });
  });
});
