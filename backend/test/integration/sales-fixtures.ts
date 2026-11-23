/**
 * Minimal catalog for sales-posting and POS checkout tests: one store with a
 * selling location, products (one with an active sale price, one with a
 * variant), stock, a member customer with loyalty rules, and users per role.
 */
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { testDb } from './db';

const D = (n: number) => new Prisma.Decimal(n);

export interface SalesFixtures {
  store: { id: string; locationId: string };
  store2: { id: string; locationId: string };
  products: { jeans: string; exhaust: string; sticker: string; master: string };
  variants: { size32: string };
  customers: { member: string; plain: string };
  users: Record<string, string>;
  loyalty: {
    pointsPerCurrency: number;
    redemptionRate: number;
    minRedeem: number;
    maxRedeemPercent: number;
  };
  stock: Record<string, number>;
}

export async function seedSalesFixtures(): Promise<SalesFixtures> {
  const users: Record<string, string> = {};
  for (const role of [
    'manager',
    'store_manager',
    'sales_associate',
    'finance',
    'technician',
  ]) {
    const id = randomUUID();
    await testDb.user_profiles.create({
      data: { id, role: 'sales', full_name: `User ${role}` },
    });
    const r = await testDb.roles.findUniqueOrThrow({ where: { name: role } });
    await testDb.user_roles.create({ data: { user_id: id, role_id: r.id } });
    users[role] = id;
  }

  const loc = await testDb.stock_locations.create({
    data: { name: 'HCMC Warehouse', code: 'HCM-WH', is_default: true },
  });
  const store = await testDb.stores.create({
    data: {
      name: 'SCMC HCMC',
      code: 'HCM',
      is_default: true,
      default_warehouse_id: loc.id,
      address: '12 Nguyễn Huệ, Q1',
    },
  });
  const loc2 = await testDb.stock_locations.create({
    data: { name: 'Hanoi Warehouse', code: 'HN-WH' },
  });
  const store2 = await testDb.stores.create({
    data: { name: 'SCMC Hanoi', code: 'HN', default_warehouse_id: loc2.id },
  });

  const denim = await testDb.product_categories.create({
    data: { name: 'Denim', slug: 'denim' },
  });
  const jeans = await testDb.products.create({
    data: {
      sku: 'JEANS-A',
      name: 'Jeans A',
      category_id: denim.id,
      cost_price: D(500_000),
      retail_price: D(1_000_000),
    },
  });
  const exhaust = await testDb.products.create({
    data: {
      sku: 'EXH-X',
      name: 'Exhaust X',
      cost_price: D(2_000_000),
      retail_price: D(3_000_000),
      sale_price: D(2_500_000),
      sale_price_start_date: new Date('2020-01-01'),
      sale_price_end_date: new Date('2099-01-01'),
    },
  });
  const sticker = await testDb.products.create({
    data: {
      sku: 'STICKER',
      name: 'Sticker',
      cost_price: D(10_000),
      retail_price: D(50_000),
    },
  });
  const master = await testDb.products.create({
    data: {
      sku: 'JEANS-B',
      name: 'Jeans B',
      category_id: denim.id,
      cost_price: D(600_000),
      retail_price: D(1_500_000),
      is_master: true,
    },
  });
  const size32 = await testDb.product_variants.create({
    data: {
      product_id: master.id,
      sku: 'JEANS-B-32',
      name: 'Jeans B / 32',
      price_adjustment: D(100_000),
      cost_price_override: D(400_000),
    },
  });

  const stock = { jeans: 10, exhaust: 2, sticker: 100, size32: 3 };
  await testDb.inventory.createMany({
    data: [
      {
        location_id: loc.id,
        product_id: jeans.id,
        quantity_on_hand: stock.jeans,
      },
      {
        location_id: loc.id,
        product_id: exhaust.id,
        quantity_on_hand: stock.exhaust,
      },
      {
        location_id: loc.id,
        product_id: sticker.id,
        quantity_on_hand: stock.sticker,
      },
      {
        location_id: loc.id,
        product_variant_id: size32.id,
        quantity_on_hand: stock.size32,
      },
      { location_id: loc2.id, product_id: jeans.id, quantity_on_hand: 1 },
    ],
  });

  const member = await testDb.customers.create({
    data: { full_name: 'Nguyễn Thị Lan', phone: '0900000001' },
  });
  const plain = await testDb.customers.create({
    data: { full_name: 'Trần Văn Minh', phone: '0900000002' },
  });

  const tier = await testDb.loyalty_tiers.create({
    data: {
      code: 'iron',
      name: 'Iron Rider',
      display_order: 1,
      min_points: 0,
      points_multiplier: D(1),
    },
  });
  const loyalty = {
    pointsPerCurrency: 0.0001,
    redemptionRate: 1000,
    minRedeem: 100,
    maxRedeemPercent: 20,
  }; // 1 point per 10,000 VND; 1 point = 1,000 VND
  await testDb.loyalty_rule_versions.create({
    data: {
      version_number: 1,
      points_per_currency: D(loyalty.pointsPerCurrency),
      redemption_rate: D(loyalty.redemptionRate),
      max_redemption_percent: D(loyalty.maxRedeemPercent),
      min_redemption_points: loyalty.minRedeem,
      is_active: true,
      effective_from: new Date('2020-01-01'),
    },
  });
  // A database trigger creates the loyalty row with each customer; set the member's balance.
  const memberLoyalty = {
    current_tier_id: tier.id,
    points_balance: 500,
    points_earned_lifetime: 500,
    points_redeemed_lifetime: 0,
    total_spend: D(5_000_000),
  };
  await testDb.customer_loyalty.upsert({
    where: { customer_id: member.id },
    update: memberLoyalty,
    create: { customer_id: member.id, ...memberLoyalty },
  });

  return {
    store: { id: store.id, locationId: loc.id },
    store2: { id: store2.id, locationId: loc2.id },
    products: {
      jeans: jeans.id,
      exhaust: exhaust.id,
      sticker: sticker.id,
      master: master.id,
    },
    variants: { size32: size32.id },
    customers: { member: member.id, plain: plain.id },
    users,
    loyalty,
    stock,
  };
}

export async function onHand(
  locationId: string,
  productId?: string,
  variantId?: string,
): Promise<number> {
  const row = await testDb.inventory.findFirst({
    where: variantId
      ? { location_id: locationId, product_variant_id: variantId }
      : {
          location_id: locationId,
          product_id: productId,
          product_variant_id: null,
        },
  });
  return row?.quantity_on_hand ?? 0;
}
