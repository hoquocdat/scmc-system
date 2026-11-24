import 'reflect-metadata';
import * as ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import {
  Action,
  CaslAbilityFactory,
} from '../../src/casl/casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
} from '../../src/casl/check-policies.decorator';
import { CustomerGroupsService } from '../../src/price-books/customer-groups.service';
import {
  CustomerGroupsController,
  PriceBooksController,
  PricingController,
} from '../../src/price-books/price-books.controller';
import { PriceBooksService } from '../../src/price-books/price-books.service';
import { PricingService } from '../../src/price-books/pricing.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

const D = (n: number) => new Prisma.Decimal(n);

/** Specs pricing/price-books and customers/customer-groups over the services and route policies. */
describe('price books API', () => {
  let fx: SalesFixtures;
  let books: PriceBooksService;
  let groups: CustomerGroupsService;
  let pricing: PricingService;
  let casl: CaslAbilityFactory;
  let wholesaleId: string;
  let siId: string;

  beforeAll(async () => {
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    books = new PriceBooksService(prisma);
    groups = new CustomerGroupsService(prisma);
    pricing = new PricingService(prisma, new PriceResolverService(prisma));
    casl = new CaslAbilityFactory(prisma);
  });
  afterAll(closeTestDb);

  describe('customer groups', () => {
    it('creates a group with 0 members; duplicate code refused', async () => {
      const g = await groups.create(fx.users.manager, {
        code: 'wholesale',
        name: 'Wholesale',
      });
      wholesaleId = g.id;
      expect(g.code).toBe('wholesale'); // DTO transform uppercases on HTTP; service stores as given
      await testDb.customer_groups.update({
        where: { id: g.id },
        data: { code: 'WHOLESALE' },
      });
      expect(
        (await groups.list()).find((x) => x.id === g.id)?.member_count,
      ).toBe(0);
      await expect(
        groups.create(fx.users.manager, { code: 'WHOLESALE', name: 'x' }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('sets a customer’s groups and filters the list', async () => {
      const partner = await groups.create(fx.users.manager, {
        code: 'PARTNER',
        name: 'Partner workshop',
      });
      const set = await groups.setGroupsOf(fx.customers.plain, [
        wholesaleId,
        partner.id,
      ]);
      expect(set.map((g) => g.code).sort()).toEqual(['PARTNER', 'WHOLESALE']);
      expect(
        (await groups.setGroupsOf(fx.customers.plain, [wholesaleId])).map(
          (g) => g.code,
        ),
      ).toEqual(['WHOLESALE']);
      const inGroup = await testDb.customers.findMany({
        where: { customer_group_members: { some: { group_id: wholesaleId } } },
      });
      expect(inGroup.map((c) => c.id)).toEqual([fx.customers.plain]);
      // a group with members cannot be deleted; an unused one can
      await expect(groups.remove(wholesaleId)).rejects.toMatchObject({
        status: 409,
      });
      expect(await groups.remove(partner.id)).toEqual({ id: partner.id });
    });
  });

  describe('price books and entries', () => {
    it('creates "Giá sỉ" with conditions and 0 entries', async () => {
      const b = await books.create(fx.users.manager, {
        code: 'GIA-SI',
        name: 'Giá sỉ',
        priority: 10,
        group_ids: [wholesaleId],
        allow_manual: true,
      });
      siId = b.id;
      expect(b).toMatchObject({
        all_stores: true,
        all_customers: false,
        entry_count: 0,
        groups: [{ id: wholesaleId }],
      });
      // a group used by a price book cannot be deleted either
      await testDb.customer_group_members.deleteMany({});
      await expect(groups.remove(wholesaleId)).rejects.toMatchObject({
        status: 409,
      });
    });

    it('refuses a duplicate code and an end before start', async () => {
      await expect(
        books.create(fx.users.manager, { code: 'GIA-SI', name: 'x' }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        books.create(fx.users.manager, {
          code: 'BAD',
          name: 'x',
          start_at: '2027-02-01T00:00:00Z',
          end_at: '2027-01-01T00:00:00Z',
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        books.update(fx.users.manager, siId, {
          end_at: '2000-01-01T00:00:00Z',
          start_at: '2001-01-01T00:00:00Z',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('fixed and percent entries list their resulting price; percent > 100 refused', async () => {
      await books.upsertEntry(siId, {
        product_id: fx.products.jeans,
        mode: 'fixed',
        value: 800_000,
      });
      await books.upsertEntry(siId, {
        product_id: fx.products.master,
        mode: 'percent_off',
        value: 15,
      });
      await books.upsertEntry(siId, {
        product_id: fx.products.master,
        product_variant_id: fx.variants.size32,
        mode: 'amount_off',
        value: 100_000,
      });
      // upsert replaces, not duplicates
      await books.upsertEntry(siId, {
        product_id: fx.products.jeans,
        mode: 'fixed',
        value: 820_000,
      });
      const { data, pagination } = await books.entries(siId, {});
      expect(pagination.total).toBe(3);
      const byKey = Object.fromEntries(
        data.map((e) => [`${e.sku}`, { base: e.base_price, price: e.price }]),
      );
      expect(byKey['JEANS-A']).toEqual({ base: 1_000_000, price: 820_000 });
      expect(byKey['JEANS-B']).toEqual({ base: 1_500_000, price: 1_275_000 });
      expect(byKey['JEANS-B-32']).toEqual({
        base: 1_600_000,
        price: 1_500_000,
      });
      expect(
        (await books.entries(siId, { search: 'b-32' })).pagination.total,
      ).toBe(1);
      await expect(
        books.upsertEntry(siId, {
          product_id: fx.products.jeans,
          mode: 'percent_off',
          value: 120,
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        books.upsertEntry(siId, {
          product_id: fx.products.jeans,
          product_variant_id: fx.variants.size32,
          mode: 'fixed',
          value: 1,
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('bulk add by category keeps existing entries', async () => {
      const cat = await testDb.product_categories.create({
        data: { name: 'Găng tay', slug: `gang-tay-${Date.now()}` } as never,
      });
      await testDb.products.updateMany({
        where: { id: { in: [fx.products.jeans, fx.products.sticker] } },
        data: { category_id: cat.id },
      });
      const r = await books.bulkAdd(siId, {
        category_id: cat.id,
        mode: 'percent_off',
        value: 10,
      });
      expect(r).toEqual({ created: 1, skipped: 1 });
      const jeans = await testDb.price_book_entries.findFirstOrThrow({
        where: { price_book_id: siId, product_id: fx.products.jeans },
      });
      expect(jeans.mode).toBe('fixed');
    });

    it('export then import the same file leaves entries unchanged', async () => {
      const before = await testDb.price_book_entries.findMany({
        where: { price_book_id: siId },
        orderBy: { id: 'asc' },
      });
      const { buffer, fileName } = await books.exportXlsx(siId);
      expect(fileName).toBe('bang-gia-GIA-SI.xlsx');
      expect(await books.importXlsx(siId, buffer)).toEqual({
        imported: before.length,
      });
      const after = await testDb.price_book_entries.findMany({
        where: { price_book_id: siId },
        orderBy: { id: 'asc' },
      });
      expect(after.map((e) => [e.id, e.mode, Number(e.value)])).toEqual(
        before.map((e) => [e.id, e.mode, Number(e.value)]),
      );
    });

    it('import with an unknown SKU writes nothing and names the row', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('x');
      ws.addRow(['SKU', 'Variant SKU', 'Mode', 'Value']);
      ws.addRow(['JEANS-A', '', 'Giá cố định', 777_000]);
      ws.addRow(['NOPE', '', 'fixed', 1]);
      ws.addRow(['STICKER', '', 'Giảm %', 150]);
      const file = Buffer.from(await wb.xlsx.writeBuffer());
      await expect(books.importXlsx(siId, file)).rejects.toMatchObject({
        status: 422,
        response: {
          errors: [
            { row: 3, message: expect.stringContaining('NOPE') },
            { row: 4, message: expect.stringContaining('0 đến 100') },
          ],
        },
      });
      const jeans = await testDb.price_book_entries.findFirstOrThrow({
        where: { price_book_id: siId, product_id: fx.products.jeans },
      });
      expect(Number(jeans.value)).toBe(820_000);
    });

    it('list warns when two active books share a priority', async () => {
      await books.create(fx.users.manager, {
        code: 'OTHER',
        name: 'Other',
        priority: 10,
      });
      const list = await books.list();
      expect(
        list
          .filter((b) => b.shares_priority)
          .map((b) => b.code)
          .sort(),
      ).toEqual(['GIA-SI', 'OTHER']);
    });
  });

  describe('quote and applicable books', () => {
    beforeAll(async () => {
      await testDb.price_books.deleteMany({ where: { code: 'OTHER' } });
      await testDb.customer_group_members.create({
        data: { customer_id: fx.customers.plain, group_id: wholesaleId },
      });
    });

    it('wholesale customer: book price and source; walk-in: base', async () => {
      const items = [
        { product_id: fx.products.jeans },
        { product_id: fx.products.exhaust },
      ];
      const w = await pricing.quote({
        store_id: fx.store.id,
        customer_id: fx.customers.plain,
        items,
      });
      expect(w.items).toEqual([
        expect.objectContaining({
          unit_price: 820_000,
          base_price: 1_000_000,
          price_book_name: 'Giá sỉ',
          source: 'price_book',
        }),
        expect.objectContaining({
          unit_price: 2_500_000,
          price_book_id: null,
          source: 'sale',
        }),
      ]);
      const walkIn = await pricing.quote({ store_id: fx.store.id, items });
      expect(walkIn.items[0]).toMatchObject({
        unit_price: 1_000_000,
        price_book_id: null,
      });
    });

    it('applicable books: automatic for the customer, choosable for anyone', async () => {
      const w = await pricing.applicableBooks({
        store_id: fx.store.id,
        customer_id: fx.customers.plain,
      });
      expect(w.automatic.map((b) => b.code)).toEqual(['GIA-SI']);
      expect(w.choosable.map((b) => b.code)).toEqual(['GIA-SI']);
      const walkIn = await pricing.applicableBooks({ store_id: fx.store.id });
      expect(walkIn.automatic).toEqual([]);
      expect(walkIn.choosable.map((b) => b.code)).toEqual(['GIA-SI']);
    });
  });

  describe('permissions', () => {
    const policy = (cls: { prototype: object }, name: string) =>
      (
        Reflect.getMetadata(
          CHECK_POLICIES_KEY,
          (cls.prototype as Record<string, object>)[name],
        ) as PolicyHandler[]
      )[0];

    it('routes carry the expected policies', () => {
      expect(policy(PriceBooksController, 'list')).toEqual({
        action: Action.Read,
        subject: 'price_books',
      });
      expect(policy(PriceBooksController, 'create')).toEqual({
        action: Action.Create,
        subject: 'price_books',
      });
      expect(policy(PriceBooksController, 'upsertEntry')).toEqual({
        action: Action.Update,
        subject: 'price_books',
      });
      expect(policy(PriceBooksController, 'import')).toEqual({
        action: Action.Update,
        subject: 'price_books',
      });
      expect(policy(PriceBooksController, 'remove')).toEqual({
        action: Action.Delete,
        subject: 'price_books',
      });
      expect(policy(PricingController, 'quote')).toEqual({
        action: Action.Read,
        subject: 'price_books',
      });
      expect(policy(CustomerGroupsController, 'setGroupsOf')).toEqual({
        action: Action.Update,
        subject: 'customer_groups',
      });
      expect(policy(CustomerGroupsController, 'remove')).toEqual({
        action: Action.Delete,
        subject: 'customer_groups',
      });
    });

    it('grant matrix: sales associate reads only; store manager applies; manager edits', async () => {
      const can = async (
        role: string,
        action: Action,
        subject: 'price_books' | 'customer_groups',
      ) => (await casl.createForUser(fx.users[role])).can(action, subject);
      expect(await can('sales_associate', Action.Read, 'price_books')).toBe(
        true,
      );
      expect(await can('sales_associate', Action.Update, 'price_books')).toBe(
        false,
      );
      expect(await can('sales_associate', Action.Apply, 'price_books')).toBe(
        false,
      );
      expect(await can('store_manager', Action.Apply, 'price_books')).toBe(
        true,
      );
      expect(await can('store_manager', Action.Update, 'customer_groups')).toBe(
        true,
      );
      expect(await can('store_manager', Action.Delete, 'customer_groups')).toBe(
        false,
      );
      expect(await can('manager', Action.Update, 'price_books')).toBe(true);
      expect(await can('finance', Action.Update, 'price_books')).toBe(false);
    });

    it('a price book deleted after a sale leaves the sold line intact', async () => {
      const order = await testDb.sales_orders.create({
        data: {
          order_number: `SO-T-${Date.now()}`.slice(0, 20),
          channel: 'retail_store',
          store_id: fx.store.id,
          customer_name: 'x',
          subtotal: D(820_000),
          total_amount: D(820_000),
          price_book_id: siId,
          sales_order_items: {
            create: {
              product_id: fx.products.jeans,
              product_name: 'Jeans',
              quantity: 1,
              unit_price: D(820_000),
              total_amount: D(820_000),
              price_book_id: siId,
              base_unit_price: D(1_000_000),
              price_source: 'price_book',
            },
          },
        } as never,
      });
      await books.remove(siId);
      const line = await testDb.sales_order_items.findFirstOrThrow({
        where: { sales_order_id: order.id },
      });
      expect(Number(line.unit_price)).toBe(820_000);
      expect(line.price_book_id).toBeNull();
    });
  });
});
