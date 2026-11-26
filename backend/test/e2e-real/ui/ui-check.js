// Browser pass over the real UI: login through the form, open every main screen
// and every report as the manager, the POS as a cashier. Records JS errors,
// failed API calls and visible error banners, with a screenshot per page.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE = process.env.UI_BASE ?? 'http://100.113.111.29:5173';
const OUT = path.join(__dirname, '..', 'out', 'shots');
const state = JSON.parse(fs.readFileSync(process.env.E2E_STATE ?? path.join(__dirname, '..', 'out', 'state.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

const REPORTS = 'eod/daily eod/shifts sales/by-hour sales/by-staff sales/by-branch sales/by-brand sales/discounts sales/slow-movers sales/returns-by-product sales/returns-reasons inventory/in-transit inventory/count-variances inventory/days-of-stock customers/top customers/receivables-aging customers/loyalty suppliers/purchases suppliers/payables-aging promotions/performance finance/cash-balances finance/pnl sales/summary sales/trends sales/by-category sales/by-payment-method sales/top-products inventory/valuation inventory/movement inventory/low-stock inventory/turnover finance/revenue finance/profit finance/vat workshop/revenue workshop/technicians workshop/parts workshop/in-service workshop/turnaround'.split(' ');
const helmet = state.skus.find((s) => s.sku.startsWith('MBH-1-'));
const MANAGER_PAGES = [
  '/dashboard', '/pos', '/sales/orders', '/sales/returns', '/customers', '/customers/groups', '/suppliers',
  '/inventory/products', '/inventory/stock', '/inventory/purchase-orders', '/inventory/transfers', '/inventory/counts',
  '/inventory/write-offs', '/inventory/reorder-alerts', '/inventory/price-books', '/inventory/promotions', '/inventory/vouchers',
  '/inventory/categories', '/inventory/brands', '/cash-book', '/settings/cash-book', '/settings/qr-payments', '/settings/loyalty',
  '/settings/roles', '/reports',
  ...REPORTS.map((r) => `/reports/${r}?preset=today`),
  `/reports/inventory/stock-card?preset=today&productId=${helmet.id}`,
];

async function session(browser, email, pages, label) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const page = await ctx.newPage();
  const results = [];
  let current = { url: '', console: [], api: [], pageErrors: [] };
  page.on('console', (m) => m.type() === 'error' && current.console.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => current.pageErrors.push(String(e).slice(0, 300)));
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes(':3001/api') && r.status() >= 400) current.api.push(`${r.status()} ${r.request().method()} ${u.replace(/^.*\/api/, '')}`.slice(0, 200));
  });

  await page.goto(`${BASE}/login`);
  await page.fill('#email', email);
  await page.fill('#password', 'Scmc@2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  results.push({ url: '/login', ok: true, note: `signed in as ${email}` });

  for (const p of pages) {
    current = { url: p, console: [], api: [], pageErrors: [] };
    try {
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const banners = await page
        .locator('[role=alert]:has-text("Không tải được"), text=/Something went wrong|Đã xảy ra lỗi|Unexpected Application Error/')
        .allTextContents()
        .catch(() => []);
      const redirectedToLogin = page.url().includes('/login');
      const file = `${label}${p.replace(/[/?=&]/g, '_').slice(0, 90)}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: false });
      const rows = await page.locator('table tbody tr').count().catch(() => 0);
      results.push({ url: p, ok: !current.pageErrors.length && !banners.length && !redirectedToLogin && !current.api.length, rows, banners, ...current, file });
    } catch (e) {
      results.push({ url: p, ok: false, error: String(e).slice(0, 300), ...current });
    }
  }
  await ctx.close();
  return results;
}

(async () => {
  const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`, args: ['--no-sandbox'] });
  const manager = await session(browser, 'manager@scmc.local', MANAGER_PAGES, 'mgr');
  const cashier = await session(browser, 'thungan1.hcm@scmc.local', ['/pos', '/sales/returns', '/reports/finance/pnl?preset=today', '/cash-book'], 'cash');
  await browser.close();
  const all = [...manager.map((r) => ({ who: 'manager', ...r })), ...cashier.map((r) => ({ who: 'cashier', ...r }))];
  fs.writeFileSync(path.join(__dirname, '..', 'out', 'ui-results.json'), JSON.stringify(all, null, 2));
  for (const r of all) {
    if (r.ok) continue;
    console.log(`FAIL ${r.who} ${r.url}`);
    for (const k of ['error', 'pageErrors', 'api', 'banners', 'console']) if (r[k] && r[k].length) console.log(`   ${k}: ${JSON.stringify(r[k]).slice(0, 600)}`);
  }
  console.log(`${all.filter((r) => r.ok).length}/${all.length} pages clean`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
