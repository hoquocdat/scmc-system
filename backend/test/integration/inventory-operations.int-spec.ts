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
import { PurchaseOrdersService } from '../../src/purchase-orders/purchase-orders.service';
import { ReportScope } from '../../src/reports/report-scope';
import { StockReportsService } from '../../src/reports/stock-reports.service';
import { ReturnRequestDto } from '../../src/sales-returns/dto/sales-returns.dto';
import { SalesReturnsService } from '../../src/sales-returns/sales-returns.service';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { SalesService } from '../../src/sales/sales.service';
import {
  CodesService,
  isValidEan13,
} from '../../src/stock-operations/codes.service';
import { CountsService } from '../../src/stock-operations/counts.service';
import { ReorderService } from '../../src/stock-operations/reorder.service';
import { StockOperationsController } from '../../src/stock-operations/stock-operations.controller';
import { TransfersService } from '../../src/stock-operations/transfers.service';
import { WriteOffsService } from '../../src/stock-operations/write-offs.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

/** Specs inventory/* (change inventory-operations). */
describe('inventory operations', () => {
  let fx: SalesFixtures;
  let transfers: TransfersService;
  let counts: CountsService;
  let writeOffs: WriteOffsService;
  let codes: CodesService;
  let reorder: ReorderService;
  let sales: SalesService;
  let checkout: PosCheckoutService;
  let returns: SalesReturnsService;
  let purchaseOrders: PurchaseOrdersService;
  let casl: CaslAbilityFactory;
  let currentUser: string | null = null;
  const u = (role: string) => ({ id: fx.users[role] });
  const HCM = () => fx.store.locationId;
  const HN = () => fx.store2.locationId;

  const stock = async (locationId: string, productId: string) => {
    const r = await testDb.inventory.findFirst({
      where: {
        location_id: locationId,
        product_id: productId,
        product_variant_id: null,
      },
    });
    return {
      onHand: r?.quantity_on_hand ?? 0,
      reserved: r?.quantity_reserved ?? 0,
    };
  };
  const setStock = (locationId: string, productId: string, n: number) =>
    testDb.inventory.updateMany({
      where: {
        location_id: locationId,
        product_id: productId,
        product_variant_id: null,
      },
      data: { quantity_on_hand: n, quantity_reserved: 0 },
    });
  const sell = (
    productId: string,
    quantity: number,
    price: number,
    extra: Record<string, unknown> = {},
  ) =>
    checkout.checkout(u('store_manager'), {
      client_request_id: randomUUID(),
      lines: [
        {
          product_id: productId,
          quantity,
          expected_unit_price: price,
          ...extra,
        },
      ],
      payments: [
        { method: CheckoutPaymentMethod.CASH, amount: quantity * price },
      ],
    } as never);

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
    casl = new CaslAbilityFactory(prisma);
    const activity = new ActivityLogsService(prisma);
    codes = new CodesService(prisma);
    transfers = new TransfersService(prisma, activity);
    counts = new CountsService(prisma, codes, activity);
    writeOffs = new WriteOffsService(prisma, activity);
    purchaseOrders = new PurchaseOrdersService(prisma);
    reorder = new ReorderService(prisma, purchaseOrders);
    sales = new SalesService(prisma, userContext, loyalty, posting, cashBook);
    checkout = new PosCheckoutService(prisma, posting, casl, activity, {
      get: () => 'secret',
    } as unknown as ConfigService);
    returns = new SalesReturnsService(
      prisma,
      posting,
      cashBook,
      loyalty,
      casl,
      activity,
    );
    await new PosService(prisma, casl, activity, cashBook).openShift(
      u('store_manager'),
      { store_id: fx.store.id, opening_cash: 0 },
    );
    // Hanoi has rows for the products too
    for (const p of [
      fx.products.jeans,
      fx.products.sticker,
      fx.products.exhaust,
    ]) {
      await testDb.inventory.upsert({
        where: {
          id:
            (
              await testDb.inventory.findFirst({
                where: { location_id: HN(), product_id: p },
              })
            )?.id ?? randomUUID(),
        },
        update: { quantity_on_hand: 0 },
        create: { location_id: HN(), product_id: p, quantity_on_hand: 0 },
      });
    }
  });
  afterAll(closeTestDb);

  describe('reservations', () => {
    it('a pending order reserves; POS sees available; confirming uses the reservation', async () => {
      await setStock(HCM(), fx.products.jeans, 5);
      currentUser = fx.users.manager;
      const pending = await sales.create({
        customer_id: fx.customers.plain,
        customer_name: 'x',
        channel: 'retail_store',
        store_id: fx.store.id,
        status: 'pending',
        items: [{ product_id: fx.products.jeans, quantity: 3, unit_price: 0 }],
      } as never);
      expect(await stock(HCM(), fx.products.jeans)).toEqual({
        onHand: 5,
        reserved: 3,
      });
      await expect(sell(fx.products.jeans, 3, 1_000_000)).rejects.toMatchObject(
        {
          response: {
            code: 'INSUFFICIENT_STOCK',
            shortages: [{ available: 2 }],
          },
        },
      );
      await sales.confirm(pending.id);
      expect(await stock(HCM(), fx.products.jeans)).toEqual({
        onHand: 2,
        reserved: 0,
      });
    });

    it('cancelling a pending order releases the reservation', async () => {
      await setStock(HCM(), fx.products.jeans, 5);
      currentUser = fx.users.manager;
      const pending = await sales.create({
        customer_id: fx.customers.plain,
        customer_name: 'x',
        channel: 'retail_store',
        store_id: fx.store.id,
        status: 'pending',
        items: [{ product_id: fx.products.jeans, quantity: 2, unit_price: 0 }],
      } as never);
      expect((await stock(HCM(), fx.products.jeans)).reserved).toBe(2);
      await sales.cancel(pending.id);
      expect((await stock(HCM(), fx.products.jeans)).reserved).toBe(0);
    });
  });

  describe('transfers', () => {
    it('ship then receive everything; number CK-YYMM-#####', async () => {
      await setStock(HCM(), fx.products.exhaust, 10);
      const t = await transfers.create(u('store_manager'), {
        from_location_id: HCM(),
        to_location_id: HN(),
        items: [{ product_id: fx.products.exhaust, quantity: 10 }],
      });
      expect(t.transfer_number).toMatch(/^CK-\d{4}-\d{5}$/);
      await transfers.ship(u('store_manager'), t.id, {});
      expect((await stock(HCM(), fx.products.exhaust)).onHand).toBe(0);
      const r = await transfers.receive(u('store_manager'), t.id, {
        items: [{ item_id: t.items[0].id, quantity: 10 }],
      });
      expect(r.status).toBe('received');
      expect((await stock(HN(), fx.products.exhaust)).onHand).toBe(10);
    });

    it('not enough at the source names the item and what is available', async () => {
      await setStock(HCM(), fx.products.exhaust, 6);
      const t = await transfers.create(u('store_manager'), {
        from_location_id: HCM(),
        to_location_id: HN(),
        items: [{ product_id: fx.products.exhaust, quantity: 10 }],
      });
      await expect(
        transfers.ship(u('store_manager'), t.id, {}),
      ).rejects.toMatchObject({
        response: {
          code: 'INSUFFICIENT_STOCK',
          shortages: [{ sku: 'EXH-X', available: 6 }],
        },
      });
    });

    it('partial receipt closed with a discrepancy of 2', async () => {
      await setStock(HCM(), fx.products.sticker, 10);
      await setStock(HN(), fx.products.sticker, 0);
      const t = await transfers.create(u('store_manager'), {
        from_location_id: HCM(),
        to_location_id: HN(),
        items: [{ product_id: fx.products.sticker, quantity: 10 }],
      });
      await transfers.ship(u('store_manager'), t.id, {});
      const part = await transfers.receive(u('store_manager'), t.id, {
        items: [{ item_id: t.items[0].id, quantity: 5 }],
      });
      expect(part.status).toBe('partially_received');
      const done = await transfers.receive(u('store_manager'), t.id, {
        items: [{ item_id: t.items[0].id, quantity: 3 }],
        close: true,
      });
      expect([
        done.status,
        done.items[0].quantity_received,
        done.items[0].quantity_discrepancy,
      ]).toEqual(['received', 8, 2]);
      expect((await stock(HN(), fx.products.sticker)).onHand).toBe(8);
    });

    it('cancel in transit returns the units to the source', async () => {
      await setStock(HCM(), fx.products.sticker, 5);
      const t = await transfers.create(u('store_manager'), {
        from_location_id: HCM(),
        to_location_id: HN(),
        items: [{ product_id: fx.products.sticker, quantity: 5 }],
      });
      await transfers.ship(u('store_manager'), t.id, {});
      expect((await stock(HCM(), fx.products.sticker)).onHand).toBe(0);
      const road = await new StockReportsService(
        testDb as unknown as PrismaService,
      ).inTransit(new ReportScope({}));
      expect(road.rows).toEqual([
        expect.objectContaining({
          transfer: t.transfer_number,
          quantity: 5,
          value: 50_000,
          daysOnRoad: 0,
        }),
      ]);
      const c = await transfers.cancel(u('store_manager'), t.id, 'Xe hỏng');
      expect(c.status).toBe('cancelled');
      expect((await stock(HCM(), fx.products.sticker)).onHand).toBe(5);
    });
  });

  describe('counts', () => {
    it('sale after counting is not double counted; a shortage is posted; one open count per location', async () => {
      await setStock(HCM(), fx.products.jeans, 5);
      await setStock(HCM(), fx.products.sticker, 9);
      const c = await counts.start(u('store_manager'), {
        location_id: HCM(),
        scope: {
          type: 'products',
          product_ids: [fx.products.jeans, fx.products.sticker],
        },
      });
      expect(c.count_number).toMatch(/^KK-/);
      await expect(
        counts.start(u('store_manager'), {
          location_id: HCM(),
          scope: { type: 'all' },
        }),
      ).rejects.toMatchObject({ status: 409 });
      const jeans = c.items.find((i) => i.sku === 'JEANS-A');
      await counts.enter(
        u('warehouse_staff' in fx.users ? 'warehouse_staff' : 'store_manager'),
        c.id,
        { item_id: jeans.id, quantity: 5 },
      );
      await sell(fx.products.jeans, 1, 1_000_000);
      for (let n = 0; n < 7; n++)
        await counts.enter(u('store_manager'), c.id, {
          code: 'sticker',
          increment: 1,
        });
      const review = await counts.get(c.id);
      expect(review.items.map((i) => [i.sku, i.difference])).toEqual([
        ['JEANS-A', 0],
        ['STICKER', -2],
      ]);
      await counts.complete(u('store_manager'), c.id);
      expect([
        (await stock(HCM(), fx.products.jeans)).onHand,
        (await stock(HCM(), fx.products.sticker)).onHand,
      ]).toEqual([4, 7]);
      const variances = await new StockReportsService(
        testDb as unknown as PrismaService,
      ).countVariances(new ReportScope({}), HCM());
      expect(variances.rows).toEqual([
        expect.objectContaining({
          sku: 'STICKER',
          system: 9,
          counted: 7,
          difference: -2,
          value: -20_000,
        }),
      ]);
      expect(variances.meta?.shortageValue).toBe(-20_000);
    });
  });

  describe('write-offs', () => {
    it('2 damaged exhausts at cost; more than available refused', async () => {
      await setStock(HCM(), fx.products.exhaust, 3);
      const cost = Number(
        (
          await testDb.products.findUniqueOrThrow({
            where: { id: fx.products.exhaust },
          })
        ).cost_price,
      );
      const w = await writeOffs.create(u('store_manager'), {
        location_id: HCM(),
        reason: 'damaged',
        items: [{ product_id: fx.products.exhaust, quantity: 2 }],
      });
      expect(w.write_off_number).toMatch(/^XH-/);
      expect(w.total_cost).toBe(cost * 2);
      expect((await stock(HCM(), fx.products.exhaust)).onHand).toBe(1);
      await expect(
        writeOffs.create(u('store_manager'), {
          location_id: HCM(),
          reason: 'lost',
          items: [{ product_id: fx.products.exhaust, quantity: 2 }],
        }),
      ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
      expect((await writeOffs.list({})).rows).toHaveLength(1);
    });
  });

  describe('barcodes', () => {
    it('generate EAN-13 starting with 20, duplicate refused, lookup finds the variant', async () => {
      const g = await codes.generate('product', fx.products.jeans);
      expect(g.barcode).toMatch(/^20\d{11}$/);
      expect(isValidEan13(g.barcode)).toBe(true);
      await expect(
        codes.setBarcode('variant', fx.variants.size32, g.barcode),
      ).rejects.toMatchObject({ status: 409 });
      await codes.setBarcode('variant', fx.variants.size32, '8930000000321');
      expect(await codes.lookup('8930000000321')).toMatchObject({
        kind: 'variant',
        variant_id: fx.variants.size32,
      });
      expect(await codes.lookup(g.barcode)).toMatchObject({
        kind: 'product',
        product_id: fx.products.jeans,
      });
    });
  });

  describe('reorder alerts', () => {
    it('helmets below the reorder point with reorder quantity 20; draft purchase order', async () => {
      await testDb.products.update({
        where: { id: fx.products.exhaust },
        data: { reorder_point: 5, reorder_quantity: 20 },
      });
      await setStock(HCM(), fx.products.exhaust, 4);
      const alerts = await reorder.alerts(HCM());
      expect(alerts.find((a) => a.sku === 'EXH-X')).toMatchObject({
        available: 4,
        threshold: 5,
        suggested: 20,
      });
      const supplier = await testDb.suppliers.create({
        data: { name: 'Momotaro' },
      });
      const po = await reorder.draftPurchaseOrder(fx.users.manager, {
        supplier_id: supplier.id,
        items: [{ product_id: fx.products.exhaust, quantity: 20 }],
      });
      expect(po.status).toBe('draft');
      expect(po.purchase_order_items[0].quantity_ordered).toBe(20);
    });
  });

  describe('units of measure', () => {
    it('2 boxes of 10 stickers at 450,000; a returned box restocks 10; 5 boxes received add 50', async () => {
      await setStock(HCM(), fx.products.sticker, 30);
      await codes.setBaseUnit(fx.products.sticker, 'cái');
      const { units } = await codes.addUnit(fx.products.sticker, {
        name: 'hộp',
        factor: 10,
        price: 450_000,
        barcode: '8930000000999',
      });
      const box = units[0];
      expect(await codes.lookup('8930000000999')).toMatchObject({
        kind: 'unit',
        unit_factor: 10,
      });
      const order = await sell(fx.products.sticker, 2, 450_000, {
        unit_id: box.id,
      });
      expect(Number(order.total_amount)).toBe(900_000);
      expect(order.sales_order_items[0]).toMatchObject({
        unit_name: 'hộp',
        unit_factor: 10,
        quantity: 2,
      });
      expect((await stock(HCM(), fx.products.sticker)).onHand).toBe(10);
      await returns.create(u('store_manager'), {
        sales_order_id: order.id,
        items: [
          { sales_order_item_id: order.sales_order_items[0].id, quantity: 1 },
        ],
        refunds: [{ method: 'cash', amount: 450_000 }],
      } as ReturnRequestDto);
      expect((await stock(HCM(), fx.products.sticker)).onHand).toBe(20);

      const supplier = await testDb.suppliers.create({
        data: { name: 'Sticker Co' },
      });
      const po = await purchaseOrders.create(
        {
          supplier_id: supplier.id,
          items: [
            {
              product_id: fx.products.sticker,
              product_name: 'Sticker',
              quantity_ordered: 5,
              unit_cost: 200_000,
              unit_name: 'hộp',
              unit_factor: 10,
            },
          ],
        } as never,
        fx.users.manager,
      );
      await testDb.purchase_orders.update({
        where: { id: po.id },
        data: { status: 'pending_approval' },
      });
      const defaultLoc = await testDb.stock_locations.findFirst({
        where: { OR: [{ is_default: true }, { code: 'MAIN' }] },
      });
      const before = defaultLoc
        ? (await stock(defaultLoc.id, fx.products.sticker)).onHand
        : 0;
      await purchaseOrders.approve(po.id, fx.users.manager);
      if (defaultLoc)
        expect((await stock(defaultLoc.id, fx.products.sticker)).onHand).toBe(
          before + 50,
        );
    });
  });

  describe('permissions', () => {
    it('routes and grants', async () => {
      const policy = (name: keyof StockOperationsController) =>
        (
          Reflect.getMetadata(
            CHECK_POLICIES_KEY,
            StockOperationsController.prototype[name] as object,
          ) as PolicyHandler[]
        )[0];
      expect(policy('ship')).toEqual({
        action: Action.Transfer,
        subject: 'inventory',
      });
      expect(policy('complete')).toEqual({
        action: Action.ApproveCount,
        subject: 'inventory',
      });
      expect(policy('createWriteOff')).toEqual({
        action: Action.WriteOff,
        subject: 'inventory',
      });
      const can = async (role: string, a: Action) =>
        (await casl.createForUser(fx.users[role])).can(a, 'inventory');
      expect(await can('sales_associate', Action.WriteOff)).toBe(false);
      expect(await can('store_manager', Action.WriteOff)).toBe(true);
      expect(await can('store_manager', Action.ApproveCount)).toBe(true);
      expect(await can('sales_associate', Action.ApproveCount)).toBe(false);
    });
  });
});
