/**
 * Report fixtures for integration tests.
 *
 * Everything is dated in Vietnam time (Asia/Ho_Chi_Minh, UTC+7) in March 2026
 * unless stated otherwise. The numbers below are the single source of truth
 * for the expected values asserted by report tests; change them here and the
 * tests follow.
 *
 * Retail (sales orders):
 *   SO-T-0001 completed  HCMC 2026-03-05 10:00  Jeans A x2 @1,000,000 (-50,000/unit), Exhaust X x1 @3,000,000 (tax 300,000)
 *                                               order discount 100,000, loyalty discount 50,000 -> total 5,050,000
 *                                               paid cash 2,000,000 + card 3,050,000 (completed)
 *   SO-T-0002 confirmed  Hanoi 2026-03-05 06:30  Jeans B/32 (variant, own cost 400,000) x1 @3,000,000 -> total 3,000,000
 *                                               paid bank_transfer 1,000,000 (completed) -> money received differs from sales
 *                                               06:30 VN = 23:30 UTC on 2026-03-04 (time-zone scenario)
 *   SO-T-0003 cancelled  HCMC 2026-03-10        Exhaust X x1 @500,000; payment cash 500,000 status refunded (not completed)
 *   SO-T-0004 draft      HCMC 2026-03-12        Jeans A x1 @300,000 -> excluded from revenue
 *   SO-T-0005 processing Hanoi 2026-03-15        Sticker (no category) x4 @50,000 -> 200,000, paid cash
 *   SO-T-0006 ready      HCMC 2026-03-20        Jeans A x1 @1,000,000 tax 80,000 -> 1,080,000, paid ewallet_momo
 *   SO-T-0007 completed  HCMC 2026-02-28 20:00  Sticker x14 @50,000 -> 700,000, paid cash (February: boundary)
 *   SO-T-0008 completed  Hanoi 2026-03-31 21:00  Jeans A x1 @900,000 -> 900,000, paid cash (end-date inclusive)
 *   SO-T-0009 pending    HCMC 2026-03-18        Sticker x8 @50,000 -> 400,000 -> excluded from revenue
 *
 * Stock movements (SALE) carry unit_cost for SO-T-0001 and SO-T-0002 only;
 * the other sales have no recorded cost (estimated COGS scenario).
 *
 * Workshop (service orders):
 *   SV-T-0001 delivered HCMC drop 03-01, pickup 03-03 (2 days), final 4,000,000, techs A (primary) + B, paid cash 4,000,000
 *   SV-T-0002 delivered Hanoi drop 03-10, pickup 03-14 (4 days), estimated 2,500,000 (no final), assigned_employee A only
 *   SV-T-0003 in_progress HCMC, SV-T-0004 waiting_parts HCMC, SV-T-0005 in_progress Hanoi
 *   SV-T-0006 delivered HCMC drop 02-20, pickup 02-25, final 1,500,000 (February)
 *   SV-T-0007 delivered HCMC drop 02-26, pickup 03-02 (4 days), final 1,000,000 (received Feb, delivered March)
 *   Parts: Brake pad x2 @150,000 on SV-T-0001; Oil filter x1 @100,000 on SV-T-0002; Brake pad x1 @150,000 on SV-T-0003
 */
import { Prisma, service_status } from '@prisma/client';
import { randomUUID } from 'crypto';
import { testDb } from './db';

/** Builds a UTC Date from a Vietnam-time wall clock string "YYYY-MM-DD HH:mm". */
export function vn(dateTime: string): Date {
  const [date, time = '00:00'] = dateTime.split(' ');
  return new Date(`${date}T${time}:00+07:00`);
}

const D = (n: number) => new Prisma.Decimal(n);

export interface ReportFixtures {
  stores: { hcmc: string; hanoi: string };
  locations: { hcmc: string; hanoi: string };
  categories: { denim: string; exhaust: string };
  products: {
    jeansA: string;
    exhaustX: string;
    sticker: string;
    jeansB: string;
  };
  variants: { jeansB32: string };
  customers: { lan: string; minh: string };
  users: { techA: string; techB: string; cashier: string; manager: string };
  salesOrders: Record<string, string>;
  serviceOrders: Record<string, string>;
  parts: { brakePad: string; oilFilter: string };
}

