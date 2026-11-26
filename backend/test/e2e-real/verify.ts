/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- end-to-end driver over untyped JSON API responses */
/**
 * Checks the trading day against the system: every expected figure is computed
 * here from the ledger written by trade.ts and the seed state (what was sold,
 * paid, refunded, moved and spent), then compared with the reports (through the
 * API, as the manager would open them), the database and the exports.
 *
 *   npx ts-node -r tsconfig-paths/register test/e2e-real/verify.ts
 *
 * Writes out/report.json and prints PASS/FAIL lines.
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { Client, signIn } from './api';
import { OUT, PASSWORD, USERS } from './seed';

const state = JSON.parse(readFileSync(join(OUT, 'state.json'), 'utf8'));
const ledger = JSON.parse(readFileSync(join(OUT, 'ledger.json'), 'utf8'));
const prisma = new PrismaClient();
const results: {
  area: string;
  check: string;
  ok: boolean;
  expected?: unknown;
  actual?: unknown;
}[] = [];
const n = (v: unknown) => Math.round(Number(v ?? 0));
const sum = <T>(xs: T[], f: (x: T) => number) =>
  xs.reduce((a, x) => a + f(x), 0);
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date());

function check(
  area: string,
  what: string,
  expected: unknown,
  actual: unknown,
  tolerance = 0,
) {
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Math.abs(expected - actual) <= tolerance
      : JSON.stringify(expected) === JSON.stringify(actual);
  results.push({ area, check: what, ok, expected, actual });
}

async function main() {
  const email = (k: string) => USERS.find((u) => u.key === k).email;
  const manager = new Client(
    'manager',
    await signIn(email('manager'), PASSWORD),
  );
  const rep = (path: string, q: Record<string, unknown> = {}) =>
    manager.get(`/reports/${path}`, { from: today, to: today, ...q });

  const branches = ['hcm', 'hn'] as const;
  const skuOf = new Map<string, any>(
    (state.skus as any[]).map((s) => [s.id, s]),
  );
  const sales: any[] = ledger.sales;
  const returns: any[] = ledger.returns;

  // exchange orders are ordinary sales created by returns
  const exchangeIds = returns
    .filter((r) => r.exchangeOrderId)
    .map((r) => r.exchangeOrderId);
  const exchangeOrders = await prisma.sales_orders.findMany({
    where: { id: { in: exchangeIds } },
    include: { sales_order_items: true, sales_order_payments: true },
  });
  const exPromo = (os: typeof exchangeOrders) =>
    sum(
      os,
      (o) =>
        n(o.promotion_discount_amount) +
        sum(o.sales_order_items, (i) => n(i.promotion_discount)),
    );
  const exchangeOf = (b: string) =>
    exchangeOrders.filter((o) => o.store_id === state.stores[b]);

  // ---- 1. stock: every SKU at both branches -----------------------------------------
  const inv = await prisma.inventory.findMany({
    where: { location_id: { in: [state.locations.hcm, state.locations.hn] } },
  });
  let mismatches = 0;
  const firstMismatches: string[] = [];
  for (const b of branches) {
    for (const [pid, qty] of Object.entries(
      ledger.expectedStock[b] as Record<string, number>,
    )) {
      const row = inv.find(
        (i) =>
          i.location_id === state.locations[b] &&
          i.product_id === pid &&
          !i.product_variant_id,
      );
      if ((row?.quantity_on_hand ?? 0) !== qty) {
        mismatches++;
        if (firstMismatches.length < 5)
          firstMismatches.push(
            `${b} ${skuOf.get(pid)?.sku}: expected ${qty}, db ${row?.quantity_on_hand}`,
          );
      }
    }
  }
  check(
    'stock',
    'on hand per SKU and branch matches the ledger (121 SKUs × 2 branches)',
    0,
    mismatches,
  );
  if (firstMismatches.length) results.at(-1).actual = firstMismatches;
  check(
    'stock',
    'no negative stock',
    0,
    inv.filter((i) => i.quantity_on_hand < 0).length,
  );
  check(
    'stock',
    'no stock left reserved (no pending orders)',
    0,
    sum(inv, (i) => i.quantity_reserved ?? 0),
  );
  // stock card of one returned SKU closes at the database quantity
  const cardSku =
    returns.find((r) => r.branch === 'hcm')?.productId ??
    sales[0].lines[0].productId;
  const stockCard = await rep('inventory/stock-card', {
    productId: cardSku,
    locationId: state.locations.hcm,
  });
  const dbQty = inv.find(
    (i) => i.location_id === state.locations.hcm && i.product_id === cardSku,
  )?.quantity_on_hand;
  check(
    'stock',
    `stock card of ${skuOf.get(cardSku)?.sku} at HCMC closes at the on-hand quantity`,
    dbQty,
    n(stockCard.meta.closing),
  );

  // ---- 2. orders and payments -----------------------------------------------------------
  for (const s of sales) {
    const paid = sum(s.payments, (p: any) => p.amount);
    if (paid !== s.total)
      check('orders', `order ${s.number} payments equal total`, s.total, paid);
    if (s.total !== s.breakdown.total)
      check(
        'orders',
        `order ${s.number} total equals the cart quote`,
        s.breakdown.total,
        s.total,
      );
  }
  check(
    'orders',
    'every order is paid in full and matches its cart quote',
    true,
    results.filter((r) => r.area === 'orders').length === 0,
  );
  const dbOrders = await prisma.sales_orders.findMany({
    where: { id: { in: sales.map((s) => s.id) } },
    select: { id: true, status: true, total_amount: true },
  });
  check(
    'orders',
    'all POS orders are completed in the database',
    sales.length,
    dbOrders.filter((o) => o.status === 'completed').length,
  );
  check(
    'orders',
    'database totals equal checkout totals',
    sum(sales, (s) => s.total),
    sum(dbOrders, (o) => n(o.total_amount)),
  );
  const orderNumbers = await prisma.sales_orders.findMany({
    select: { order_number: true },
  });
  check(
    'orders',
    'order numbers are unique',
    orderNumbers.length,
    new Set(orderNumbers.map((o) => o.order_number)).size,
  );

  // ---- 3. end of day per branch ------------------------------------------------------------
  const eod = await rep('eod/daily');
  for (const b of branches) {
    const ss = sales.filter((s) => s.branch === b);
    const ex = exchangeOf(b);
    const rs = returns.filter((r) => r.branch === b);
    const gross =
      sum(ss, (s) => s.breakdown.subtotal) +
      sum(ex, (o) =>
        sum(o.sales_order_items, (i) => n(i.unit_price) * i.quantity),
      );
    // exchange orders carry their own discounts (promotions apply to them like any sale)
    const exManual = sum(
      ex,
      (o) =>
        n(o.discount_amount) +
        sum(o.sales_order_items, (i) => n(i.discount_amount) * i.quantity),
    );
    const manual =
      sum(ss, (s) => s.breakdown.line_discounts + s.breakdown.order_discount) +
      exManual;
    const promo =
      sum(
        ss,
        (s) =>
          s.breakdown.line_promotion_discount +
          s.breakdown.order_promotion_discount,
      ) + exPromo(ex);
    const voucher =
      sum(ss, (s) => s.breakdown.voucher_discount) +
      sum(ex, (o) => n(o.voucher_discount_amount));
    const loyalty =
      sum(ss, (s) => s.breakdown.loyalty_discount) +
      sum(ex, (o) => n(o.loyalty_discount_amount));
    const net = sum(ss, (s) => s.total) + sum(ex, (o) => n(o.total_amount));
    const goods = sum(rs, (r) => r.goods);
    const byMethod = (m: string) =>
      sum(ss, (s) =>
        sum(
          s.payments.filter((p: any) => p.method === m),
          (p: any) => p.amount,
        ),
      ) +
      sum(ex, (o) =>
        sum(
          o.sales_order_payments.filter(
            (p) => p.payment_method === m && p.status === 'completed',
          ),
          (p) => n(p.amount),
        ),
      );
    const row = eod.rows.find((x: any) => x.storeId === state.stores[b]);
    const label = b.toUpperCase();
    check('eod', `${label} orders`, ss.length + ex.length, row.orders);
    check('eod', `${label} gross`, gross, row.gross);
    check('eod', `${label} manual discounts`, manual, row.manualDiscounts);
    check('eod', `${label} promotion discounts`, promo, row.promotionDiscounts);
    check('eod', `${label} voucher discounts`, voucher, row.voucherDiscounts);
    check('eod', `${label} loyalty discounts`, loyalty, row.loyaltyDiscounts);
    check('eod', `${label} net sales`, net, row.netSales);
    check('eod', `${label} returns (goods value)`, goods, row.returns);
    check(
      'eod',
      `${label} net after returns`,
      net - goods,
      row.netAfterReturns,
    );
    check('eod', `${label} cash received`, byMethod('cash'), row.receivedCash);
    check('eod', `${label} card received`, byMethod('card'), row.receivedCard);
    check(
      'eod',
      `${label} bank transfer (VietQR) received`,
      byMethod('bank_transfer'),
      row.receivedBank,
    );
    check(
      'eod',
      `${label} store credit used`,
      byMethod('store_credit'),
      row.receivedCredit,
    );
    check(
      'eod',
      `${label} exchange value applied`,
      byMethod('exchange'),
      row.receivedExchange,
    );
    check(
      'eod',
      `${label} refunds paid`,
      sum(rs, (r) => r.refund),
      row.refundsPaid,
    );
  }

  // ---- 4. sales summary and payment methods (both branches) -----------------------------------
  const summary = (await rep('sales/summary')).meta.summary;
  const allNet = sum(eod.rows, (r: any) => r.netSales);
  check(
    'sales',
    'sales summary net equals the end-of-day total',
    allNet,
    n(summary.netSales),
  );
  check(
    'sales',
    'sales summary orders',
    sales.length + exchangeOrders.length,
    n(summary.orders),
  );
  const methods = await rep('sales/by-payment-method');
  const card = sum(sales, (s) =>
    sum(
      s.payments.filter((p: any) => p.method === 'card'),
      (p: any) => p.amount,
    ),
  );
  check(
    'sales',
    'payment-method report: card',
    card,
    n(methods.rows.find((r: any) => r.method === 'card')?.amount),
  );
  const byStaff = await rep('sales/by-staff');
  for (const key of ['cash1', 'cash2', 'cash3'] as const) {
    const name = USERS.find((u) => u.key === key).name;
    check(
      'sales',
      `by-staff: ${name} orders`,
      sales.filter((s) => s.cashier === key).length,
      n(byStaff.rows.find((r: any) => r.staff === name)?.orders),
    );
  }
  const byHour = await rep('sales/by-hour');
  check(
    'sales',
    'by-hour totals equal net sales',
    allNet,
    n(byHour.totals.netSales),
  );
  const discounts = await rep('sales/discounts');
  check(
    'sales',
    'discount report: vouchers',
    sum(sales, (s) => s.breakdown.voucher_discount),
    n(discounts.totals.vouchers),
  );
  check(
    'sales',
    'discount report: loyalty',
    sum(sales, (s) => s.breakdown.loyalty_discount),
    n(discounts.totals.loyalty),
  );

  // ---- 5. shifts ---------------------------------------------------------------------------
  const shifts = await rep('eod/shifts');
  for (const sh of ledger.shifts) {
    const row = shifts.rows.find((x: any) => x.id === sh.id);
    check(
      'shifts',
      `${sh.number} expected cash`,
      sh.expected,
      n(row?.expected),
    );
    check('shifts', `${sh.number} over/short`, sh.diff, n(row?.difference));
    // independent: float + cash taken − cash handed back − drawer expenses during this shift
    const cashIn = sum(
      sales.filter((s) => s.shift === sh.id),
      (s) =>
        sum(
          s.payments.filter((p: any) => p.method === 'cash'),
          (p: any) => p.amount,
        ),
    );
    const inShift = returns.filter((r) => r.shift === sh.id);
    const exchangeCash = sum(
      exchangeOrders.filter((o) =>
        inShift.some((r) => r.exchangeOrderId === o.id),
      ),
      (o) =>
        sum(
          o.sales_order_payments.filter((p) => p.payment_method === 'cash'),
          (p) => n(p.amount),
        ),
    );
    const refunds = sum(
      inShift.filter((r) => r.kind !== 'credit'),
      (r) => r.refund,
    );
    const expenses = sum(
      ledger.vouchers.filter((v: any) => v.shift === sh.id),
      (v: any) => v.amount,
    );
    const independent = sh.opening + cashIn + exchangeCash - refunds - expenses;
    check(
      'shifts',
      `${sh.number} expected cash equals float + cash sales − refunds − drawer expenses (${sh.cashier})`,
      independent,
      sh.expected,
    );
  }

  // ---- 6. cash book balances ------------------------------------------------------------------
  const bal = await rep('financial/cash-balances');
  const accounts = await prisma.cash_book_accounts.findMany();
  const code = (id: string) => accounts.find((a) => a.id === id).code;
  const closing = (id: string) =>
    n(bal.rows.find((r: any) => r.code === code(id))?.closing);
  const supplierPaid = sum(
    state.purchaseOrders,
    (p: any) => Math.round((p.total * 0.6) / 1000) * 1000,
  );
  const paidBy = (b: string, methodsList: string[]) =>
    sum(
      sales.filter((s) => s.branch === b),
      (s) =>
        sum(
          s.payments.filter((p: any) => methodsList.includes(p.method)),
          (p: any) => p.amount,
        ),
    ) +
    sum(exchangeOf(b), (o) =>
      sum(
        o.sales_order_payments.filter(
          (p) =>
            methodsList.includes(p.payment_method) && p.status === 'completed',
        ),
        (p) => n(p.amount),
      ),
    );
  const cashRefunds = (b: string) =>
    sum(
      returns.filter((r) => r.branch === b && r.kind !== 'credit'),
      (r) => r.refund,
    );
  const vouchersOut = (acc: string) =>
    sum(
      ledger.vouchers.filter((v: any) => v.account === acc),
      (v: any) => v.amount,
    );
  // a counted difference at shift close is posted so the drawer matches the count
  const countDiff = (b: string) =>
    sum(
      ledger.shifts.filter((x: any) => x.branch === b),
      (x: any) => x.diff,
    );
  const expectBal = {
    hcmDrawer:
      paidBy('hcm', ['cash']) -
      cashRefunds('hcm') -
      vouchersOut('hcmDrawer') +
      countDiff('hcm'),
    hnDrawer:
      paidBy('hn', ['cash']) -
      cashRefunds('hn') -
      vouchersOut('hnDrawer') +
      countDiff('hn'),
    hcmBank:
      3_000_000_000 -
      supplierPaid +
      paidBy('hcm', ['card', 'bank_transfer']) -
      vouchersOut('hcmBank'),
    hnBank:
      1_000_000_000 +
      paidBy('hn', ['card', 'bank_transfer']) -
      vouchersOut('hnBank'),
  };
  for (const [k, v] of Object.entries(expectBal))
    check('cash', `${k} closing balance`, v, closing(state.accounts[k]));

  // ---- 7. returns -------------------------------------------------------------------------------
  const rbp = await rep('returns/by-product');
  check(
    'returns',
    'returned quantity (base units)',
    sum(returns, (r) => r.baseQty ?? 1),
    n(rbp.totals.quantity),
  );
  check(
    'returns',
    'returned value',
    sum(returns, (r) => r.goods),
    n(rbp.totals.value),
  );
  check(
    'returns',
    'damaged (not restocked) quantity',
    sum(
      returns.filter((r) => r.restock === false),
      (r) => r.baseQty ?? 1,
    ),
    n(rbp.totals.damaged),
  );

  // ---- 8. inventory operations ---------------------------------------------------------------------
  const transit = await rep('inventory/in-transit');
  const onRoad = ledger.transfers.filter((t: any) => t.status === 'in_transit');
  check(
    'inventory',
    'in transit quantity',
    sum(onRoad, (t: any) => sum(t.lines, (l: any) => l.shipped - l.received)),
    n(transit.totals.quantity),
  );
  check(
    'inventory',
    'in transit value at cost',
    sum(onRoad, (t: any) =>
      sum(t.lines, (l: any) => (l.shipped - l.received) * l.cost),
    ),
    n(transit.totals.value),
  );
  const variances = await rep('inventory/count-variances');
  check(
    'inventory',
    'count variance value',
    sum(ledger.counts, (c: any) =>
      sum(c.adjustments, (a: any) => a.diff * a.cost),
    ),
    n(variances.totals.value),
  );
  const loss = await prisma.inventory_transactions.findMany({
    where: { transaction_type: 'TRANSFER_LOSS' },
  });
  check(
    'inventory',
    'transfer shortfall recorded as a loss',
    sum(ledger.transfers, (t: any) =>
      t.status === 'closed'
        ? sum(t.lines, (l: any) => l.shipped - l.received)
        : 0,
    ),
    sum(loss, (l) => Math.abs(l.quantity)),
  );
  const wo = await prisma.inventory_transactions.findMany({
    where: { transaction_type: 'WRITE_OFF' },
  });
  check(
    'inventory',
    'write-off quantity',
    sum(ledger.writeOffs, (w: any) => w.qty),
    sum(wo, (w) => Math.abs(w.quantity)),
  );

  // ---- 9. profit and loss ----------------------------------------------------------------------------
  const pnl = await rep('financial/pnl');
  const line = (key: string) => pnl.rows.find((r: any) => r.key === key);
  const soldCost =
    sum(sales, (s) =>
      sum(s.lines, (l: any) => l.baseQty * skuOf.get(l.productId).cost),
    ) +
    sum(exchangeOrders, (o) =>
      sum(
        o.sales_order_items,
        (i) => i.quantity * (i.unit_factor ?? 1) * skuOf.get(i.product_id).cost,
      ),
    );
  const restockedCost = sum(
    returns.filter((r) => r.restock !== false),
    (r) => (r.baseQty ?? 1) * skuOf.get(r.productId).cost,
  );
  check(
    'pnl',
    'retail revenue (net − returns)',
    allNet - sum(returns, (r) => r.goods),
    n(line('revenue')?.retail),
  );
  check(
    'pnl',
    'retail COGS (sold − restocked, at cost)',
    -(soldCost - restockedCost),
    n(line('cogs')?.retail),
  );
  const expenses = sum(ledger.vouchers, (v: any) => v.amount);
  check(
    'pnl',
    'operating expenses (rent, utilities, shipping)',
    -expenses,
    n(line('opex')?.combined),
  );
  check(
    'pnl',
    'supplier payments are not expenses',
    undefined,
    pnl.rows.find((r: any) => r.key === 'expense:supplier_payment'),
  );

  // ---- 10. promotions, customers, loyalty, suppliers ------------------------------------------------------
  const perf = await rep('promotions/performance');
  const voucherRow = perf.rows.find((r: any) => r.kind === 'Voucher');
  check(
    'promotions',
    'voucher campaign orders',
    sales.filter((s) => s.voucher).length,
    n(voucherRow?.orders),
  );
  check(
    'promotions',
    'voucher campaign discount',
    sum(sales, (s) => s.breakdown.voucher_discount),
    n(voucherRow?.discount),
  );
  check(
    'promotions',
    'promotion discount across campaigns (incl. exchange orders)',
    sum(
      sales,
      (s) =>
        s.breakdown.line_promotion_discount +
        s.breakdown.order_promotion_discount,
    ) + exPromo(exchangeOrders),
    sum(
      perf.rows.filter((r: any) => r.kind !== 'Voucher'),
      (r: any) => n(r.discount),
    ),
  );
  const usedCodes = await prisma.vouchers.count({
    where: { used_count: { gt: 0 } },
  });
  check(
    'promotions',
    'each voucher code used at most once',
    sales.filter((s) => s.voucher).length,
    usedCodes,
  );
  const top = await rep('customers/top', { limit: 200 });
  const memberOrders = new Map<string, number>();
  for (const s of sales.filter((x) => x.customerId))
    memberOrders.set(s.customerId, (memberOrders.get(s.customerId) ?? 0) + 1);
  for (const o of exchangeOrders.filter((x) => x.customer_id))
    memberOrders.set(o.customer_id, (memberOrders.get(o.customer_id) ?? 0) + 1);
  check(
    'customers',
    'customers with purchases',
    memberOrders.size,
    top.rows.length,
  );
  check(
    'customers',
    'member orders in top customers',
    sum([...memberOrders.values()], (x) => x),
    n(top.totals.orders),
  );
  const loyalty = await rep('customers/loyalty');
  const earned = await prisma.loyalty_point_transactions.aggregate({
    _sum: { points: true },
    where: { transaction_type: 'earn' },
  });
  check(
    'customers',
    'loyalty points earned',
    n(earned._sum.points),
    n(loyalty.totals.earned),
  );
  check(
    'customers',
    'loyalty points redeemed',
    sum(sales, (s) => s.points),
    n(loyalty.totals.redeemed),
  );
  const purchases = await rep('suppliers/purchases');
  check(
    'suppliers',
    'purchased value',
    sum(state.purchaseOrders, (p: any) => p.total),
    n(purchases.totals.purchased),
  );
  const payables = await rep('suppliers/payables-aging');
  check(
    'suppliers',
    'payables still owed (40%)',
    sum(state.purchaseOrders, (p: any) => p.total) - supplierPaid,
    n(payables.totals.total),
  );

  // ---- 11. every report exports -----------------------------------------------------------------------
  const keys = [
    'eod/daily',
    'eod/shifts',
    'sales/summary',
    'sales/by-hour',
    'sales/by-staff',
    'sales/by-branch',
    'sales/by-brand',
    'sales/slow-movers',
    'sales/discounts',
    'sales/by-category',
    'sales/by-payment-method',
    'sales/top-products',
    'sales/trends',
    'returns/by-product',
    'returns/reasons',
    'inventory/in-transit',
    'inventory/count-variances',
    'inventory/days-of-stock',
    'inventory/valuation',
    'inventory/movement',
    'inventory/low-stock',
    'inventory/turnover',
    'customers/top',
    'customers/receivables-aging',
    'customers/loyalty',
    'suppliers/purchases',
    'suppliers/payables-aging',
    'promotions/performance',
    'financial/cash-balances',
    'financial/pnl',
    'financial/revenue',
    'financial/profit',
    'financial/vat',
  ];
  let exported = 0;
  const failed: string[] = [];
  for (const k of keys) {
    for (const format of ['xlsx', 'csv']) {
      const res = await manager.raw(`/reports/${k}`, {
        from: today,
        to: today,
        format,
      });
      const body = Buffer.from(await res.arrayBuffer());
      const type = res.headers.get('content-type') ?? '';
      if (
        res.ok &&
        body.length > 0 &&
        (format === 'csv' ? type.includes('csv') : type.includes('spreadsheet'))
      )
        exported++;
      else failed.push(`${k}.${format} → ${res.status}`);
    }
  }
  const sc = await manager.raw('/reports/inventory/stock-card', {
    from: today,
    to: today,
    productId: cardSku,
    format: 'xlsx',
  });
  if (sc.ok) exported++;
  else failed.push(`stock-card.xlsx → ${sc.status}`);
  check(
    'exports',
    `all ${keys.length * 2 + 1} report exports download (xlsx and csv)`,
    keys.length * 2 + 1,
    exported,
  );
  if (failed.length) results.at(-1).actual = failed;

  // ---- output -------------------------------------------------------------------------------------------
  const pass = results.filter((r) => r.ok).length;
  for (const r of results)
    console.log(
      `${r.ok ? 'PASS' : 'FAIL'} [${r.area}] ${r.check}${r.ok ? '' : ` — expected ${JSON.stringify(r.expected)}, got ${JSON.stringify(r.actual)}`}`,
    );
  console.log(
    `\n${pass}/${results.length} checks passed; ${ledger.sales.length} sales, ${returns.length} returns, ${exchangeOrders.length} exchange orders, ${ledger.negative.filter((x: any) => x.ok).length}/${ledger.negative.length} refusal checks passed, ${ledger.errors.length} trade errors`,
  );
  writeFileSync(
    join(OUT, 'report.json'),
    JSON.stringify(
      { today, results, negative: ledger.negative, errors: ledger.errors },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
