/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- end-to-end driver over untyped JSON API responses */
/**
 * Simulates a trading day at both branches through the API, the way the POS
 * screens call it: cart pricing → (QR / approval) → checkout, returns with a
 * preview first, transfers, a stock count, write-offs, cash vouchers and shift
 * closes. Every action is written to out/ledger.json for verify.ts.
 *
 *   npx ts-node -r tsconfig-paths/register test/e2e-real/trade.ts
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ApiError, Client, expectStatus, rng, signIn } from './api';
import { OUT, PASSWORD, USERS, UserKey } from './seed';

const state = JSON.parse(readFileSync(join(OUT, 'state.json'), 'utf8'));
const r = rng(7);
type Sku = (typeof state.skus)[number];
type Branch = 'hcm' | 'hn';

export interface SaleRecord {
  id: string;
  number: string;
  branch: Branch;
  cashier: UserKey;
  shift: string;
  customerId: string | null;
  clientRequestId: string;
  lines: {
    productId: string;
    sku: string;
    qty: number;
    baseQty: number;
    unitPrice: number;
    unitName?: string;
  }[];
  breakdown: Record<string, number>;
  total: number;
  payments: { method: string; amount: number }[];
  voucher?: string;
  points: number;
  manualPercent: number;
}

const ledger: any = {
  startedAt: new Date().toISOString(),
  sales: [] as SaleRecord[],
  returns: [] as any[],
  shifts: [] as any[],
  transfers: [] as any[],
  counts: [] as any[],
  writeOffs: [] as any[],
  vouchers: [] as any[],
  qr: [] as any[],
  negative: [] as { what: string; ok: boolean; detail?: string }[],
  errors: [] as string[],
};

const users: Partial<Record<UserKey, Client>> = {};
const as = async (key: UserKey) =>
  (users[key] ??= new Client(
    key,
    await signIn(USERS.find((u) => u.key === key).email, PASSWORD),
  ));

// local view of sellable stock per branch (base units)
const stock: Record<Branch, Map<string, number>> = {
  hcm: new Map(),
  hn: new Map(),
};
const credit = new Map<string, number>();
let currentShift: { id: string; branch: Branch } | null = null;
const usedVouchers = new Set<string>();

function loadStock() {
  // seed: HCMC keeps qty − floor(40%), Hanoi receives floor(40%)
  for (const sk of state.skus as Sku[]) {
    stock.hn.set(sk.id, Math.floor(sk.qty * 0.4));
    stock.hcm.set(sk.id, sk.qty - Math.floor(sk.qty * 0.4));
  }
}

function basket(branch: Branch) {
  const n = r.pick([1, 1, 2, 2, 2, 3, 4]);
  const lines: { sku: Sku; qty: number; unit?: boolean }[] = [];
  for (let i = 0; i < n * 3 && lines.length < n; i++) {
    const s: Sku = r.pick<Sku>(state.skus);
    if (lines.some((l) => l.sku.id === s.id)) continue;
    const avail = stock[branch].get(s.id) ?? 0;
    const byUnit = !!s.unit && r.chance(0.3);
    const factor = byUnit ? s.unit.factor : 1;
    const qty =
      s.cat === 'Tem dán' && !byUnit
        ? r.pick([1, 2, 3, 3, 6])
        : r.pick([1, 1, 1, 2]);
    if (qty * factor > avail) continue;
    lines.push({ sku: s, qty, unit: byUnit });
  }
  return lines;
}

async function sell(
  branch: Branch,
  cashier: UserKey,
  shiftId: string,
  i: number,
) {
  const c = await as(cashier);
  const lines = basket(branch);
  if (lines.length === 0) return;
  const member = r.chance(0.6) ? r.pick<any>(state.customers) : null;
  const clientRequestId = randomUUID();
  const cart: any = {
    store_id: state.stores[branch],
    customer_id: member?.id,
    channel: 'pos',
    lines: lines.map((l) => ({
      product_id: l.sku.id,
      quantity: l.qty,
      unit_id: l.unit ? l.sku.unit.id : undefined,
    })),
  };
  // manual discount: mostly within the cashier's 10%, sometimes 15% (needs approval)
  let manualPercent = 0;
  if (r.chance(0.08)) manualPercent = r.pick([5, 15]);
  if (manualPercent)
    Object.assign(cart, {
      discount_type: 'percent',
      discount_value: manualPercent,
    });
  // loyalty points for members who have some
  if (member && r.chance(0.25)) {
    const l = await c.get(`/loyalty/customer/${member.id}`).catch(() => null);
    const bal = Number(l?.points_balance ?? l?.loyalty?.points_balance ?? 0);
    if (bal >= 100) cart.points_to_redeem = Math.min(bal, r.pick([100, 200]));
  }
  let priced = await c.post('/pricing/cart', cart);
  // vouchers for members on orders ≥ 1,000,000
  let voucher: string | undefined;
  if (member && priced.total >= 1_100_000 && r.chance(0.3)) {
    voucher = (state.voucherCodes as string[]).find(
      (v) => !usedVouchers.has(v),
    );
    if (voucher) {
      try {
        const withVoucher = await c.post('/pricing/cart', {
          ...cart,
          voucher_code: voucher,
        });
        if (withVoucher.voucher?.ok === false) {
          ledger.errors.push(
            `voucher ${voucher} rejected at cart: ${withVoucher.voucher.reason}`,
          );
          voucher = undefined;
        } else {
          priced = withVoucher;
          cart.voucher_code = voucher;
          usedVouchers.add(voucher);
        }
      } catch (e) {
        ledger.errors.push(`voucher ${voucher}: ${(e as Error).message}`);
        voucher = undefined;
      }
    }
  }
  const total = Number(priced.total);

  // payment mix
  const payments: any[] = [];
  const memberCredit = member ? (credit.get(member.id) ?? 0) : 0;
  const roll = r.next();
  if (memberCredit > 0 && memberCredit <= total) {
    payments.push({ method: 'store_credit', amount: memberCredit });
    if (total - memberCredit > 0)
      payments.push({
        method: 'cash',
        amount: total - memberCredit,
        amount_tendered: total - memberCredit,
      });
    credit.set(member.id, 0);
  } else if (roll < 0.42) {
    const tendered = Math.ceil(total / 50_000) * 50_000;
    payments.push({ method: 'cash', amount: total, amount_tendered: tendered });
  } else if (roll < 0.62) {
    payments.push({
      method: 'card',
      amount: total,
      reference: `POS${r.int(100000, 999999)}`,
    });
  } else if (roll < 0.82) {
    // VietQR: create, the cashier sees the money arrive and confirms, then completes the sale
    const qr = await c.post('/qr-payments/requests', {
      store_id: state.stores[branch],
      provider: 'vietqr',
      amount: total,
      client_request_id: clientRequestId,
      pos_session_id: shiftId,
    });
    await c.post(`/qr-payments/requests/${qr.id}/confirm`);
    payments.push({
      method: 'bank_transfer',
      amount: total,
      qr_payment_request_id: qr.id,
    });
    ledger.qr.push({ id: qr.id, code: qr.code, amount: total, branch });
  } else {
    const cardPart = Math.round((total * 0.5) / 1000) * 1000;
    payments.push({
      method: 'card',
      amount: cardPart,
      reference: `POS${r.int(100000, 999999)}`,
    });
    payments.push({
      method: 'cash',
      amount: total - cardPart,
      amount_tendered: total - cardPart,
    });
  }

  const body: any = {
    client_request_id: clientRequestId,
    customer_id: member?.id,
    lines: priced.lines.map((pl: any, idx: number) => ({
      product_id: cart.lines[idx].product_id,
      quantity: cart.lines[idx].quantity,
      unit_id: cart.lines[idx].unit_id,
      expected_unit_price: Number(pl.unit_price),
    })),
    order_discount: manualPercent
      ? { type: 'percent', value: manualPercent }
      : undefined,
    points_to_redeem: cart.points_to_redeem,
    voucher_code: cart.voucher_code,
    expected_total: total,
    payments,
  };
  let order: any;
  try {
    order = await c.post('/pos/checkout', body);
  } catch (e) {
    if (e instanceof ApiError && JSON.stringify(e.body).includes('APPROVAL')) {
      const sm = await as(branch === 'hcm' ? 'smHcm' : 'smHn');
      const approval = await sm.post('/pos/discount-approvals', {
        client_request_id: clientRequestId,
        discount_percent: manualPercent,
      });
      order = await c.post('/pos/checkout', {
        ...body,
        discount_approval_token: approval.token,
      });
      ledger.negative.push({
        what: `cashier ${manualPercent}% discount needs approval, approved by store manager`,
        ok: true,
      });
    } else throw e;
  }
  // replaying the same request returns the same order (no double sale)
  if (i % 17 === 0) {
    const again = await c.post('/pos/checkout', body);
    ledger.negative.push({
      what: 'checkout replay with same client_request_id returns the same order',
      ok: again.id === order.id,
    });
  }
  for (const l of lines)
    stock[branch].set(
      l.sku.id,
      (stock[branch].get(l.sku.id) ?? 0) -
        l.qty * (l.unit ? l.sku.unit.factor : 1),
    );
  ledger.sales.push({
    id: order.id,
    number: order.order_number,
    branch,
    cashier,
    shift: shiftId,
    customerId: member?.id ?? null,
    clientRequestId,
    lines: lines.map((l, idx) => ({
      productId: l.sku.id,
      sku: l.sku.sku,
      qty: l.qty,
      baseQty: l.qty * (l.unit ? l.sku.unit.factor : 1),
      unitPrice: Number(priced.lines[idx].unit_price),
      unitName: l.unit ? l.sku.unit.name : undefined,
    })),
    breakdown: Object.fromEntries(
      [
        'subtotal',
        'line_discounts',
        'line_promotion_discount',
        'order_promotion_discount',
        'order_discount',
        'voucher_discount',
        'loyalty_discount',
        'tax',
        'total',
      ].map((k) => [k, Number(priced[k] ?? 0)]),
    ),
    total: Number(order.total_amount),
    payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
    voucher,
    points: cart.points_to_redeem ?? 0,
    manualPercent,
  });
}

async function postReturn(branch: Branch, c: Client, req: any) {
  try {
    return { ret: await c.post('/sales-returns', req), by: c.name };
  } catch (e) {
    if (
      !(
        e instanceof ApiError &&
        JSON.stringify(e.body).includes('RETURN_APPROVAL_REQUIRED')
      )
    )
      throw e;
    // over the limit: the store manager completes it (spec sales/returns)
    const sm = await as(branch === 'hcm' ? 'smHcm' : 'smHn');
    return { ret: await sm.post('/sales-returns', req), by: sm.name };
  }
}

async function doReturn(
  branch: Branch,
  cashier: UserKey,
  kind: 'cash' | 'credit' | 'exchange' | 'damaged',
) {
  const c = await as(cashier);
  const candidates = ledger.sales.filter(
    (s) =>
      s.branch === branch && !ledger.returns.some((x) => x.orderId === s.id),
  );
  const sale = candidates.find(
    (s) =>
      (kind === 'exchange'
        ? s.lines.some((l) => /-(M|L|XL|S)$|-4[0-3]$/.test(l.sku))
        : true) &&
      (kind !== 'credit' || s.customerId),
  );
  if (!sale) return;
  const lookup = await c.get('/sales-returns/lookup', { code: sale.number });
  const line =
    kind === 'exchange'
      ? lookup.lines.find((l: any) =>
          /-(M|L|XL|S)$|-4[0-3]$/.test(l.product_sku),
        )
      : lookup.lines[0];
  const items = [
    {
      sales_order_item_id: line.sales_order_item_id ?? line.id,
      quantity: 1,
      reason_code:
        kind === 'exchange'
          ? 'wrong_size'
          : kind === 'damaged'
            ? 'defective'
            : 'changed_mind',
      restock: kind !== 'damaged',
    },
  ];
  const req: any = { sales_order_id: sale.id, items };
  if (kind === 'exchange') {
    // same model, another size
    const sold = (state.skus as Sku[]).find((s) => s.sku === line.product_sku)!;
    const other = (state.skus as Sku[]).find(
      (s) =>
        s.master === sold.master &&
        s.id !== sold.id &&
        (stock[branch].get(s.id) ?? 0) > 0,
    );
    if (!other) return;
    req.exchange = { lines: [{ product_id: other.id, quantity: 1 }] };
    const pv = await c.post('/sales-returns/preview', req);
    req.exchange.lines[0].expected_unit_price = Number(
      pv.exchange_lines?.[0]?.unit_price ?? other.price,
    );
    if (pv.customer_pays > 0)
      req.exchange.payments = [
        {
          method: 'cash',
          amount: pv.customer_pays,
          amount_tendered: pv.customer_pays,
        },
      ];
    else if (pv.refund_after_exchange > 0)
      req.refunds = [{ method: 'cash', amount: pv.refund_after_exchange }];
    const { ret, by } = await postReturn(branch, c, req);
    stock[branch].set(other.id, (stock[branch].get(other.id) ?? 0) - 1);
    stock[branch].set(sold.id, (stock[branch].get(sold.id) ?? 0) + 1);
    ledger.returns.push({
      id: ret.id,
      number: ret.return_number,
      orderId: sale.id,
      branch,
      kind,
      preview: pv,
      goods: Number(ret.goods_amount),
      refund: Number(ret.refund_amount),
      exchangeOrderId: ret.exchange_order_id,
      customerPays: pv.customer_pays,
      productId: sold.id,
      newProductId: other.id,
      by,
      shift: currentShift?.id,
    });
    return;
  }
  const pv = await c.post('/sales-returns/preview', req);
  req.refunds = [
    {
      method: kind === 'credit' ? 'store_credit' : 'cash',
      amount: pv.refund_due,
    },
  ];
  const { ret, by } = await postReturn(branch, c, req);
  if (kind === 'credit' && sale.customerId)
    credit.set(
      sale.customerId,
      (credit.get(sale.customerId) ?? 0) + pv.refund_due,
    );
  const sku = (state.skus as Sku[]).find((s) => s.sku === line.product_sku)!;
  const factor = line.unit_factor ?? 1;
  if (kind !== 'damaged')
    stock[branch].set(sku.id, (stock[branch].get(sku.id) ?? 0) + factor);
  ledger.returns.push({
    id: ret.id,
    number: ret.return_number,
    orderId: sale.id,
    branch,
    kind,
    preview: pv,
    goods: Number(ret.goods_amount),
    refund: Number(ret.refund_amount),
    productId: sku.id,
    baseQty: factor,
    restock: kind !== 'damaged',
    by,
    shift: currentShift?.id,
  });
}

async function shift(
  branch: Branch,
  cashier: UserKey,
  sales: number,
  opening: number,
  countDiff: number,
  extra?: (shiftId: string) => Promise<void>,
) {
  const c = await as(cashier);
  const s = await c.post('/pos/sessions', {
    store_id: state.stores[branch],
    opening_cash: opening,
  });
  currentShift = { id: s.id, branch };
  for (let i = 0; i < sales; i++) {
    try {
      await sell(branch, cashier, s.id, i);
    } catch (e) {
      ledger.errors.push(
        `sale ${branch}/${cashier}#${i}: ${(e as Error).message}`,
      );
    }
    if (i === Math.floor(sales / 2) && extra)
      await extra(s.id).catch((e) =>
        ledger.errors.push(
          `mid-shift ${branch}/${cashier}: ${(e as Error).message}`,
        ),
      );
  }
  currentShift = null;
  const summary = await c.get(`/pos/sessions/${s.id}/summary`);
  const closed = await c.patch(`/pos/sessions/${s.id}/close`, {
    closing_cash: Number(summary.expected_cash) + countDiff,
    notes: countDiff ? 'Lệch két khi đếm' : undefined,
  });
  ledger.shifts.push({
    id: s.id,
    number: s.session_number,
    branch,
    cashier,
    opening,
    expected: Number(summary.expected_cash),
    counted: Number(summary.expected_cash) + countDiff,
    diff: countDiff,
    closed: {
      expected: Number(closed.expected_cash ?? summary.expected_cash),
      difference: Number(closed.cash_difference ?? countDiff),
    },
  });
}

async function main() {
  loadStock();
  const cats = state.categories;

  // ---- HCMC morning shift -----------------------------------------------------------
  await shift('hcm', 'cash1', 36, 2_000_000, 0, async () => {
    for (const k of ['cash', 'exchange', 'credit'] as const)
      await doReturn('hcm', 'cash1', k).catch((e) =>
        ledger.errors.push(`return ${k}: ${e.message}`),
      );
    // drawer expense during the shift (linked to the open shift)
    const categories = await (
      await as('manager')
    ).get<any[]>('/cash-book/categories');
    const shipping = categories.find((x) => x.code === 'shipping');
    const v = await (
      await as('manager')
    ).post('/cash-book/payments', {
      account_id: state.accounts.hcmDrawer,
      amount: 150_000,
      category_id: shipping.id,
      counterparty_type: 'other',
      counterparty_name: 'Grab giao hàng',
      note: 'Ship hàng cho khách',
    });
    ledger.vouchers.push({
      id: v.id,
      account: 'hcmDrawer',
      direction: 'out',
      amount: 150_000,
      category: 'shipping',
      shift: currentShift?.id,
    });
  });

  // ---- Hanoi all day ----------------------------------------------------------------
  await shift('hn', 'cash3', 34, 1_500_000, 10_000, async () => {
    for (const k of ['cash', 'damaged'] as const)
      await doReturn('hn', 'cash3', k).catch((e) =>
        ledger.errors.push(`return hn ${k}: ${e.message}`),
      );
  });

  // ---- operations ----------------------------------------------------------------------
  const wh = await as('stock');
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      ledger.errors.push(`${name}: ${(e as Error).message}`);
    }
  };
  await step('operations', async () => {
    const smHn = await as('smHn');
    // transfer HCM → HN, one unit short on arrival
    const pick = (state.skus as Sku[])
      .filter((s) => (stock.hcm.get(s.id) ?? 0) >= 4)
      .slice(0, 5);
    const t1 = await wh.post('/stock-transfers', {
      from_location_id: state.locations.hcm,
      to_location_id: state.locations.hn,
      notes: 'Bổ sung hàng HN',
      items: pick.map((s) => ({ product_id: s.id, quantity: 2 })),
    });
    await wh.post(`/stock-transfers/${t1.id}/ship`, {});
    const t1d = await wh.get(`/stock-transfers/${t1.id}`);
    await smHn.post(`/stock-transfers/${t1.id}/receive`, {
      items: t1d.items.map((it: any, idx: number) => ({
        item_id: it.id,
        quantity: idx === 0 ? it.quantity_shipped - 1 : it.quantity_shipped,
      })),
      close: true,
    });
    ledger.transfers.push({
      id: t1.id,
      number: t1.transfer_number,
      lines: pick.map((s, idx) => ({
        productId: s.id,
        shipped: 2,
        received: idx === 0 ? 1 : 2,
        cost: s.cost,
      })),
      status: 'closed',
    });
    for (const [idx, s] of pick.entries()) {
      stock.hcm.set(s.id, (stock.hcm.get(s.id) ?? 0) - 2);
      stock.hn.set(s.id, (stock.hn.get(s.id) ?? 0) + (idx === 0 ? 1 : 2));
    }
    // a second transfer left on the road
    const road = (state.skus as Sku[])
      .filter((s) => s.cat === 'Phụ kiện' && (stock.hcm.get(s.id) ?? 0) >= 6)
      .slice(0, 3);
    const t2 = await wh.post('/stock-transfers', {
      from_location_id: state.locations.hcm,
      to_location_id: state.locations.hn,
      notes: 'Đang vận chuyển',
      items: road.map((s) => ({ product_id: s.id, quantity: 3 })),
    });
    await wh.post(`/stock-transfers/${t2.id}/ship`, {});
    for (const s of road) stock.hcm.set(s.id, (stock.hcm.get(s.id) ?? 0) - 3);
    ledger.transfers.push({
      id: t2.id,
      number: t2.transfer_number,
      lines: road.map((s) => ({
        productId: s.id,
        shipped: 3,
        received: 0,
        cost: s.cost,
      })),
      status: 'in_transit',
    });

    // stock count of gloves in Hanoi: one short, one over
    const count = await smHn.post('/stock-counts', {
      location_id: state.locations.hn,
      scope: { type: 'category', category_id: cats['Găng tay'] },
      note: 'Kiểm kê găng tay',
    });
    const countDetail = await smHn.get(`/stock-counts/${count.id}`);
    const adjustments: { productId: string; diff: number; cost: number }[] = [];
    for (const [idx, it] of countDetail.items.entries()) {
      const system = Number(it.system_quantity ?? it.system ?? 0);
      const diff = idx === 0 ? -1 : idx === 1 ? 1 : 0;
      await smHn.post(`/stock-counts/${count.id}/entries`, {
        item_id: it.id,
        quantity: Math.max(0, system + diff),
      });
      if (diff) {
        const sku = (state.skus as Sku[]).find((s) => s.sku === it.sku);
        if (!sku) throw new Error(`count item ${it.sku} is not a sellable SKU`);
        adjustments.push({ productId: sku.id, diff, cost: sku.cost });
        stock.hn.set(sku.id, (stock.hn.get(sku.id) ?? 0) + diff);
      }
    }
    await smHn.post(`/stock-counts/${count.id}/complete`);
    ledger.counts.push({
      id: count.id,
      number: count.count_number,
      adjustments,
    });

    // write-off: 2 damaged stickers at HCMC
    const tem = (state.skus as Sku[]).find(
      (s) => s.cat === 'Tem dán' && (stock.hcm.get(s.id) ?? 0) >= 2,
    )!;
    const wo = await (
      await as('smHcm')
    ).post('/stock-write-offs', {
      location_id: state.locations.hcm,
      reason: 'damaged',
      note: 'Tem bị rách',
      items: [{ product_id: tem.id, quantity: 2 }],
    });
    stock.hcm.set(tem.id, (stock.hcm.get(tem.id) ?? 0) - 2);
    ledger.writeOffs.push({
      id: wo.id,
      number: wo.write_off_number,
      productId: tem.id,
      qty: 2,
      cost: tem.cost,
    });

    // monthly costs from the banks
    const fin = await as('finance');
    const categories = await fin.get<any[]>('/cash-book/categories');
    const cat = (code: string) =>
      categories.find((x) => x.code === code && x.direction === 'out').id;
    for (const [account, amount, code, name] of [
      ['hcmBank', 25_000_000, 'rent', 'Thuê mặt bằng Q7'],
      ['hnBank', 18_000_000, 'rent', 'Thuê mặt bằng Cầu Giấy'],
      ['hcmBank', 3_200_000, 'utilities', 'Điện nước HCM'],
      ['hnBank', 2_100_000, 'utilities', 'Điện nước HN'],
    ] as const) {
      const v = await fin.post('/cash-book/payments', {
        account_id: state.accounts[account],
        amount,
        category_id: cat(code),
        counterparty_type: 'other',
        counterparty_name: name,
      });
      ledger.vouchers.push({
        id: v.id,
        account,
        direction: 'out',
        amount,
        category: code,
      });
    }
  });

  // ---- HCMC afternoon shift --------------------------------------------------------------
  await shift('hcm', 'cash2', 34, 2_000_000, -20_000, async () => {
    for (const k of ['cash', 'damaged'] as const)
      await doReturn('hcm', 'cash2', k).catch((e) =>
        ledger.errors.push(`return hcm2 ${k}: ${e.message}`),
      );
  });

  // ---- refusals that must hold -------------------------------------------------------------
  const cashier = await as('cash1');
  const check = async (
    what: string,
    status: number,
    fn: () => Promise<unknown>,
  ) => {
    try {
      await expectStatus(status, fn, what);
      ledger.negative.push({ what, ok: true });
    } catch (e) {
      ledger.negative.push({ what, ok: false, detail: (e as Error).message });
    }
  };
  const openHcm = await cashier.post('/pos/sessions', {
    store_id: state.stores.hcm,
    opening_cash: 0,
  });
  const scarce = (state.skus as Sku[]).find(
    (s) => (stock.hcm.get(s.id) ?? 0) > 0 && (stock.hcm.get(s.id) ?? 0) < 5,
  )!;
  const scarceQty = (stock.hcm.get(scarce.id) ?? 0) + 5;
  const scarcePrice = (
    await cashier.post('/pricing/cart', {
      store_id: state.stores.hcm,
      lines: [{ product_id: scarce.id, quantity: 1 }],
    })
  ).lines[0].unit_price;
  await check('selling more than available is refused', 422, () =>
    cashier.post('/pos/checkout', {
      client_request_id: randomUUID(),
      lines: [
        {
          product_id: scarce.id,
          quantity: scarceQty,
          expected_unit_price: scarcePrice,
        },
      ],
      payments: [
        {
          method: 'cash',
          amount: scarcePrice * scarceQty,
          amount_tendered: scarcePrice * scarceQty,
        },
      ],
    }),
  );
  await check('a stale expected total is refused (TOTAL_CHANGED)', 409, () =>
    cashier.post('/pos/checkout', {
      client_request_id: randomUUID(),
      lines: [
        {
          product_id: scarce.id,
          quantity: 1,
          expected_unit_price: scarcePrice,
        },
      ],
      expected_total: scarcePrice - 1000,
      payments: [
        { method: 'cash', amount: scarcePrice, amount_tendered: scarcePrice },
      ],
    }),
  );
  const used = [...usedVouchers][0];
  if (used) {
    const big = (state.skus as Sku[]).find(
      (s) => s.price >= 1_500_000 && (stock.hcm.get(s.id) ?? 0) > 0,
    )!;
    const cartBody = {
      store_id: state.stores.hcm,
      customer_id: state.customers[5].id,
      voucher_code: used,
      lines: [{ product_id: big.id, quantity: 1 }],
    };
    const preview = await cashier.post('/pricing/cart', cartBody);
    ledger.negative.push({
      what: 'cart preview reports a used voucher as rejected with no discount',
      ok:
        preview.voucher?.ok === false && Number(preview.voucher_discount) === 0,
      detail: JSON.stringify(preview.voucher),
    });
    await check(
      'checkout with a used single-use voucher is refused (VOUCHER_REJECTED)',
      422,
      () =>
        cashier.post('/pos/checkout', {
          client_request_id: randomUUID(),
          customer_id: state.customers[5].id,
          voucher_code: used,
          lines: [
            {
              product_id: big.id,
              quantity: 1,
              expected_unit_price: preview.lines[0].unit_price,
            },
          ],
          payments: [{ method: 'card', amount: preview.total }],
        }),
    );
  }
  await check('a cashier cannot open the P&L', 403, () =>
    cashier.get('/reports/financial/pnl'),
  );
  await check('a cashier cannot see payables aging', 403, () =>
    cashier.get('/reports/suppliers/payables-aging'),
  );
  await check('warehouse staff cannot check out', 403, () =>
    wh.post('/pos/checkout', {
      client_request_id: randomUUID(),
      lines: [
        {
          product_id: scarce.id,
          quantity: 1,
          expected_unit_price: scarcePrice,
        },
      ],
      payments: [{ method: 'cash', amount: scarcePrice }],
    }),
  );
  await check('a cashier cannot approve a purchase order', 403, () =>
    cashier.post(`/purchase-orders/${state.purchaseOrders[0].id}/approve`),
  );
  await check('a cashier cannot change QR provider settings', 403, () =>
    cashier.put(`/qr-payments/settings/${state.stores.hcm}/vietqr`, {
      is_enabled: false,
    }),
  );
  await cashier.patch(`/pos/sessions/${openHcm.id}/close`, { closing_cash: 0 });

  ledger.finishedAt = new Date().toISOString();
  ledger.expectedStock = {
    hcm: Object.fromEntries(stock.hcm),
    hn: Object.fromEntries(stock.hn),
  };
  ledger.apiCalls = Object.values(users).reduce(
    (n, c) => n + (c?.calls ?? 0),
    0,
  );
  writeFileSync(join(OUT, 'ledger.json'), JSON.stringify(ledger, null, 2));
  console.log(
    `sales ${ledger.sales.length}, returns ${ledger.returns.length}, shifts ${ledger.shifts.length}, QR ${ledger.qr.length}, errors ${ledger.errors.length}, api calls ${ledger.apiCalls}`,
  );
  for (const e of ledger.errors) console.log('  ERROR', e);
  for (const n of ledger.negative)
    console.log(
      `  ${n.ok ? 'PASS' : 'FAIL'} ${n.what}${n.detail ? ' — ' + n.detail : ''}`,
    );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
