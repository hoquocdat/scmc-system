import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
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
import { CartService } from '../../src/promotions/cart.service';
import {
  CartController,
  PromotionsController,
  VouchersController,
} from '../../src/promotions/promotions.controller';
import { PromotionsService } from '../../src/promotions/promotions.service';
import { VouchersService } from '../../src/promotions/vouchers.service';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

/** Promotion and voucher management, cart breakdown, policies. */
describe('promotions and vouchers API', () => {
  let fx: SalesFixtures;
  let promotions: PromotionsService;
  let vouchers: VouchersService;
  let cart: CartService;
  let checkout: PosCheckoutService;
  let casl: CaslAbilityFactory;
  const manager = () => fx.users.manager;

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    const cashBook = new CashBookPostingService(prisma);
    const loyalty = new LoyaltyService(prisma);
    const posting = new SalesPostingService(
      prisma,
      new PriceResolverService(prisma),
      loyalty,
      cashBook,
    );
    casl = new CaslAbilityFactory(prisma);
    const activity = new ActivityLogsService(prisma);
    promotions = new PromotionsService(prisma);
    vouchers = new VouchersService(prisma);
    cart = new CartService(prisma, posting);
    checkout = new PosCheckoutService(prisma, posting, casl, activity, {
      get: () => 'secret',
    } as unknown as ConfigService);
    await new PosService(prisma, casl, activity, cashBook).openShift(
      { id: fx.users.store_manager },
      { store_id: fx.store.id, opening_cash: 0 },
    );
    await testDb.inventory.updateMany({
      where: { location_id: fx.store.locationId },
      data: { quantity_on_hand: 500 },
    });
  });
  afterAll(closeTestDb);

  it('promotion shapes are validated with readable errors', async () => {
    await expect(
      promotions.create(manager(), {
        code: 'X1',
        name: 'x',
        type: 'line_discount',
        discount_kind: 'percent',
        discount_value: 10,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      promotions.create(manager(), {
        code: 'X2',
        name: 'x',
        type: 'bundle',
        bundle_price: 1,
        targets: [
          { role: 'bundle', target_type: 'category', target_id: randomUUID() },
          {
            role: 'bundle',
            target_type: 'product',
            target_id: fx.products.jeans,
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      promotions.create(manager(), {
        code: 'X3',
        name: 'x',
        type: 'line_discount',
        discount_kind: 'percent',
        discount_value: 120,
        targets: [
          {
            role: 'target',
            target_type: 'product',
            target_id: fx.products.jeans,
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('a buy 2 get 1 is created, used by a sale, shows usage and cannot be deleted', async () => {
    const p = await promotions.create(manager(), {
      code: 'MUA2TANG1',
      name: 'Mua 2 tặng 1 sticker',
      type: 'buy_x_get_y',
      buy_quantity: 2,
      get_quantity: 1,
      get_discount_percent: 100,
      days_of_week: [],
      targets: [
        {
          role: 'target',
          target_type: 'product',
          target_id: fx.products.sticker,
        },
      ],
    });
    expect(p).toMatchObject({
      code: 'MUA2TANG1',
      all_stores: true,
      combinable: true,
      usage: { orders: 0, discount: 0 },
    });
    expect(Object.values(p.target_names)[0]).toContain('STICKER');

    const breakdown = await cart.price({
      store_id: fx.store.id,
      lines: [{ product_id: fx.products.sticker, quantity: 3 }],
    });
    expect(breakdown).toMatchObject({
      subtotal: 150_000,
      line_promotion_discount: 50_000,
      total: 100_000,
      promotions: [
        {
          code: 'MUA2TANG1',
          amount: 50_000,
          lines: [{ index: 0, amount: 50_000 }],
        },
      ],
    });

    await checkout.checkout({ id: fx.users.store_manager }, {
      client_request_id: randomUUID(),
      lines: [
        {
          product_id: fx.products.sticker,
          quantity: 3,
          expected_unit_price: 50_000,
        },
      ],
      payments: [{ method: CheckoutPaymentMethod.CASH, amount: 100_000 }],
      expected_total: 100_000,
    } as never);
    expect((await promotions.get(p.id)).usage).toEqual({
      orders: 1,
      discount: 50_000,
    });
    await expect(promotions.remove(p.id)).rejects.toMatchObject({
      status: 409,
    });
    expect(
      (await promotions.update(manager(), p.id, { is_active: false }))
        .is_active,
    ).toBe(false);
  });

  it('happy hour fields round-trip', async () => {
    const p = await promotions.create(manager(), {
      code: 'HAPPY',
      name: 'Happy hour',
      type: 'order_discount',
      discount_kind: 'percent',
      discount_value: 5,
      days_of_week: [6],
      time_from: '17:00',
      time_to: '20:00',
      channels: ['pos'],
    });
    expect([p.days_of_week, p.time_from, p.time_to, p.channels]).toEqual([
      [6],
      '17:00',
      '20:00',
      ['pos'],
    ]);
    await promotions.remove(p.id);
  });

  it('campaigns: 200 prefixed codes, usage, filters, CSV, check reasons', async () => {
    const c = await vouchers.create(manager(), {
      code: 'TET27',
      name: 'Tết 2027 −10%',
      discount_kind: 'percent',
      discount_value: 10,
      max_discount: 200_000,
      min_order_amount: 100_000,
    });
    const gen = await vouchers.generate(c.id, { count: 200, prefix: 'TET27' });
    expect(gen.created).toBe(200);
    expect(new Set(gen.codes).size).toBe(200);
    expect(gen.codes.every((x) => /^TET27[A-HJ-NP-Z2-9]{6}$/.test(x))).toBe(
      true,
    );
    await vouchers.generate(c.id, { code: 'VIPANH' });
    await expect(
      vouchers.generate(c.id, { code: 'VIPANH' }),
    ).rejects.toMatchObject({ status: 409 });

    const code = gen.codes[0];
    expect(
      await vouchers.check({ code: code.toLowerCase(), amount: 50_000 }),
    ).toMatchObject({ ok: false, reason: 'Đơn tối thiểu 100.000 đ' });
    expect(await vouchers.check({ code, amount: 3_000_000 })).toMatchObject({
      ok: true,
      amount: 200_000,
    });
    expect(await vouchers.check({ code: 'NOPE' })).toEqual({
      ok: false,
      reason: 'Mã không tồn tại',
    });

    const rejected = await cart.price({
      store_id: fx.store.id,
      voucher_code: code,
      lines: [{ product_id: fx.products.sticker, quantity: 1 }],
    });
    expect(rejected.voucher).toMatchObject({
      ok: false,
      reason: 'Đơn tối thiểu 100.000 đ',
    });
    expect(rejected.total).toBe(50_000);

    await checkout.checkout({ id: fx.users.store_manager }, {
      client_request_id: randomUUID(),
      voucher_code: code,
      lines: [
        {
          product_id: fx.products.jeans,
          quantity: 1,
          expected_unit_price: 1_000_000,
        },
      ],
      payments: [{ method: CheckoutPaymentMethod.CASH, amount: 900_000 }],
    } as never);
    const stats = (await vouchers.get(c.id)).stats;
    expect(stats).toEqual({
      codes: 201,
      used_codes: 1,
      uses: 1,
      discount: 100_000,
    });
    expect(
      (await vouchers.codes(c.id, { status: 'used' })).data.map((v) => v.code),
    ).toEqual([code]);
    const { csv, fileName } = await vouchers.exportCsv(c.id);
    expect(fileName).toBe('voucher-TET27.csv');
    expect(csv.split('\r\n')).toHaveLength(202);
    await expect(vouchers.remove(c.id)).rejects.toMatchObject({ status: 409 });
  });

  it('routes and grants', async () => {
    const policy = (cls: { prototype: object }, name: string) =>
      (
        Reflect.getMetadata(
          CHECK_POLICIES_KEY,
          (cls.prototype as Record<string, object>)[name],
        ) as PolicyHandler[]
      )[0];
    expect(policy(PromotionsController, 'create')).toEqual({
      action: Action.Create,
      subject: 'promotions',
    });
    expect(policy(PromotionsController, 'remove')).toEqual({
      action: Action.Delete,
      subject: 'promotions',
    });
    expect(policy(VouchersController, 'generate')).toEqual({
      action: Action.Create,
      subject: 'vouchers',
    });
    expect(policy(VouchersController, 'check')).toEqual({
      action: Action.Read,
      subject: 'vouchers',
    });
    expect(policy(CartController, 'price')).toEqual({
      action: Action.Read,
      subject: 'promotions',
    });
    const can = async (role: string, a: Action, s: 'promotions' | 'vouchers') =>
      (await casl.createForUser(fx.users[role])).can(a, s);
    expect(await can('sales_associate', Action.Read, 'promotions')).toBe(true);
    expect(await can('sales_associate', Action.Create, 'vouchers')).toBe(false);
    expect(await can('store_manager', Action.Update, 'promotions')).toBe(false);
    expect(await can('manager', Action.Delete, 'vouchers')).toBe(true);
  });
});
