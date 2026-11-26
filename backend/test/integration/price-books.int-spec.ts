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
import {
  PriceBookNotApplicableException,
  PriceResolverService,
} from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { SalesService } from '../../src/sales/sales.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

const D = (n: number) => new Prisma.Decimal(n);
const DAY = 86_400_000;

/** Specs pricing/price-resolution and pricing/price-books (resolution side). */
describe('price books', () => {
  let fx: SalesFixtures;
  let prices: PriceResolverService;
  let checkout: PosCheckoutService;
  let shifts: PosService;
  let sales: SalesService;
  let currentUser: string | null = null;
  let wholesaleGroup: string;
  let partnerGroup: string;

  const book = async (data: {
    code: string;
    priority?: number;
    groups?: string[];
    stores?: string[];
    allow_manual?: boolean;
    start_at?: Date;
    end_at?: Date;
    entries: {
      product_id: string;
      product_variant_id?: string;
      mode: string;
      value: number;
    }[];
  }) =>
    testDb.price_books.create({
      data: {
        code: data.code,
        name: `Book ${data.code}`,
        priority: data.priority ?? 0,
        all_customers: !data.groups,
        all_stores: !data.stores,
        allow_manual: data.allow_manual ?? false,
        start_at: data.start_at,
        end_at: data.end_at,
        price_book_customer_groups: data.groups
          ? { create: data.groups.map((group_id) => ({ group_id })) }
          : undefined,
        price_book_stores: data.stores
          ? { create: data.stores.map((store_id) => ({ store_id })) }
          : undefined,
        price_book_entries: {
          create: data.entries.map((e) => ({ ...e, value: D(e.value) })),
        },
      },
    });

  const price = async (
    item: { product_id: string; product_variant_id?: string },
    ctx: Parameters<PriceResolverService['resolveMany']>[1],
  ) =>
    (await prices.resolveMany([item], ctx)).get(PriceResolverService.key(item));

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    const userContext = {
      getUserId: () => currentUser,
      getUser: () => null,
    } as unknown as UserContextService;
    const cashBook = new CashBookPostingService(prisma);
    prices = new PriceResolverService(prisma);
    const loyalty = new LoyaltyService(prisma);
    const posting = new SalesPostingService(prisma, prices, loyalty, cashBook);
    const casl = new CaslAbilityFactory(prisma);
    const activity = new ActivityLogsService(prisma);
    shifts = new PosService(prisma, casl, activity, cashBook);
    checkout = new PosCheckoutService(prisma, posting, casl, activity, {
      get: () => 'secret',
    } as unknown as ConfigService);
    sales = new SalesService(prisma, userContext, loyalty, posting, cashBook);
    await testDb.inventory.updateMany({
      where: { location_id: fx.store.locationId },
      data: { quantity_on_hand: 500 },
    });
    wholesaleGroup = (
      await testDb.customer_groups.create({
        data: { code: 'WHOLESALE', name: 'Wholesale' },
      })
    ).id;
    partnerGroup = (
      await testDb.customer_groups.create({
        data: { code: 'PARTNER', name: 'Partner workshop' },
      })
    ).id;
    // plain = wholesale customer; member = wholesale + partner
    await testDb.customer_group_members.createMany({
      data: [
        { customer_id: fx.customers.plain, group_id: wholesaleGroup },
        { customer_id: fx.customers.member, group_id: wholesaleGroup },
        { customer_id: fx.customers.member, group_id: partnerGroup },
      ],
    });
  });
  afterEach(async () => {
    await testDb.sales_order_items.updateMany({
      data: { price_book_id: null },
    });
    await testDb.sales_orders.updateMany({ data: { price_book_id: null } });
    await testDb.price_books.deleteMany({});
    await testDb.customer_groups.updateMany({ data: { is_active: true } });
  });
  afterAll(closeTestDb);

  describe('resolution', () => {
    it('no price books: base price, no book recorded', async () => {
      const p = await price(
        { product_id: fx.products.jeans },
        { storeId: fx.store.id, customerId: fx.customers.plain },
      );
      expect(p).toMatchObject({
        unitPrice: 1_000_000,
        priceBookId: null,
        source: 'retail',
      });
    });

    it('wholesale customer gets the book price; walk-in gets the base', async () => {
      const si = await book({
        code: 'SI',
        priority: 10,
        groups: [wholesaleGroup],
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 800_000 },
        ],
      });
      expect(
        await price(
          { product_id: fx.products.jeans },
          { storeId: fx.store.id, customerId: fx.customers.plain },
        ),
      ).toMatchObject({
        unitPrice: 800_000,
        basePrice: 1_000_000,
        priceBookId: si.id,
        source: 'price_book',
      });
      expect(
        (
          await price(
            { product_id: fx.products.jeans },
            { storeId: fx.store.id },
          )
        ).unitPrice,
      ).toBe(1_000_000);
    });

    it('higher priority wins', async () => {
      await book({
        code: 'SI',
        priority: 10,
        groups: [wholesaleGroup],
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 800_000 },
        ],
      });
      await book({
        code: 'DT',
        priority: 20,
        groups: [partnerGroup],
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 700_000 },
        ],
      });
      const p = await price(
        { product_id: fx.products.jeans },
        { storeId: fx.store.id, customerId: fx.customers.member },
      );
      expect(p).toMatchObject({ unitPrice: 700_000, priceBookName: 'Book DT' });
    });

    it('branch condition and dates', async () => {
      await book({
        code: 'HN',
        stores: [fx.store2.id],
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 900_000 },
        ],
      });
      await book({
        code: 'OLD',
        end_at: new Date(Date.now() - DAY),
        entries: [
          { product_id: fx.products.sticker, mode: 'fixed', value: 1_000 },
        ],
      });
      expect(
        (
          await price(
            { product_id: fx.products.jeans },
            { storeId: fx.store.id },
          )
        ).unitPrice,
      ).toBe(1_000_000);
      expect(
        (
          await price(
            { product_id: fx.products.jeans },
            { storeId: fx.store2.id },
          )
        ).unitPrice,
      ).toBe(900_000);
      expect(
        (
          await price(
            { product_id: fx.products.sticker },
            { storeId: fx.store.id },
          )
        ).unitPrice,
      ).toBe(50_000);
    });

    it('percent off a product applies to each variant base; sale price is the base', async () => {
      await book({
        code: 'VIP',
        entries: [
          { product_id: fx.products.master, mode: 'percent_off', value: 10 },
          {
            product_id: fx.products.exhaust,
            mode: 'amount_off',
            value: 500_000,
          },
        ],
      });
      expect(
        (
          await price(
            {
              product_id: fx.products.master,
              product_variant_id: fx.variants.size32,
            },
            { storeId: fx.store.id },
          )
        ).unitPrice,
      ).toBe(1_440_000); // (1,500,000 + 100,000) × 90%
      expect(
        (
          await price(
            { product_id: fx.products.exhaust },
            { storeId: fx.store.id },
          )
        ).unitPrice,
      ).toBe(2_000_000); // sale 2,500,000 − 500,000
    });

    it('inactive group stops the book from applying', async () => {
      await book({
        code: 'SI',
        groups: [wholesaleGroup],
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 800_000 },
        ],
      });
      await testDb.customer_groups.update({
        where: { id: wholesaleGroup },
        data: { is_active: false },
      });
      expect(
        (
          await price(
            { product_id: fx.products.jeans },
            { storeId: fx.store.id, customerId: fx.customers.plain },
          )
        ).unitPrice,
      ).toBe(1_000_000);
    });

    it('manual choice: customer condition waived, items not in the book at base', async () => {
      const si = await book({
        code: 'SI',
        groups: [wholesaleGroup],
        allow_manual: true,
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 800_000 },
        ],
      });
      await book({
        code: 'ALL',
        entries: [
          { product_id: fx.products.sticker, mode: 'fixed', value: 40_000 },
        ],
      });
      const r = await prices.resolveMany(
        [
          { product_id: fx.products.jeans },
          { product_id: fx.products.sticker },
        ],
        { storeId: fx.store.id, priceBookId: si.id },
      );
      expect(r.get(`${fx.products.jeans}:`)?.unitPrice).toBe(800_000);
      expect(r.get(`${fx.products.sticker}:`)?.unitPrice).toBe(50_000);
    });

    it('a book that does not allow manual choice is refused', async () => {
      const auto = await book({
        code: 'AUTO',
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 800_000 },
        ],
      });
      await expect(
        price(
          { product_id: fx.products.jeans },
          { storeId: fx.store.id, priceBookId: auto.id },
        ),
      ).rejects.toBeInstanceOf(PriceBookNotApplicableException);
    });
  });

  describe('sales', () => {
    let managerShift: string;

    beforeAll(async () => {
      managerShift = (
        await shifts.openShift(
          { id: fx.users.store_manager },
          { store_id: fx.store.id, opening_cash: 0 },
        )
      ).id;
      await shifts.openShift(
        { id: fx.users.sales_associate },
        { store_id: fx.store.id, opening_cash: 0 },
      );
    });

    const cart = (expected: number, priceBookId?: string) => ({
      client_request_id: randomUUID(),
      customer_id: fx.customers.plain,
      price_book_id: priceBookId,
      lines: [
        {
          product_id: fx.products.jeans,
          quantity: 1,
          expected_unit_price: expected,
        },
      ],
      payments: [{ method: CheckoutPaymentMethod.CASH, amount: expected }],
    });

    it('POS sale of a wholesale customer is priced and recorded from the book', async () => {
      const si = await book({
        code: 'SI',
        groups: [wholesaleGroup],
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 800_000 },
        ],
      });
      const order = await checkout.checkout(
        { id: fx.users.store_manager },
        cart(800_000) as never,
      );
      expect(order.pos_session_id).toBe(managerShift);
      const [line] = await testDb.sales_order_items.findMany({
        where: { sales_order_id: order.id },
      });
      expect(Number(line.unit_price)).toBe(800_000);
      expect(Number(line.base_unit_price)).toBe(1_000_000);
      expect(line.price_book_id).toBe(si.id);
      expect(line.price_source).toBe('price_book');
    });

    it('a book that started while the cart was built: PRICE_CHANGED', async () => {
      await book({
        code: 'SI',
        groups: [wholesaleGroup],
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 800_000 },
        ],
      });
      await expect(
        checkout.checkout(
          { id: fx.users.store_manager },
          cart(1_000_000) as never,
        ),
      ).rejects.toMatchObject({
        response: { code: 'PRICE_CHANGED', changes: [{ unit_price: 800_000 }] },
      });
    });

    it('manual book: store manager allowed and recorded on the order, sales associate refused', async () => {
      const si = await book({
        code: 'SI',
        groups: [partnerGroup],
        allow_manual: true,
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 750_000 },
        ],
      });
      const order = await checkout.checkout(
        { id: fx.users.store_manager },
        cart(750_000, si.id) as never,
      );
      expect(
        (
          await testDb.sales_orders.findUniqueOrThrow({
            where: { id: order.id },
          })
        ).price_book_id,
      ).toBe(si.id);
      await expect(
        checkout.checkout(
          { id: fx.users.sales_associate },
          cart(750_000, si.id) as never,
        ),
      ).rejects.toMatchObject({ response: { code: 'PRICE_BOOK_FORBIDDEN' } });
    });

    it('back-office order and an added line are priced from the book, whatever the request says', async () => {
      await book({
        code: 'SI',
        groups: [wholesaleGroup],
        entries: [
          { product_id: fx.products.jeans, mode: 'fixed', value: 800_000 },
          { product_id: fx.products.sticker, mode: 'fixed', value: 30_000 },
        ],
      });
      currentUser = fx.users.finance;
      const draft = await sales.create({
        customer_id: fx.customers.plain,
        customer_name: 'x',
        channel: 'retail_store',
        store_id: fx.store.id,
        items: [{ product_id: fx.products.jeans, quantity: 1, unit_price: 0 }],
      } as never);
      expect(Number(draft.subtotal)).toBe(800_000);
      await sales.addItem(draft.id, {
        product_id: fx.products.sticker,
        quantity: 2,
        unit_price: 1,
      } as never);
      const sticker = await testDb.sales_order_items.findFirstOrThrow({
        where: { sales_order_id: draft.id, product_id: fx.products.sticker },
      });
      expect(Number(sticker.unit_price)).toBe(30_000);
      expect(Number(sticker.base_unit_price)).toBe(50_000);
      expect(sticker.price_book_id).not.toBeNull();
    });
  });
});