export async function seedReportFixtures(): Promise<ReportFixtures> {
  // ---- users -------------------------------------------------------------
  const users = {
    techA: randomUUID(),
    techB: randomUUID(),
    cashier: randomUUID(),
    manager: randomUUID(),
  };
  await testDb.user_profiles.createMany({
    data: [
      { id: users.techA, role: 'technician', full_name: 'Tech A' },
      { id: users.techB, role: 'technician', full_name: 'Tech B' },
      { id: users.cashier, role: 'sales_associate', full_name: 'Cashier C' },
      { id: users.manager, role: 'manager', full_name: 'Manager M' },
    ],
  });

  // ---- locations and stores ----------------------------------------------
  const locHcmc = await testDb.stock_locations.create({
    data: {
      name: 'HCMC Warehouse',
      code: 'HCM-WH',
      city: 'Ho Chi Minh City',
      is_default: true,
    },
  });
  const locHanoi = await testDb.stock_locations.create({
    data: { name: 'Hanoi Warehouse', code: 'HN-WH', city: 'Hanoi' },
  });
  const storeHcmc = await testDb.stores.create({
    data: {
      name: 'SCMC HCMC',
      code: 'HCM',
      city: 'Ho Chi Minh City',
      is_default: true,
      default_warehouse_id: locHcmc.id,
    },
  });
  const storeHanoi = await testDb.stores.create({
    data: {
      name: 'SCMC Hanoi',
      code: 'HN',
      city: 'Hanoi',
      default_warehouse_id: locHanoi.id,
    },
  });

  // ---- catalog -----------------------------------------------------------
  const denim = await testDb.product_categories.create({
    data: { name: 'Denim', slug: 'denim' },
  });
  const exhaust = await testDb.product_categories.create({
    data: { name: 'Exhaust', slug: 'exhaust' },
  });

  const jeansA = await testDb.products.create({
    data: {
      sku: 'JEANS-A',
      name: 'Jeans A',
      category_id: denim.id,
      cost_price: D(500_000),
      retail_price: D(1_000_000),
      reorder_point: 2,
    },
  });
  const exhaustX = await testDb.products.create({
    data: {
      sku: 'EXH-X',
      name: 'Exhaust X',
      category_id: exhaust.id,
      cost_price: D(2_000_000),
      retail_price: D(3_000_000),
      reorder_point: 5,
    },
  });
  const sticker = await testDb.products.create({
    data: {
      sku: 'STICKER',
      name: 'Sticker',
      cost_price: D(10_000),
      retail_price: D(50_000),
      reorder_point: 0,
    },
  });
  const jeansB = await testDb.products.create({
    data: {
      sku: 'JEANS-B',
      name: 'Jeans B',
      category_id: denim.id,
      cost_price: D(600_000),
      retail_price: D(3_000_000),
      is_master: true,
    },
  });
  const jeansB32 = await testDb.product_variants.create({
    data: {
      product_id: jeansB.id,
      sku: 'JEANS-B-32',
      name: 'Jeans B / 32',
      cost_price_override: D(400_000),
    },
  });

  // ---- customers ---------------------------------------------------------
  const lan = await testDb.customers.create({
    data: { full_name: 'Nguyễn Thị Lan', phone: '0900000001' },
  });
  const minh = await testDb.customers.create({
    data: { full_name: 'Trần Văn Minh', phone: '0900000002' },
  });

  // ---- sales orders ------------------------------------------------------
  type Line = {
    product_id?: string;
    product_variant_id?: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
    tax_amount?: number;
    unit_cost?: number | null;
  };
  type Pay = { payment_method: string; amount: number; status?: string };
  type Order = {
    number: string;
    status: string;
    store: string;
    location: string;
    customer?: string;
    at: string;
    discount?: number;
    loyalty?: number;
    lines: Line[];
    payments?: Pay[];
  };

  const orders: Order[] = [
    {
      number: 'SO-T-0001',
      status: 'completed',
      store: storeHcmc.id,
      location: locHcmc.id,
      customer: lan.id,
      at: '2026-03-05 10:00',
      discount: 100_000,
      loyalty: 50_000,
      lines: [
        {
          product_id: jeansA.id,
          product_name: 'Jeans A',
          quantity: 2,
          unit_price: 1_000_000,
          discount_amount: 50_000,
          unit_cost: 500_000,
        },
        {
          product_id: exhaustX.id,
          product_name: 'Exhaust X',
          quantity: 1,
          unit_price: 3_000_000,
          tax_amount: 300_000,
          unit_cost: 2_000_000,
        },
      ],
      payments: [
        { payment_method: 'cash', amount: 2_000_000 },
        { payment_method: 'card', amount: 3_050_000 },
      ],
    },
    {
      number: 'SO-T-0002',
      status: 'confirmed',
      store: storeHanoi.id,
      location: locHanoi.id,
      at: '2026-03-05 06:30',
      lines: [
        {
          product_id: jeansB.id,
          product_variant_id: jeansB32.id,
          product_name: 'Jeans B / 32',
          quantity: 1,
          unit_price: 3_000_000,
          unit_cost: 400_000,
        },
      ],
      payments: [{ payment_method: 'bank_transfer', amount: 1_000_000 }],
    },
    {
      number: 'SO-T-0003',
      status: 'cancelled',
      store: storeHcmc.id,
      location: locHcmc.id,
      at: '2026-03-10 11:00',
      lines: [
        {
          product_id: exhaustX.id,
          product_name: 'Exhaust X',
          quantity: 1,
          unit_price: 500_000,
        },
      ],
      payments: [
        { payment_method: 'cash', amount: 500_000, status: 'refunded' },
      ],
    },
    {
      number: 'SO-T-0004',
      status: 'draft',
      store: storeHcmc.id,
      location: locHcmc.id,
      at: '2026-03-12 11:00',
      lines: [
        {
          product_id: jeansA.id,
          product_name: 'Jeans A',
          quantity: 1,
          unit_price: 300_000,
        },
      ],
    },
    {
      number: 'SO-T-0005',
      status: 'processing',
      store: storeHanoi.id,
      location: locHanoi.id,
      customer: minh.id,
      at: '2026-03-15 15:00',
      lines: [
        {
          product_id: sticker.id,
          product_name: 'Sticker',
          quantity: 4,
          unit_price: 50_000,
        },
      ],
      payments: [{ payment_method: 'cash', amount: 200_000 }],
    },
    {
      number: 'SO-T-0006',
      status: 'ready',
      store: storeHcmc.id,
      location: locHcmc.id,
      at: '2026-03-20 09:00',
      lines: [
        {
          product_id: jeansA.id,
          product_name: 'Jeans A',
          quantity: 1,
          unit_price: 1_000_000,
          tax_amount: 80_000,
        },
      ],
      payments: [{ payment_method: 'ewallet_momo', amount: 1_080_000 }],
    },
    {
      number: 'SO-T-0007',
      status: 'completed',
      store: storeHcmc.id,
      location: locHcmc.id,
      at: '2026-02-28 20:00',
      lines: [
        {
          product_id: sticker.id,
          product_name: 'Sticker',
          quantity: 14,
          unit_price: 50_000,
        },
      ],
      payments: [{ payment_method: 'cash', amount: 700_000 }],
    },
    {
      number: 'SO-T-0008',
      status: 'completed',
      store: storeHanoi.id,
      location: locHanoi.id,
      at: '2026-03-31 21:00',
      lines: [
        {
          product_id: jeansA.id,
          product_name: 'Jeans A',
          quantity: 1,
          unit_price: 900_000,
        },
      ],
      payments: [{ payment_method: 'cash', amount: 900_000 }],
    },
    {
      number: 'SO-T-0009',
      status: 'pending',
      store: storeHcmc.id,
      location: locHcmc.id,
      at: '2026-03-18 10:00',
      lines: [
        {
          product_id: sticker.id,
          product_name: 'Sticker',
          quantity: 8,
          unit_price: 50_000,
        },
      ],
    },
  ];

  const salesOrders: Record<string, string> = {};
  for (const o of orders) {
    const subtotal = o.lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
    const lineDiscounts = o.lines.reduce(
      (s, l) => s + (l.discount_amount || 0) * l.quantity,
      0,
    );
    const tax = o.lines.reduce(
      (s, l) => s + (l.tax_amount || 0) * l.quantity,
      0,
    );
    const discount = o.discount || 0;
    const loyalty = o.loyalty || 0;
    const total = subtotal - lineDiscounts - discount - loyalty + tax;
    const at = vn(o.at);

    const created = await testDb.sales_orders.create({
      data: {
        order_number: o.number,
        customer_id: o.customer,
        customer_name: o.customer ? 'Member' : 'Khách lẻ',
        channel: 'pos',
        status: o.status,
        store_id: o.store,
        location_id: o.location,
        order_date: at,
        created_at: at,
        subtotal: D(subtotal),
        discount_amount: D(discount),
        loyalty_discount_amount: D(loyalty),
        tax_amount: D(tax),
        total_amount: D(total),
        created_by: users.cashier,
      },
    });
    salesOrders[o.number] = created.id;

    for (const l of o.lines) {
      await testDb.sales_order_items.create({
        data: {
          sales_order_id: created.id,
          product_id: l.product_id,
          product_variant_id: l.product_variant_id,
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: D(l.unit_price),
          discount_amount: D(l.discount_amount || 0),
          tax_amount: D(l.tax_amount || 0),
          total_amount: D(
            (l.unit_price - (l.discount_amount || 0) + (l.tax_amount || 0)) *
              l.quantity,
          ),
          created_at: at,
        },
      });
      // Stock movement for revenue-bearing orders (what a confirmed sale writes)
      if (!['draft', 'pending', 'cancelled'].includes(o.status)) {
        await testDb.inventory_transactions.create({
          data: {
            location_id: o.location,
            product_id: l.product_variant_id ? undefined : l.product_id,
            product_variant_id: l.product_variant_id,
            transaction_type: 'SALE',
            quantity: -l.quantity,
            unit_cost: l.unit_cost != null ? D(l.unit_cost) : null,
            total_cost:
              l.unit_cost != null ? D(l.unit_cost * l.quantity) : null,
            reference_type: 'sales_order',
            reference_id: created.id,
            created_at: at,
          },
        });
      }
    }
    for (const p of o.payments || []) {
      await testDb.sales_order_payments.create({
        data: {
          sales_order_id: created.id,
          payment_method: p.payment_method,
          amount: D(p.amount),
          status: p.status || 'completed',
          payment_date: at,
          created_at: at,
          received_by: users.cashier,
        },
      });
    }
  }

  // ---- stock on hand (inserted after all movements so the trigger does not alter it)
  await testDb.inventory_transactions.create({
    data: {
      location_id: locHcmc.id,
      product_id: jeansA.id,
      transaction_type: 'RECEIVE',
      quantity: 10,
      unit_cost: D(500_000),
      total_cost: D(5_000_000),
      reference_type: 'purchase_order',
      created_at: vn('2026-03-01 09:00'),
    },
  });
  await testDb.inventory.createMany({
    data: [
      { location_id: locHcmc.id, product_id: jeansA.id, quantity_on_hand: 10 },
      { location_id: locHanoi.id, product_id: jeansA.id, quantity_on_hand: 4 },
      { location_id: locHcmc.id, product_id: exhaustX.id, quantity_on_hand: 2 }, // below reorder point 5
      {
        location_id: locHanoi.id,
        product_variant_id: jeansB32.id,
        quantity_on_hand: 3,
      }, // 3 x 400,000 = 1,200,000
      {
        location_id: locHanoi.id,
        product_id: sticker.id,
        quantity_on_hand: 100,
      },
    ],
  });

  // ---- workshop ----------------------------------------------------------
  const bike1 = await testDb.bikes.create({
    data: {
      brand: 'Honda',
      model: 'CB350',
      license_plate: '59-T1 000.01',
      owner_id: lan.id,
    },
  });
  const bike2 = await testDb.bikes.create({
    data: {
      brand: 'Royal Enfield',
      model: 'Classic 350',
      license_plate: '30-T1 000.02',
      owner_id: minh.id,
    },
  });

  const brakePad = await testDb.parts.create({
    data: { name: 'Brake pad', part_number: 'BP-001', unit_cost: D(150_000) },
  });
  const oilFilter = await testDb.parts.create({
    data: { name: 'Oil filter', part_number: 'OF-001', unit_cost: D(100_000) },
  });

  type Svc = {
    number: string;
    status: string;
    store: string;
    bike: string;
    customer: string;
    drop: string;
    pickup?: string;
    final?: number;
    estimated?: number;
    assigned?: string;
    employees?: { id: string; primary: boolean }[];
  };
  const services: Svc[] = [
    {
      number: 'SV-T-0001',
      status: 'delivered',
      store: storeHcmc.id,
      bike: bike1.id,
      customer: lan.id,
      drop: '2026-03-01 09:00',
      pickup: '2026-03-03 09:00',
      final: 4_000_000,
      assigned: users.techA,
      employees: [
        { id: users.techA, primary: true },
        { id: users.techB, primary: false },
      ],
    },
    {
      number: 'SV-T-0002',
      status: 'delivered',
      store: storeHanoi.id,
      bike: bike2.id,
      customer: minh.id,
      drop: '2026-03-10 09:00',
      pickup: '2026-03-14 09:00',
      estimated: 2_500_000,
      assigned: users.techA,
    },
    {
      number: 'SV-T-0003',
      status: 'in_progress',
      store: storeHcmc.id,
      bike: bike1.id,
      customer: lan.id,
      drop: '2026-03-25 09:00',
      assigned: users.techB,
      employees: [{ id: users.techB, primary: true }],
    },
    {
      number: 'SV-T-0004',
      status: 'waiting_parts',
      store: storeHcmc.id,
      bike: bike2.id,
      customer: minh.id,
      drop: '2026-03-26 09:00',
    },
    {
      number: 'SV-T-0005',
      status: 'in_progress',
      store: storeHanoi.id,
      bike: bike2.id,
      customer: minh.id,
      drop: '2026-03-27 09:00',
    },
    {
      number: 'SV-T-0006',
      status: 'delivered',
      store: storeHcmc.id,
      bike: bike1.id,
      customer: lan.id,
      drop: '2026-02-20 09:00',
      pickup: '2026-02-25 09:00',
      final: 1_500_000,
      assigned: users.techA,
      employees: [{ id: users.techA, primary: true }],
    },
    {
      number: 'SV-T-0007',
      status: 'delivered',
      store: storeHcmc.id,
      bike: bike2.id,
      customer: minh.id,
      drop: '2026-02-26 09:00',
      pickup: '2026-03-02 09:00',
      final: 1_000_000,
      assigned: users.techB,
      employees: [{ id: users.techB, primary: true }],
    },
  ];

  const serviceOrders: Record<string, string> = {};
  for (const s of services) {
    const created = await testDb.service_orders.create({
      data: {
        order_number: s.number,
        motorcycle_id: s.bike,
        customer_id: s.customer,
        status: s.status as service_status,
        store_id: s.store,
        assigned_employee_id: s.assigned,
        drop_off_date: vn(s.drop),
        pickup_date: s.pickup ? vn(s.pickup) : null,
        actual_completion_date: s.pickup ? vn(s.pickup) : null,
        final_cost: s.final != null ? D(s.final) : null,
        estimated_cost: s.estimated != null ? D(s.estimated) : null,
        created_at: vn(s.drop),
      },
    });
    serviceOrders[s.number] = created.id;
    for (const e of s.employees || []) {
      await testDb.service_order_employees.create({
        data: {
          service_order_id: created.id,
          employee_id: e.id,
          is_primary: e.primary,
        },
      });
    }
    if (s.status === 'delivered' && s.pickup) {
      await testDb.payments.create({
        data: {
          service_order_id: created.id,
          amount: D(s.final ?? s.estimated ?? 0),
          payment_method: s.number === 'SV-T-0002' ? 'transfer' : 'cash',
          payment_date: vn(s.pickup),
          created_at: vn(s.pickup),
          received_by: users.cashier,
        },
      });
    }
  }

  await testDb.service_parts.createMany({
    data: [
      {
        service_order_id: serviceOrders['SV-T-0001'],
        part_id: brakePad.id,
        quantity_used: 2,
        unit_cost: D(150_000),
        total_cost: D(300_000),
        created_at: vn('2026-03-02 10:00'),
      },
      {
        service_order_id: serviceOrders['SV-T-0002'],
        part_id: oilFilter.id,
        quantity_used: 1,
        unit_cost: D(100_000),
        total_cost: D(100_000),
        created_at: vn('2026-03-12 10:00'),
      },
      {
        service_order_id: serviceOrders['SV-T-0003'],
        part_id: brakePad.id,
        quantity_used: 1,
        unit_cost: D(150_000),
        total_cost: D(150_000),
        created_at: vn('2026-03-25 10:00'),
      },
    ],
  });

  return {
    stores: { hcmc: storeHcmc.id, hanoi: storeHanoi.id },
    locations: { hcmc: locHcmc.id, hanoi: locHanoi.id },
    categories: { denim: denim.id, exhaust: exhaust.id },
    products: {
      jeansA: jeansA.id,
      exhaustX: exhaustX.id,
      sticker: sticker.id,
      jeansB: jeansB.id,
    },
    variants: { jeansB32: jeansB32.id },
    customers: { lan: lan.id, minh: minh.id },
    users,
    salesOrders,
    serviceOrders,
    parts: { brakePad: brakePad.id, oilFilter: oilFilter.id },
  };
}

