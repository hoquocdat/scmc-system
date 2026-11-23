import 'reflect-metadata';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import {
  Action,
  CaslAbilityFactory,
} from '../../src/casl/casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
} from '../../src/casl/check-policies.decorator';
import { LoyaltyService } from '../../src/loyalty/loyalty.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { signApproval } from '../../src/pos/approval-token';
import { CashMovementType } from '../../src/pos/dto/cash-movement.dto';
import {
  CheckoutDto,
  CheckoutPaymentMethod,
} from '../../src/pos/dto/checkout.dto';
import { PosCheckoutService } from '../../src/pos/pos-checkout.service';
import { PosController } from '../../src/pos/pos.controller';
import { PosService } from '../../src/pos/pos.service';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import {
  DiscountApprovalRequiredException,
  InsufficientStockException,
  PaymentRuleException,
  PriceChangedException,
  ShiftNotOpenException,
} from '../../src/sales/sales.errors';
import { closeTestDb, resetTestDb, testDb } from './db';
import { onHand, SalesFixtures, seedSalesFixtures } from './sales-fixtures';

const SECRET = 'test-approval-secret';

describe('POS shifts and checkout', () => {
  let shifts: PosService;
  let checkout: PosCheckoutService;
  let fx: SalesFixtures;
  const u = (role: string) => ({ id: fx.users[role] });

  const cart = (over: Partial<CheckoutDto> = {}): CheckoutDto => ({
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
        amount: 1_000_000,
        amount_tendered: 1_000_000,
      },
    ],
    ...over,
  });

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    const casl = new CaslAbilityFactory(prisma);
    const activity = new ActivityLogsService(prisma);
    const posting = new SalesPostingService(
      prisma,
      new PriceResolverService(prisma),
      new LoyaltyService(prisma),
    );
    shifts = new PosService(prisma, casl, activity);
    checkout = new PosCheckoutService(prisma, posting, casl, activity, {
      get: () => SECRET,
    } as unknown as ConfigService);
  });
  afterAll(closeTestDb);

  describe('shifts', () => {
    it('checkout without an open shift is blocked', async () => {
      await expect(
        checkout.checkout(u('sales_associate'), cart()),
      ).rejects.toBeInstanceOf(ShiftNotOpenException);
    });

    it('opens a shift at a store, derives the location, and refuses a second open shift', async () => {
      const shift = await shifts.openShift(u('sales_associate'), {
        store_id: fx.store.id,
        opening_cash: 2_000_000,
      });
      expect(shift.session_number).toMatch(/^PS-\d{8}-\d{4}$/);
      expect(shift.store_id).toBe(fx.store.id);
      expect(shift.location_id).toBe(fx.store.locationId);
      expect(Number(shift.opening_cash)).toBe(2_000_000);
      await expect(
        shifts.openShift(u('sales_associate'), {
          store_id: fx.store.id,
          opening_cash: 0,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      const log = await testDb.activity_logs.findFirst({
        where: { entity_id: shift.id, action: 'open' },
      });
      expect(log?.user_id).toBe(fx.users.sales_associate);
    });

    it('resumes the open shift and 404s when there is none', async () => {
      const current = await shifts.getCurrentShift(u('sales_associate'));
      expect(current.status).toBe('open');
      await expect(shifts.getCurrentShift(u('finance'))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('records cash in/out with a positive amount and refuses movements on closed shifts', async () => {
      const shift = await shifts.getCurrentShift(u('sales_associate'));
      const out = await shifts.addCashMovement(u('sales_associate'), {
        pos_session_id: shift.id,
        transaction_type: CashMovementType.CASH_OUT,
        amount: 1_000_000,
        reason: 'move to safe',
      });
      expect(Number(out.amount)).toBe(-1_000_000);
      await expect(
        shifts.addCashMovement(u('sales_associate'), {
          pos_session_id: shift.id,
          transaction_type: CashMovementType.CASH_IN,
          amount: 0,
          reason: 'x',
        }),
      ).rejects.toThrow();

      const closedShift = await shifts.openShift(u('finance'), {
        store_id: fx.store2.id,
        opening_cash: 0,
      });
      await shifts.closeShift(closedShift.id, u('finance'), {
        closing_cash: 0,
      });
      await expect(
        shifts.addCashMovement(u('finance'), {
          pos_session_id: closedShift.id,
          transaction_type: CashMovementType.CASH_IN,
          amount: 10,
          reason: 'late',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('computes expected cash from opening, net cash payments and movements', async () => {
      // opening 2,000,000; cash sale 3,000,000 tendered with 200,000 change (net 2,800,000); cash out 1,000,000 -> 3,800,000
      await checkout.checkout(
        u('sales_associate'),
        cart({
          lines: [
            {
              product_id: fx.products.jeans,
              quantity: 2,
              expected_unit_price: 1_000_000,
              discount_amount: 0,
            },
            {
              product_id: fx.products.sticker,
              quantity: 16,
              expected_unit_price: 50_000,
            },
          ],
          payments: [
            {
              method: CheckoutPaymentMethod.CASH,
              amount: 2_800_000,
              amount_tendered: 3_000_000,
            },
          ],
        }),
      );
      const shift = await shifts.getCurrentShift(u('sales_associate'));
      const summary = await shifts.getSummary(shift.id);
      expect(summary).toMatchObject({
        opening_cash: 2_000_000,
        cash_received: 2_800_000,
        cash_in: 0,
        cash_out: 1_000_000,
        expected_cash: 3_800_000,
        sales_count: 1,
      });
    });

    it('summarises sales by payment method and credit given', async () => {
      await checkout.checkout(
        u('sales_associate'),
        cart({
          payments: [
            {
              method: CheckoutPaymentMethod.CARD,
              amount: 1_000_000,
              reference: 'AUTH1',
            },
          ],
        }),
      );
      await checkout.checkout(
        u('sales_associate'),
        cart({
          lines: [
            {
              product_id: fx.products.sticker,
              quantity: 2,
              expected_unit_price: 50_000,
            },
          ],
          payments: [
            { method: CheckoutPaymentMethod.BANK_TRANSFER, amount: 100_000 },
          ],
        }),
      );
      const shift = await shifts.getCurrentShift(u('sales_associate'));
      const summary = await shifts.getSummary(shift.id);
      const byMethod = Object.fromEntries(
        summary.by_payment_method.map((m) => [m.method, m.amount]),
      );
      expect(byMethod).toEqual({
        cash: 2_800_000,
        card: 1_000_000,
        bank_transfer: 100_000,
      });
      expect(summary.sales_total).toBe(3_900_000);
      expect(summary.credit_given).toBe(0);
    });

    it("a cashier cannot see another user's shift; a supervisor can and can close it", async () => {
      const shift = await shifts.getCurrentShift(u('sales_associate'));
      await expect(
        shifts.getSummary(shift.id, u('technician')),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const list = await shifts.findAll({} as never, u('sales_associate'));
      expect(
        list.data.every((s) => s.user_id === fx.users.sales_associate),
      ).toBe(true);
      const managerList = await shifts.findAll({} as never, u('manager'));
      expect(managerList.data.length).toBeGreaterThan(list.data.length);

      // expected 3,800,000; counted 3,750,000 -> -50,000
      const closed = await shifts.closeShift(shift.id, u('manager'), {
        closing_cash: 3_750_000,
      });
      expect(closed.status).toBe('closed');
      expect(Number(closed.cash_difference)).toBe(-50_000);
      expect(closed.closed_by).toBe(fx.users.manager);
      await expect(
        shifts.closeShift(shift.id, u('manager'), { closing_cash: 1 }),
      ).rejects.toBeInstanceOf(ConflictException);
      const log = await testDb.activity_logs.findFirst({
        where: { entity_id: shift.id, action: 'close' },
      });
      expect(log?.user_id).toBe(fx.users.manager);
    });

    it('declares pos policies on every endpoint', () => {
      const proto = PosController.prototype;
      const handlers = Object.getOwnPropertyNames(proto).filter(
        (n) => n !== 'constructor',
      );
      for (const name of handlers) {
        const policies = Reflect.getMetadata(
          CHECK_POLICIES_KEY,
          proto[name as keyof typeof proto] as unknown as object,
        ) as PolicyHandler[];
        expect({
          name,
          hasPolicy: policies?.some((p) => p.subject === 'pos'),
        }).toEqual({ name, hasPolicy: true });
      }
      const approve = Reflect.getMetadata(
        CHECK_POLICIES_KEY,
        PosController.prototype.approveDiscount as unknown as object,
      ) as PolicyHandler[];
      expect(approve[0].action).toBe(Action.Approve);
      const reprint = Reflect.getMetadata(
        CHECK_POLICIES_KEY,
        PosController.prototype.reprint as unknown as object,
      ) as PolicyHandler[];
      expect(reprint[0].action).toBe(Action.Reprint);
    });
  });

  describe('checkout', () => {
    beforeAll(async () => {
      await shifts.openShift(u('sales_associate'), {
        store_id: fx.store.id,
        opening_cash: 500_000,
      });
      await shifts.openShift(u('store_manager'), {
        store_id: fx.store.id,
        opening_cash: 0,
      });
      // plenty of stock for the checkout scenarios
      await testDb.inventory.updateMany({
        where: {
          product_id: fx.products.jeans,
          location_id: fx.store.locationId,
        },
        data: { quantity_on_hand: 100 },
      });
    });

    it('records a paid sale with receipt data and logs it', async () => {
      const before = await onHand(fx.store.locationId, fx.products.jeans);
      const order = await checkout.checkout(u('sales_associate'), cart());
      expect(order.status).toBe('completed');
      expect(order.payment_status).toBe('paid');
      expect(order.channel).toBe('pos');
      expect(order.pos_sessions?.user_id).toBe(fx.users.sales_associate);
      expect(order.stores?.name).toBe('SCMC HCMC');
      expect(
        order.user_profiles_sales_orders_created_byTouser_profiles?.full_name,
      ).toBe('User sales_associate');
      expect(order.sales_order_payments).toHaveLength(1);
      expect(Number(order.sales_order_payments[0].change_given)).toBe(0);
      expect(order.idempotent_replay).toBe(false);
      expect(await onHand(fx.store.locationId, fx.products.jeans)).toBe(
        before - 1,
      );
      const log = await testDb.activity_logs.findFirst({
        where: { entity_id: order.id, action: 'pos_checkout' },
      });
      expect(log?.user_id).toBe(fx.users.sales_associate);
    });

    it('quick-registers a customer by phone and reuses an existing phone', async () => {
      const first = await checkout.checkout(
        u('sales_associate'),
        cart({ new_customer: { name: 'Khách Mới', phone: '0912 345 678' } }),
      );
      expect(first.customers?.full_name).toBe('Khách Mới');
      const second = await checkout.checkout(
        u('sales_associate'),
        cart({
          new_customer: { name: 'Khách Mới (again)', phone: '0912345678' },
        }),
      );
      expect(second.customer_id).toBe(first.customer_id);
      expect(
        await testDb.customers.count({ where: { phone: '0912345678' } }),
      ).toBe(1);
    });

    it('rejects a changed price with the new price', async () => {
      await expect(
        checkout.checkout(
          u('sales_associate'),
          cart({
            lines: [
              {
                product_id: fx.products.jeans,
                quantity: 1,
                expected_unit_price: 950_000,
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({
        changes: [
          expect.objectContaining({
            unit_price: 1_000_000,
            expected_unit_price: 950_000,
          }),
        ],
      });
      await expect(
        checkout.checkout(
          u('sales_associate'),
          cart({
            lines: [
              {
                product_id: fx.products.jeans,
                quantity: 1,
                expected_unit_price: 950_000,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(PriceChangedException);
    });

    it('rejects insufficient stock naming the product and availability', async () => {
      await expect(
        checkout.checkout(
          u('sales_associate'),
          cart({
            lines: [
              {
                product_id: fx.products.exhaust,
                quantity: 3,
                expected_unit_price: 2_500_000,
              },
            ],
            payments: [
              { method: CheckoutPaymentMethod.CARD, amount: 7_500_000 },
            ],
          }),
        ),
      ).rejects.toMatchObject({
        shortages: [
          expect.objectContaining({ sku: 'EXH-X', requested: 3, available: 2 }),
        ],
      });
      await expect(
        checkout.checkout(
          u('sales_associate'),
          cart({
            lines: [
              {
                product_id: fx.products.exhaust,
                quantity: 3,
                expected_unit_price: 2_500_000,
              },
            ],
            payments: [
              { method: CheckoutPaymentMethod.CARD, amount: 7_500_000 },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(InsufficientStockException);
    });

    it('split payment and cash change', async () => {
      const order = await checkout.checkout(
        u('sales_associate'),
        cart({
          lines: [
            {
              product_id: fx.products.jeans,
              quantity: 1,
              expected_unit_price: 1_000_000,
            },
            {
              product_id: fx.products.sticker,
              quantity: 9,
              expected_unit_price: 50_000,
            },
          ], // 1,450,000
          payments: [
            {
              method: CheckoutPaymentMethod.CASH,
              amount: 450_000,
              amount_tendered: 500_000,
            },
            {
              method: CheckoutPaymentMethod.CARD,
              amount: 1_000_000,
              reference: 'A1',
            },
          ],
        }),
      );
      expect(order.payment_status).toBe('paid');
      const cash = order.sales_order_payments.find(
        (p) => p.payment_method === 'cash',
      );
      expect(Number(cash?.amount)).toBe(450_000);
      expect(Number(cash?.amount_tendered)).toBe(500_000);
      expect(Number(cash?.change_given)).toBe(50_000);
    });

    it('payment rules: non-cash overpayment, walk-in partial, credit without permission', async () => {
      await expect(
        checkout.checkout(
          u('sales_associate'),
          cart({
            payments: [
              { method: CheckoutPaymentMethod.CARD, amount: 1_200_000 },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(PaymentRuleException);
      await expect(
        checkout.checkout(
          u('sales_associate'),
          cart({
            payments: [
              {
                method: CheckoutPaymentMethod.CASH,
                amount: 500_000,
                amount_tendered: 500_000,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(PaymentRuleException);
      await expect(
        checkout.checkout(
          u('sales_associate'),
          cart({
            customer_id: fx.customers.plain,
            payments: [
              {
                method: CheckoutPaymentMethod.CASH,
                amount: 500_000,
                amount_tendered: 500_000,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(PaymentRuleException);
    });

    it('a user with pos:credit can sell on credit; the balance becomes a receivable', async () => {
      const order = await checkout.checkout(
        u('store_manager'),
        cart({
          customer_id: fx.customers.plain,
          lines: [
            {
              product_id: fx.products.jeans,
              quantity: 3,
              expected_unit_price: 1_000_000,
            },
          ],
          payments: [
            {
              method: CheckoutPaymentMethod.CASH,
              amount: 1_000_000,
              amount_tendered: 1_000_000,
            },
          ],
        }),
      );
      expect(order.payment_status).toBe('partial');
      const receivable = await testDb.customer_receivables.findFirst({
        where: { sales_order_id: order.id },
      });
      expect(Number(receivable?.balance)).toBe(2_000_000);
    });

    it('discounts above the role limit need an approval token bound to the cart', async () => {
      const rid = randomUUID();
      const big = cart({
        client_request_id: rid,
        order_discount: { type: 'percent', value: 30 },
        payments: [
          {
            method: CheckoutPaymentMethod.CASH,
            amount: 700_000,
            amount_tendered: 700_000,
          },
        ],
      });
      await expect(
        checkout.checkout(u('sales_associate'), big),
      ).rejects.toBeInstanceOf(DiscountApprovalRequiredException);

      // approval for another cart or an expired one is refused
      const otherCart = signApproval(
        {
          rid: randomUUID(),
          pct: 30,
          by: fx.users.manager,
          exp: Math.floor(Date.now() / 1000) + 300,
        },
        SECRET,
      );
      await expect(
        checkout.checkout(u('sales_associate'), {
          ...big,
          discount_approval_token: otherCart,
        }),
      ).rejects.toBeInstanceOf(DiscountApprovalRequiredException);
      const expired = signApproval(
        {
          rid,
          pct: 30,
          by: fx.users.manager,
          exp: Math.floor(Date.now() / 1000) - 1,
        },
        SECRET,
      );
      await expect(
        checkout.checkout(u('sales_associate'), {
          ...big,
          discount_approval_token: expired,
        }),
      ).rejects.toBeInstanceOf(DiscountApprovalRequiredException);
      const smaller = signApproval(
        {
          rid,
          pct: 20,
          by: fx.users.manager,
          exp: Math.floor(Date.now() / 1000) + 300,
        },
        SECRET,
      );
      await expect(
        checkout.checkout(u('sales_associate'), {
          ...big,
          discount_approval_token: smaller,
        }),
      ).rejects.toBeInstanceOf(DiscountApprovalRequiredException);

      const approval = await checkout.approveDiscount(u('manager'), {
        client_request_id: rid,
        discount_percent: 30,
      });
      const order = await checkout.checkout(u('sales_associate'), {
        ...big,
        discount_approval_token: approval.token,
      });
      expect(order.discount_approved_by).toBe(fx.users.manager);
      expect(Number(order.total_amount)).toBe(700_000);

      // within the limit no approval is needed (sales associate limit is 10%)
      const small = await checkout.checkout(
        u('sales_associate'),
        cart({
          order_discount: { type: 'percent', value: 10 },
          payments: [
            {
              method: CheckoutPaymentMethod.CASH,
              amount: 900_000,
              amount_tendered: 900_000,
            },
          ],
        }),
      );
      expect(small.discount_approved_by).toBeNull();
    });

    it('is idempotent on client_request_id, also for concurrent identical requests', async () => {
      const dto = cart();
      const first = await checkout.checkout(u('sales_associate'), dto);
      const again = await checkout.checkout(u('sales_associate'), dto);
      expect(again.id).toBe(first.id);
      expect(again.idempotent_replay).toBe(true);

      const concurrent = cart();
      const results = await Promise.all([
        checkout.checkout(u('sales_associate'), concurrent),
        checkout.checkout(u('sales_associate'), concurrent),
      ]);
      expect(results[0].id).toBe(results[1].id);
      expect(
        await testDb.sales_orders.count({
          where: { client_request_id: concurrent.client_request_id },
        }),
      ).toBe(1);
    });

    it('reprint returns the receipt data and is logged', async () => {
      const order = await checkout.checkout(u('sales_associate'), cart());
      const receipt = await checkout.reprint(u('manager'), order.id);
      expect(receipt.reprint).toBe(true);
      expect(receipt.order_number).toBe(order.order_number);
      expect(
        await testDb.activity_logs.count({
          where: { entity_id: order.id, action: 'reprint' },
        }),
      ).toBe(1);
    });
  });
});
