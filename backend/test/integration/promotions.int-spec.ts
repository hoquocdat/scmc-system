import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import { UserContextService } from '../../src/auth/user-context.service';
import { CashBookPostingService } from '../../src/cash-book/cash-book-posting.service';
import { CaslAbilityFactory } from '../../src/casl/casl-ability.factory';
import { LoyaltyService } from '../../src/loyalty/loyalty.service';
import { CheckoutPaymentMethod } from '../../src/pos/dto/checkout.dto';
import { PosCheckoutService } from '../../src/pos/pos-checkout.service';
import { PosService } from '../../src/pos/pos.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ReportScope, toReportDate } from '../../src/reports/report-scope';
import { SalesReportsService } from '../../src/reports/sales-reports.service';
import { ReturnRequestDto } from '../../src/sales-returns/dto/sales-returns.dto';
import { SalesReturnsService } from '../../src/sales-returns/sales-returns.service';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { RetailReportsService } from '../../src/reports/retail-reports.service';
import { SalesService } from '../../src/sales/sales.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

const D = (n: number) => new Prisma.Decimal(n);

/** Specs pricing/promotions, pricing/vouchers and the discount order of pricing/price-resolution. */
describe('promotions and vouchers', () => {
  let fx: SalesFixtures;
  let sales: SalesService;
  let checkout: PosCheckoutService;
  let returns: SalesReturnsService;
  let reports: SalesReportsService;
  let currentUser: string | null = null;
  const cashier = () => ({ id: fx.users.store_manager });

  const promotion = (
    data: Partial<Prisma.promotionsUncheckedCreateInput> & {
      targets?: {
        role?: string;
        target_type: string;
        target_id: string;
        quantity?: number;
      }[];
    },
  ) => {
    const { targets, ...rest } = data;
    return testDb.promotions.create({
      data: {
        code: `P${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
        name: 'Promo',
        type: 'line_discount',
        ...rest,
        promotion_targets: targets
          ? {
              create: targets.map((t) => ({
                role: 'target',
                quantity: 1,
                ...t,
              })),
            }
          : undefined,
      } as Prisma.promotionsUncheckedCreateInput,
    });
  };
  const voucher = async (
    code: string,
    data: Partial<Prisma.voucher_campaignsUncheckedCreateInput>,
  ) =>
    testDb.voucher_campaigns.create({
      data: {
        code: `C-${code}`,
        name: `Campaign ${code}`,
        discount_kind: 'percent',
        discount_value: D(10),
        ...data,
        vouchers: { create: { code } },
      } as Prisma.voucher_campaignsUncheckedCreateInput,
    });
  const pos = (
    lines: {
      product_id: string;
      quantity: number;
      expected_unit_price: number;
    }[],
    extra: Record<string, unknown> = {},
  ) =>
    checkout.checkout(cashier(), {
      client_request_id: randomUUID(),
      lines,
      ...extra,
    } as never);
  const stickers = (n: number) => [
    {
      product_id: fx.products.sticker,
      quantity: n,
      expected_unit_price: 50_000,
    },
  ];

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    const userContext = {
      getUserId: () => currentUser,
      getUser: () => null,
    } as unknown as UserContextService;
    const cashBook = new CashBookPostingService(prisma);
    const loyalty = new LoyaltyService(prisma);
    const posting = new SalesPostingService(
      prisma,
      new PriceResolverService(prisma),
      loyalty,
      cashBook,
    );
    const casl = new CaslAbilityFactory(prisma);
    const activity = new ActivityLogsService(prisma);
    const shifts = new PosService(prisma, casl, activity, cashBook);
    checkout = new PosCheckoutService(prisma, posting, casl, activity, {
      get: () => 'secret',
    } as unknown as ConfigService);
    sales = new SalesService(prisma, userContext, loyalty, posting, cashBook);
    returns = new SalesReturnsService(
      prisma,
      posting,
      cashBook,
      loyalty,
      casl,
      activity,
    );
    reports = new SalesReportsService(prisma);
    await testDb.inventory.updateMany({
      where: { location_id: fx.store.locationId },
      data: { quantity_on_hand: 500 },
    });
    await testDb.loyalty_rule_versions.updateMany({
      data: { min_redemption_points: 10 },
    });
    await shifts.openShift(cashier(), {
      store_id: fx.store.id,
      opening_cash: 0,
    });
  });
  afterEach(async () => {
    await testDb.promotions.updateMany({ data: { is_active: false } });
  });
  afterAll(closeTestDb);

  it('full discount order: 900,000 − 90,000 − 50,000 − 76,000 − 20,000 = 664,000, every discount recorded', async () => {
    const vip = await testDb.customer_groups.create({
      data: { code: 'VIP', name: 'VIP' },
    });
    await testDb.customer_group_members.create({
      data: { customer_id: fx.customers.member, group_id: vip.id },
    });
    await testDb.price_books.create({
      data: {
        code: 'VIP',
        name: 'Giá VIP',
        all_customers: false,
        price_book_customer_groups: { create: { group_id: vip.id } },
        price_book_entries: {
          create: {
            product_id: fx.products.jeans,
            mode: 'fixed',
            value: D(900_000),
          },
        },
      },
    });
    const linePromo = await promotion({
      name: 'Jeans −10%',
      discount_kind: 'percent',
      discount_value: D(10),
      targets: [{ target_type: 'product', target_id: fx.products.jeans }],
    });
    const orderPromo = await promotion({
      name: 'Giảm 50k',
      type: 'order_discount',
      discount_kind: 'amount',
      discount_value: D(50_000),
    });
    const campaign = await voucher('VIP10', { max_discount: D(100_000) });
    currentUser = fx.users.manager;
    const draft = await sales.create({
      customer_id: fx.customers.member,
      customer_name: 'x',
      channel: 'retail_store',
      store_id: fx.store.id,
      voucher_code: 'vip10',
      points_to_redeem: 20,
      expected_total: 664_000,
      items: [{ product_id: fx.products.jeans, quantity: 1, unit_price: 0 }],
    } as never);
    expect(Number(draft.total_amount)).toBe(664_000);
    expect([
      Number(draft.promotion_discount_amount),
      Number(draft.voucher_discount_amount),
      draft.voucher_code,
    ]).toEqual([50_000, 76_000, 'VIP10']);
    expect(Number(draft.sales_order_items[0].promotion_discount)).toBe(90_000);
    const rows = await testDb.sales_order_discounts.findMany({
      where: { sales_order_id: draft.id },
      orderBy: { amount: 'desc' },
    });
    expect(
      rows.map((r) => [
        r.source_type,
        r.promotion_id ?? r.voucher_id,
        Number(r.amount),
      ]),
    ).toEqual([
      ['promotion', linePromo.id, 90_000],
      ['voucher', expect.any(String), 76_000],
      ['promotion', orderPromo.id, 50_000],
    ]);
    const v = await testDb.vouchers.findFirstOrThrow({
      where: { campaign_id: campaign.id },
    });
    expect(v.used_count).toBe(1);

    // cancelling releases the code
    await sales.cancel(draft.id);
    expect(
      (await testDb.vouchers.findUniqueOrThrow({ where: { id: v.id } }))
        .used_count,
    ).toBe(0);
    expect(
      (
        await testDb.voucher_redemptions.findFirstOrThrow({
          where: { sales_order_id: draft.id },
        })
      ).status,
    ).toBe('released');
  });

  it('buy 2 get 1 at POS: 3 stickers for 100,000, shown in the sales summary', async () => {
    await promotion({
      name: 'Mua 2 tặng 1',
      type: 'buy_x_get_y',
      buy_quantity: 2,
      get_quantity: 1,
      get_discount_percent: D(100),
      targets: [{ target_type: 'product', target_id: fx.products.sticker }],
    });
    const before = (await reports.summary(new ReportScope({}))).meta
      ?.summary as { promotionDiscounts: number; netSales: number };
    const order = await pos(stickers(3), {
      payments: [{ method: CheckoutPaymentMethod.CASH, amount: 100_000 }],
      expected_total: 100_000,
    });
    expect(Number(order.total_amount)).toBe(100_000);
    const after = (
      await reports.summary(
        new ReportScope({
          from: toReportDate(new Date()),
          to: toReportDate(new Date()),
        }),
      )
    ).meta?.summary as { promotionDiscounts: number; netSales: number };
    expect(after.promotionDiscounts - (before?.promotionDiscounts ?? 0)).toBe(
      50_000,
    );
    const perf = await new RetailReportsService(
      testDb as unknown as PrismaService,
    ).promotionPerformance(
      new ReportScope({
        from: toReportDate(new Date()),
        to: toReportDate(new Date()),
      }),
    );
    expect(perf.rows.find((r) => r.name === 'Mua 2 tặng 1')).toMatchObject({
      orders: 1,
      discount: 50_000,
      netSales: 100_000,
      averageOrderValue: 100_000,
      costRate: 33.33,
    });
  });

  it('TOTAL_CHANGED when the screen total no longer matches', async () => {
    await promotion({
      name: 'Mua 2 tặng 1',
      type: 'buy_x_get_y',
      buy_quantity: 2,
      get_quantity: 1,
      get_discount_percent: D(100),
      targets: [{ target_type: 'product', target_id: fx.products.sticker }],
    });
    await expect(
      pos(stickers(3), {
        payments: [{ method: CheckoutPaymentMethod.CASH, amount: 150_000 }],
        expected_total: 150_000,
      }),
    ).rejects.toMatchObject({
      response: { code: 'TOTAL_CHANGED', total: 100_000 },
    });
  });

  it('voucher reasons and one use of a single-use code between two counters', async () => {
    await voucher('MIN1M', { min_order_amount: D(1_000_000) });
    await expect(
      pos(stickers(2), {
        voucher_code: 'MIN1M',
        payments: [{ method: CheckoutPaymentMethod.CASH, amount: 100_000 }],
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'VOUCHER_REJECTED',
        reason: 'Đơn tối thiểu 1.000.000 đ',
      },
    });
    await voucher('ONCE', {
      discount_kind: 'amount',
      discount_value: D(10_000),
    });
    const results = await Promise.allSettled([
      pos(stickers(2), {
        voucher_code: 'ONCE',
        payments: [{ method: CheckoutPaymentMethod.CASH, amount: 90_000 }],
      }),
      pos(stickers(2), {
        voucher_code: 'ONCE',
        payments: [{ method: CheckoutPaymentMethod.CASH, amount: 90_000 }],
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected.reason).toMatchObject({
      response: { code: 'VOUCHER_REJECTED' },
    });
    await expect(
      pos(stickers(2), {
        voucher_code: 'ONCE',
        payments: [{ method: CheckoutPaymentMethod.CASH, amount: 90_000 }],
      }),
    ).rejects.toMatchObject({
      response: { reason: 'Mã đã được sử dụng hết lượt' },
    });
  });

  it('a voucher that does not combine with promotions is refused while one applies', async () => {
    await promotion({
      name: 'Mua 2 tặng 1',
      type: 'buy_x_get_y',
      buy_quantity: 2,
      get_quantity: 1,
      get_discount_percent: D(100),
      targets: [{ target_type: 'product', target_id: fx.products.sticker }],
    });
    await voucher('ALONE', { combinable_with_promotions: false });
    await expect(
      pos(stickers(3), {
        voucher_code: 'ALONE',
        payments: [{ method: CheckoutPaymentMethod.CASH, amount: 90_000 }],
      }),
    ).rejects.toMatchObject({
      response: { reason: 'Mã không dùng chung với khuyến mãi đang áp dụng' },
    });
  });

  it('returns: a broken buy 2 get 1 refunds 0, the rest refunds what was paid; vouchers are shared', async () => {
    await promotion({
      name: 'Mua 2 tặng 1',
      type: 'buy_x_get_y',
      buy_quantity: 2,
      get_quantity: 1,
      get_discount_percent: D(100),
      targets: [{ target_type: 'product', target_id: fx.products.sticker }],
    });
    const order = await pos(stickers(3), {
      customer_id: fx.customers.plain,
      payments: [{ method: CheckoutPaymentMethod.CASH, amount: 100_000 }],
    });
    const item = order.sales_order_items[0].id;
    const p1 = await returns.preview(cashier(), {
      sales_order_id: order.id,
      items: [{ sales_order_item_id: item, quantity: 1 }],
    } as ReturnRequestDto);
    expect(p1.refund_due).toBe(0);
    await returns.create(cashier(), {
      sales_order_id: order.id,
      items: [{ sales_order_item_id: item, quantity: 1 }],
    } as ReturnRequestDto);
    const p2 = await returns.preview(cashier(), {
      sales_order_id: order.id,
      items: [{ sales_order_item_id: item, quantity: 2 }],
    } as ReturnRequestDto);
    expect(p2.refund_due).toBe(100_000);
    await testDb.promotions.updateMany({ data: { is_active: false } });

    await voucher('HALF', {
      discount_kind: 'amount',
      discount_value: D(100_000),
    });
    const two = await pos(
      [
        {
          product_id: fx.products.jeans,
          quantity: 1,
          expected_unit_price: 1_000_000,
        },
        {
          product_id: fx.products.exhaust,
          quantity: 1,
          expected_unit_price: 2_500_000,
        },
      ],
      {
        voucher_code: 'HALF',
        payments: [{ method: CheckoutPaymentMethod.CASH, amount: 3_400_000 }],
      },
    );
    const jeans = two.sales_order_items.find(
      (i) => i.product_id === fx.products.jeans,
    ).id;
    const p3 = await returns.preview(cashier(), {
      sales_order_id: two.id,
      items: [{ sales_order_item_id: jeans, quantity: 1 }],
    } as ReturnRequestDto);
    expect(p3.refund_due).toBe(971_429); // 1,000,000 − 28,571 (voucher 100,000 shared 28,571 / 71,429 by value)
  });
});