/** Expected figures for March 2026, all stores, derived from the fixture comments above. */
export const MARCH = { from: '2026-03-01', to: '2026-03-31' };
export const EXPECTED_MARCH = {
  revenueOrderNumbers: [
    'SO-T-0001',
    'SO-T-0002',
    'SO-T-0005',
    'SO-T-0006',
    'SO-T-0008',
  ],
  grossSales: 5_000_000 + 3_000_000 + 200_000 + 1_000_000 + 900_000, // 10,100,000
  discounts: 100_000 + 100_000 + 50_000, // line 2x50,000 + order 100,000 + loyalty 50,000 = 250,000
  netSales: 10_100_000 - 250_000, // 9,850,000
  tax: 300_000 + 80_000, // 380,000
  itemsSold: 3 + 1 + 4 + 1 + 1, // 10
  retailReceived: {
    cash: 2_000_000 + 200_000 + 900_000,
    card: 3_050_000,
    bank_transfer: 1_000_000,
    ewallet_momo: 1_080_000,
  },
  workshopRevenue: 4_000_000 + 2_500_000 + 1_000_000, // 7,500,000, 3 delivered orders
  workshopReceived: { cash: 4_000_000 + 1_000_000, transfer: 2_500_000 },
  cogsRecorded: 2 * 500_000 + 1 * 2_000_000 + 1 * 400_000, // 3,400,000 from SO-T-0001 and SO-T-0002
  cogsEstimated: 4 * 10_000 + 1 * 500_000 + 1 * 500_000, // 1,020,000 from SO-T-0005, 0006, 0008 at current cost
  bikesInService: { in_progress: 2, waiting_parts: 1, total: 3 },
  turnaroundDays: [2, 4, 4], // SV-T-0001, 0002, 0007 -> average 3.33, median 4
};
