/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- end-to-end driver over untyped JSON API responses */
/**
 * Seeds the dev database with realistic data for the end-to-end run, through
 * the HTTP API wherever an endpoint exists. Users are created in Supabase Auth
 * (admin API) and linked to user_profiles / user_roles, the only step without
 * an API.
 *
 *   npx ts-node -r tsconfig-paths/register test/e2e-real/seed.ts
 *
 * Writes ids to test/e2e-real/out/state.json for trade.ts and verify.ts.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { Client, SERVICE_KEY, SUPABASE, rng, signIn } from './api';

export const PASSWORD = 'Scmc@2026!';
export const USERS = [
  {
    key: 'admin',
    email: 'admin@scmc.local',
    name: 'Quản trị hệ thống',
    role: 'superadmin',
  },
  {
    key: 'manager',
    email: 'manager@scmc.local',
    name: 'Nguyễn Văn Quản',
    role: 'manager',
  },
  {
    key: 'finance',
    email: 'ketoan@scmc.local',
    name: 'Trần Thị Kế',
    role: 'finance',
  },
  {
    key: 'smHcm',
    email: 'ch.hcm@scmc.local',
    name: 'Lê Minh Trưởng',
    role: 'store_manager',
  },
  {
    key: 'smHn',
    email: 'ch.hn@scmc.local',
    name: 'Phạm Thu Hà',
    role: 'store_manager',
  },
  {
    key: 'cash1',
    email: 'thungan1.hcm@scmc.local',
    name: 'Võ Thị Lan',
    role: 'sales_associate',
  },
  {
    key: 'cash2',
    email: 'thungan2.hcm@scmc.local',
    name: 'Đặng Quốc Bảo',
    role: 'sales_associate',
  },
  {
    key: 'cash3',
    email: 'thungan.hn@scmc.local',
    name: 'Bùi Ngọc Anh',
    role: 'sales_associate',
  },
  {
    key: 'stock',
    email: 'kho@scmc.local',
    name: 'Hoàng Văn Kho',
    role: 'warehouse_staff',
  },
] as const;
export type UserKey = (typeof USERS)[number]['key'];

export const OUT = join(__dirname, 'out');
const r = rng(20261126);
const k = (n: number) => Math.round(n / 1000) * 1000;

async function supabaseUser(email: string): Promise<string> {
  const h = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const body = (await res.json()) as {
    id?: string;
    msg?: string;
    error_code?: string;
  };
  if (res.ok && body.id) return body.id;
  // already registered: look it up
  const list = (await (
    await fetch(`${SUPABASE}/auth/v1/admin/users?per_page=200`, { headers: h })
  ).json()) as {
    users: { id: string; email: string }[];
  };
  const found = list.users.find((u) => u.email === email);
  if (!found)
    throw new Error(`cannot create ${email}: ${JSON.stringify(body)}`);
  return found.id;
}

// ---- catalog --------------------------------------------------------------------
type Item = {
  sku: string;
  name: string;
  cat: string;
  brand: string;
  price: number;
  sizes?: string[];
  unit?: { name: string; factor: number };
  qty: number;
};

function catalog(): Item[] {
  const items: Item[] = [];
  const helmets: [string, string, number][] = [
    ['Shoei', 'GT-Air 3', 14_900_000],
    ['Shoei', 'NXR2', 13_500_000],
    ['Arai', 'RX-7V Evo', 18_900_000],
    ['Arai', 'Quantic', 15_500_000],
    ['LS2', 'FF800 Storm', 3_200_000],
    ['LS2', 'OF600 Copter', 2_100_000],
    ['Royal', 'M139', 650_000],
    ['Royal', 'M20C', 480_000],
    ['Scoyco', 'HX100', 1_850_000],
    ['LS2', 'FF805 Thunder', 9_800_000],
  ];
  helmets.forEach(([b, m, p], i) =>
    items.push({
      sku: `MBH-${i + 1}`,
      name: `Mũ bảo hiểm ${b} ${m}`,
      cat: 'Mũ bảo hiểm',
      brand: b,
      price: p,
      sizes: ['M', 'L', 'XL'],
      qty: 10,
    }),
  );
  const jackets: [string, string, number][] = [
    ['Alpinestars', 'T-GP Plus R v4', 6_900_000],
    ['Dainese', 'Super Speed 4', 9_500_000],
    ['Komine', 'JK-162', 2_900_000],
    ['Scoyco', 'JK37', 1_450_000],
    ['Alpinestars', 'Andes v3 Drystar', 8_200_000],
    ['Komine', 'JK-603', 3_600_000],
  ];
  jackets.forEach(([b, m, p], i) =>
    items.push({
      sku: `AGP-${i + 1}`,
      name: `Áo giáp ${b} ${m}`,
      cat: 'Áo giáp',
      brand: b,
      price: p,
      sizes: ['S', 'M', 'L', 'XL'],
      qty: 8,
    }),
  );
  const gloves: [string, string, number][] = [
    ['Alpinestars', 'SP-8 v3', 2_400_000],
    ['Dainese', 'Carbon 4', 3_900_000],
    ['Komine', 'GK-220', 790_000],
    ['Scoyco', 'MC29', 420_000],
    ['Komine', 'GK-243', 990_000],
    ['Alpinestars', 'SMX-1 Air v2', 1_350_000],
  ];
  gloves.forEach(([b, m, p], i) =>
    items.push({
      sku: `GT-${i + 1}`,
      name: `Găng tay ${b} ${m}`,
      cat: 'Găng tay',
      brand: b,
      price: p,
      sizes: ['M', 'L', 'XL'],
      qty: 15,
    }),
  );
  const boots: [string, string, number][] = [
    ['Alpinestars', 'SMX-6 v2', 7_200_000],
    ['Dainese', 'Axial Gore-Tex', 12_500_000],
    ['Scoyco', 'MBT016', 1_900_000],
    ['Komine', 'BK-086', 2_600_000],
  ];
  boots.forEach(([b, m, p], i) =>
    items.push({
      sku: `GIAY-${i + 1}`,
      name: `Giày ${b} ${m}`,
      cat: 'Giày',
      brand: b,
      price: p,
      sizes: ['40', '41', '42', '43'],
      qty: 6,
    }),
  );
  const acc = [
    'Giá đỡ điện thoại nhôm',
    'Khoá đĩa chống trộm',
    'Bạt phủ xe chống nước',
    'Túi đeo đùi',
    'Balo chống nước 25L',
    'Kính chắn gió',
    'Đèn trợ sáng L4X',
    'Tai nghe bluetooth Cardo',
    'Camera hành trình',
    'Bao tay lái sưởi',
    'Ốp pô chống nóng',
    'Gương chiếu hậu CNC',
    'Bọc yên chống nóng',
    'Móc treo đồ',
    'Sạc USB gắn ghi đông',
  ];
  acc.forEach((n, i) =>
    items.push({
      sku: `PK-${i + 1}`,
      name: n,
      cat: 'Phụ kiện',
      brand: i % 3 === 0 ? 'SCMC' : 'Scoyco',
      price: k(150_000 + r.next() * 3_000_000),
      qty: r.int(12, 40),
    }),
  );
  const parts: [string, string, number][] = [
    ['Akrapovic', 'Pô Akrapovic Slip-on Z900', 24_500_000],
    ['Akrapovic', 'Pô Akrapovic Slip-on CB650R', 22_900_000],
    ['Brembo', 'Má phanh Brembo trước', 1_250_000],
    ['Brembo', 'Heo dầu Brembo M4.32', 18_500_000],
    ['SCMC', 'Nhông sên dĩa DID', 2_350_000],
    ['SCMC', 'Lọc gió K&N', 1_650_000],
    ['SCMC', 'Bugi NGK Iridium', 320_000],
    ['Brembo', 'Đĩa phanh Brembo 320mm', 6_800_000],
    ['SCMC', 'Lọc nhớt Honda', 180_000],
    ['SCMC', 'Dây côn', 260_000],
  ];
  parts.forEach(([b, n, p], i) =>
    items.push({
      sku: `PT-${i + 1}`,
      name: n,
      cat: 'Phụ tùng',
      brand: b,
      price: p,
      qty: p > 10_000_000 ? 3 : r.int(10, 30),
    }),
  );
  const oils: [string, string, number][] = [
    ['Motul', 'Nhớt Motul 7100 10W40 1L', 345_000],
    ['Motul', 'Nhớt Motul 300V 10W40 1L', 520_000],
    ['Liqui Moly', 'Nhớt Liqui Moly Street Race 10W40 1L', 395_000],
    ['Motul', 'Nước làm mát Motul 1L', 160_000],
  ];
  oils.forEach(([b, n, p], i) =>
    items.push({
      sku: `NHOT-${i + 1}`,
      name: n,
      cat: 'Dầu nhớt',
      brand: b,
      price: p,
      unit: { name: 'Thùng 12', factor: 12 },
      qty: 120,
    }),
  );
  [
    'Tem SCMC phản quang',
    'Tem logo Shoei',
    'Tem chống trầy bình xăng',
    'Tem dán vành',
  ].forEach((n, i) =>
    items.push({
      sku: `TEM-${i + 1}`,
      name: n,
      cat: 'Tem dán',
      brand: 'SCMC',
      price: 50_000 + i * 10_000,
      unit: { name: 'Hộp 10', factor: 10 },
      qty: 200,
    }),
  );
  return items;
}

const FIRST = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Hồ',
  'Ngô',
  'Dương',
  'Lý',
];
const MID = [
  'Văn',
  'Thị',
  'Minh',
  'Quốc',
  'Thanh',
  'Ngọc',
  'Hữu',
  'Đức',
  'Thu',
  'Gia',
];
const LAST = [
  'An',
  'Bình',
  'Cường',
  'Dũng',
  'Hải',
  'Hùng',
  'Khánh',
  'Long',
  'Nam',
  'Phong',
  'Quân',
  'Sơn',
  'Tâm',
  'Tuấn',
  'Việt',
  'Linh',
  'Mai',
  'Hương',
  'Trang',
  'Yến',
];

async function main() {
  const prisma = new PrismaClient();
  mkdirSync(OUT, { recursive: true });

  // ---- users ------------------------------------------------------------------
  const roles = await prisma.roles.findMany();
  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const id = await supabaseUser(u.email);
    userIds[u.key] = id;
    await prisma.user_profiles.upsert({
      where: { id },
      create: {
        id,
        email: u.email,
        full_name: u.name,
        role: u.role as never,
        is_active: true,
      },
      update: { full_name: u.name, role: u.role as never, is_active: true },
    });
    const role = roles.find((x) => x.name === u.role);
    await prisma.user_roles.upsert({
      where: { user_id_role_id: { user_id: id, role_id: role.id } },
      create: { user_id: id, role_id: role.id },
      update: {},
    });
  }
  const as = async (key: UserKey) =>
    new Client(
      key,
      await signIn(USERS.find((u) => u.key === key).email, PASSWORD),
    );
  const admin = await as('admin');
  const manager = await as('manager');
  console.log('users ok');

  // ---- branches, warehouses, cash accounts --------------------------------------
  const locations = await admin.get<any[]>('/stock-locations');
  const hcmLoc = locations.find((l) => l.code === 'HCMC');
  const hnLoc = locations.find((l) => l.code === 'HANOI');
  const stores = await admin.get<any[]>('/stores');
  let hcm = stores.find((s) => s.code === 'MAIN' || s.code === 'HCM');
  hcm = await admin.patch(`/stores/${hcm.id}`, {
    name: 'SCMC Hồ Chí Minh',
    code: 'HCM',
    city: 'Hồ Chí Minh',
    address: '123 Nguyễn Văn Linh, Q7',
    default_warehouse_id: hcmLoc.id,
  });
  let hn = stores.find((s) => s.code === 'HN');
  hn ??= await admin.post('/stores', {
    name: 'SCMC Hà Nội',
    code: 'HN',
    city: 'Hà Nội',
    address: '45 Trần Duy Hưng, Cầu Giấy',
    is_active: true,
    default_warehouse_id: hnLoc.id,
  });

  const accounts = await admin.get<any[]>('/cash-book/accounts');
  const account = async (
    storeId: string,
    code: string,
    name: string,
    type: string,
    drawer = false,
  ) =>
    accounts.find((a) => a.code === code) ??
    (await admin.post('/cash-book/accounts', {
      store_id: storeId,
      code,
      name,
      type,
      is_pos_drawer: drawer,
      bank_name: type === 'bank' ? 'Vietcombank' : undefined,
    }));
  const acc = {
    hcmDrawer:
      accounts.find((a) => a.code === 'MAIN-CASH') ??
      (await account(hcm.id, 'HCM-CASH', 'Két HCM', 'cash', true)),
    hcmBank:
      accounts.find((a) => a.code === 'MAIN-BANK') ??
      (await account(hcm.id, 'HCM-BANK', 'VCB HCM', 'bank')),
    hnDrawer: await account(hn.id, 'HN-CASH', 'Két Hà Nội', 'cash', true),
    hnBank: await account(hn.id, 'HN-BANK', 'VCB Hà Nội', 'bank'),
  };
  for (const [store, drawer, bank] of [
    [hcm, acc.hcmDrawer, acc.hcmBank],
    [hn, acc.hnDrawer, acc.hnBank],
  ]) {
    await admin.put('/cash-book/accounts/method-map', {
      store_id: store.id,
      payment_method: 'cash',
      account_id: drawer.id,
    });
    for (const m of [
      'card',
      'bank_transfer',
      'ewallet_momo',
      'ewallet_zalopay',
      'ewallet_vnpay',
    ])
      await admin.put('/cash-book/accounts/method-map', {
        store_id: store.id,
        payment_method: m,
        account_id: bank.id,
      });
  }
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  await manager.post('/cash-book/opening-balances', {
    account_id: acc.hcmBank.id,
    amount: 3_000_000_000,
    date: yesterday,
    note: 'Số dư đầu kỳ',
  });
  await manager.post('/cash-book/opening-balances', {
    account_id: acc.hnBank.id,
    amount: 1_000_000_000,
    date: yesterday,
    note: 'Số dư đầu kỳ',
  });
  console.log('branches ok');

  // ---- catalog ------------------------------------------------------------------
  const items = catalog();
  const catIds: Record<string, string> = {};
  for (const c of [...new Set(items.map((i) => i.cat))]) {
    const slug = c
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/\s+/g, '-');
    catIds[c] = (await admin.post('/product-categories', { name: c, slug })).id;
  }
  const existingBrands = await admin.get<any>('/brands');
  const brandList: any[] = Array.isArray(existingBrands)
    ? existingBrands
    : (existingBrands.data ?? []);
  const brandIds: Record<string, string> = {};
  for (const b of [...new Set(items.map((i) => i.brand))])
    brandIds[b] =
      brandList.find((x) => x.name === b)?.id ??
      (await admin.post('/brands', { name: b })).id;
  const supplierNames: Record<string, string> = {
    'Mũ bảo hiểm': 'Công ty TNHH Mũ An Toàn',
    'Áo giáp': 'Rider Gear Việt Nam',
    'Găng tay': 'Rider Gear Việt Nam',
    Giày: 'Rider Gear Việt Nam',
    'Phụ kiện': 'Phụ kiện Moto Sài Gòn',
    'Phụ tùng': 'Performance Parts Co.',
    'Dầu nhớt': 'Nhà phân phối Motul',
    'Tem dán': 'Phụ kiện Moto Sài Gòn',
  };
  const supplierIds: Record<string, string> = {};
  for (const s of [...new Set(Object.values(supplierNames))])
    supplierIds[s] = (
      await admin.post('/suppliers', {
        name: s,
        phone: `028${r.int(1000000, 9999999)}`,
        contact_person: 'Phòng kinh doanh',
      })
    ).id;

  type Sku = {
    id: string;
    sku: string;
    name: string;
    price: number;
    cost: number;
    cat: string;
    brand: string;
    master?: string;
    unit?: { id: string; name: string; factor: number; price: number };
    qty: number;
    barcode?: string;
  };
  const skus: Sku[] = [];
  for (const it of items) {
    const cost = k(it.price * (0.55 + r.next() * 0.1));
    const base = {
      name: it.name,
      category_id: catIds[it.cat],
      brand_id: brandIds[it.brand],
      supplier_id: supplierIds[supplierNames[it.cat]],
      cost_price: cost,
      retail_price: it.price,
      product_type: 'physical',
      is_active: true,
      reorder_point: Math.max(2, Math.round(it.qty / 4)),
      reorder_quantity: it.qty,
    };
    if (it.sizes) {
      const res = await admin.post('/products/master-with-variants', {
        ...base,
        sku: it.sku,
        variantAttributes: { size: it.sizes },
      });
      for (const v of res.variants)
        skus.push({
          id: v.id,
          sku: v.sku,
          name: v.name,
          price: it.price,
          cost,
          cat: it.cat,
          brand: it.brand,
          master: res.master.id,
          qty: it.qty,
        });
    } else {
      const p = await admin.post('/products', { ...base, sku: it.sku });
      const s: Sku = {
        id: p.id,
        sku: p.sku,
        name: p.name,
        price: it.price,
        cost,
        cat: it.cat,
        brand: it.brand,
        qty: it.qty,
      };
      if (it.unit) {
        await admin.put(`/products/${p.id}/base-unit`, {
          base_unit: it.unit.name.startsWith('Thùng') ? 'chai' : 'cái',
        });
        const res = await admin.post(`/products/${p.id}/units`, {
          name: it.unit.name,
          factor: it.unit.factor,
        });
        const unit = (res.units ?? [res]).find(
          (u: any) => u.name === it.unit.name,
        );
        s.unit = {
          id: unit.id,
          name: unit.name,
          factor: unit.factor,
          price: Number(unit.price ?? it.price * it.unit.factor),
        };
      }
      skus.push(s);
    }
  }
  // barcodes on a few simple items (scanned at the POS)
  for (const s of skus.filter((x) => !x.master).slice(0, 12))
    s.barcode = (
      await admin.post(`/products/${s.id}/barcode/generate`)
    ).barcode;
  console.log(`catalog ok: ${skus.length} sellable SKUs`);

  // ---- purchasing: one PO per supplier, approved = received at HCMC -----------------
  const smHcm = await as('smHcm');
  const stock = await as('stock');
  const pos: { id: string; supplier: string; total: number }[] = [];
  for (const [supplier, sid] of Object.entries(supplierIds)) {
    const lines = skus.filter((s) => supplierNames[s.cat] === supplier);
    const po = await stock.post('/purchase-orders', {
      supplier_id: sid,
      notes: 'Nhập hàng đầu kỳ',
      items: lines.map((s) => ({
        product_id: s.id,
        product_name: s.name,
        product_sku: s.sku,
        quantity_ordered: s.qty,
        unit_cost: s.cost,
      })),
    });
    await stock.post(`/purchase-orders/${po.id}/submit`);
    const ok = await manager.post(`/purchase-orders/${po.id}/approve`);
    pos.push({
      id: po.id,
      supplier,
      total: Number(ok.total_amount ?? po.total_amount),
    });
  }
  console.log(`purchase orders ok: ${pos.length}`);

  // pay suppliers 60% from the HCMC bank (the rest stays payable)
  const finance = await as('finance');
  for (const po of pos) {
    const amount = k(po.total * 0.6);
    await finance.post('/supplier-payments', {
      supplier_id: supplierIds[po.supplier],
      amount,
      payment_method: 'bank_transfer',
      cash_account_id: acc.hcmBank.id,
      allocations: [{ purchase_order_id: po.id, amount_allocated: amount }],
    });
  }

  // ---- stock Hanoi by transfer: 40% of each SKU -------------------------------------
  const toHn = skus
    .map((s) => ({ product_id: s.id, quantity: Math.floor(s.qty * 0.4) }))
    .filter((l) => l.quantity > 0);
  const t = await stock.post('/stock-transfers', {
    from_location_id: hcmLoc.id,
    to_location_id: hnLoc.id,
    notes: 'Chia hàng đầu kỳ cho Hà Nội',
    items: toHn,
  });
  await stock.post(`/stock-transfers/${t.id}/ship`, {});
  const shipped = await stock.get(`/stock-transfers/${t.id}`);
  await (
    await as('smHn')
  ).post(`/stock-transfers/${t.id}/receive`, {
    items: shipped.items.map((i: any) => ({
      item_id: i.id,
      quantity: i.quantity_shipped,
    })),
    close: true,
  });
  console.log(`initial transfer ok: ${toHn.length} lines`);

  // ---- customers, VIP group and price book --------------------------------------------
  const customers: { id: string; name: string; phone: string; vip: boolean }[] =
    [];
  for (let i = 0; i < 150; i++) {
    const name = `${r.pick(FIRST)} ${r.pick(MID)} ${r.pick(LAST)}`;
    const phone = `09${String(10000000 + i * 61_337).slice(0, 8)}`;
    const c = await smHcm.post('/customers', { full_name: name, phone });
    customers.push({ id: c.id, name, phone, vip: i < 20 });
  }
  const vip = await manager.post('/customer-groups', {
    code: 'VIP',
    name: 'Khách VIP',
    description: 'Biker thân thiết',
  });
  for (const c of customers.filter((x) => x.vip))
    await manager.put(`/customers/${c.id}/groups`, { group_ids: [vip.id] });
  const book = await manager.post('/price-books', {
    code: 'VIP-2026',
    name: 'Bảng giá VIP',
    priority: 10,
    is_active: true,
    group_ids: [vip.id],
    allow_manual: false,
  });
  await manager.post(`/price-books/${book.id}/entries/bulk`, {
    mode: 'percent_off',
    value: 10,
    category_id: catIds['Mũ bảo hiểm'],
  });
  await manager.post(`/price-books/${book.id}/entries/bulk`, {
    mode: 'percent_off',
    value: 10,
    category_id: catIds['Áo giáp'],
  });

  // ---- promotions and vouchers ----------------------------------------------------
  const tem = skus.filter((s) => s.cat === 'Tem dán');
  const promos = {
    b2g1: await manager.post('/promotions', {
      code: 'TEM-B2G1',
      name: 'Tem dán mua 2 tặng 1',
      type: 'buy_x_get_y',
      is_active: true,
      buy_quantity: 2,
      get_quantity: 1,
      get_discount_percent: 100,
      combinable: true,
      targets: [
        {
          role: 'target',
          target_type: 'category',
          target_id: catIds['Tem dán'],
        },
      ],
    }),
    gloves: await manager.post('/promotions', {
      code: 'GT-15',
      name: 'Găng tay giảm 15%',
      type: 'line_discount',
      is_active: true,
      discount_kind: 'percent',
      discount_value: 15,
      combinable: true,
      targets: [
        {
          role: 'target',
          target_type: 'category',
          target_id: catIds['Găng tay'],
        },
      ],
    }),
    big: await manager.post('/promotions', {
      code: 'DON-10TR',
      name: 'Đơn từ 10 triệu giảm 300.000',
      type: 'order_discount',
      is_active: true,
      discount_kind: 'amount',
      discount_value: 300_000,
      min_order_amount: 10_000_000,
      combinable: true,
    }),
  };
  const campaign = await manager.post('/voucher-campaigns', {
    code: 'WELCOME',
    name: 'Chào khách mới 100K',
    discount_kind: 'amount',
    discount_value: 100_000,
    min_order_amount: 1_000_000,
    uses_per_code: 1,
    combinable_with_promotions: true,
    is_active: true,
  });
  const codes = await manager.post(`/voucher-campaigns/${campaign.id}/codes`, {
    count: 40,
    prefix: 'WEL',
  });

  // ---- QR -------------------------------------------------------------------------
  for (const [store, bank] of [
    [hcm, acc.hcmBank],
    [hn, acc.hnBank],
  ])
    await manager.put(`/qr-payments/settings/${store.id}/vietqr`, {
      is_enabled: true,
      config: {
        bank_bin: '970436',
        account_number:
          store.code === 'HCM' ? '0071000123456' : '0451000654321',
        account_name: 'CONG TY SCMC',
      },
      cash_account_id: bank.id,
    });

  const state = {
    seededAt: new Date().toISOString(),
    users: userIds,
    stores: { hcm: hcm.id, hn: hn.id },
    locations: { hcm: hcmLoc.id, hn: hnLoc.id },
    accounts: Object.fromEntries(
      Object.entries(acc).map(([key, a]) => [key, a.id]),
    ),
    categories: catIds,
    brands: brandIds,
    suppliers: supplierIds,
    purchaseOrders: pos,
    skus,
    customers,
    vipGroup: vip.id,
    priceBook: book.id,
    promotions: Object.fromEntries(
      Object.entries(promos).map(([key, p]) => [key, p.id]),
    ),
    voucherCampaign: campaign.id,
    voucherCodes: (codes.codes ?? codes).map((c: any) => c.code ?? c),
    initialTransfer: t.id,
    temIds: tem.map((s) => s.id),
  };
  writeFileSync(join(OUT, 'state.json'), JSON.stringify(state, null, 2));
  console.log('seed done →', join(OUT, 'state.json'));
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
