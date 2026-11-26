// POS through the browser as a cashier: open a shift, scan a barcode, pay cash,
// complete; then a 25% order discount must bring up the manager-approval dialog.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE = process.env.UI_BASE ?? 'http://100.113.111.29:5173';
const OUT = path.join(__dirname, '..', 'out', 'shots');
const state = JSON.parse(fs.readFileSync(process.env.E2E_STATE ?? path.join(__dirname, '..', 'out', 'state.json'), 'utf8'));
const steps = [];
const step = (name, ok, detail) => {
  steps.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

(async () => {
  const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const apiErrors = [];
  page.on('response', (r) => r.url().includes(':3001/api') && r.status() >= 400 && apiErrors.push(`${r.status()} ${r.url().replace(/^.*\/api/, '')}`));
  page.on('response', async (r) => {
    if (r.url().endsWith('/pos/checkout') && r.status() >= 400) console.log('checkout', r.status(), await r.text());
  });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `pos-${n}.png`) });
  try {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', process.env.CASHIER ?? 'thungan2.hcm@scmc.local');
    await page.fill('#password', 'Scmc@2026!');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    const t0 = Date.now();
    await page.goto(`${BASE}/pos`);
    const openBtn = page.getByRole('button', { name: /^Mở ca$/ });
    const searchBox = page.getByPlaceholder(/Tìm theo tên, SKU hoặc quét mã/);
    await Promise.race([openBtn.waitFor({ timeout: 10000 }), searchBox.waitFor({ timeout: 10000 })]);
    if (await openBtn.isVisible()) {
      step('POS shows the open-shift form when the cashier has no shift', true, `${Date.now() - t0} ms`);
      await page.getByRole('combobox').filter({ hasText: /Chọn chi nhánh|SCMC/ }).first().click();
      await page.getByRole('option', { name: /SCMC Hồ Chí Minh/ }).click();
      await page.fill('#opening-cash', '1000000');
      await openBtn.click();
    } else {
      step('POS resumes the cashier\'s open shift on reload', true, `${Date.now() - t0} ms`);
    }
    const search = page.getByPlaceholder(/Tìm theo tên, SKU hoặc quét mã/);
    await search.waitFor({ timeout: 10000 });
    step('shift opened, POS terminal shown', true);
    await shot('1-terminal');

    // scan a barcode (scanner types the code and presses Enter)
    const scanned = state.skus.find((s) => s.barcode);
    await search.fill(scanned.barcode);
    await search.press('Enter');
    await page.getByText(scanned.name).first().waitFor({ timeout: 10000 });
    step(`barcode ${scanned.barcode} adds ${scanned.sku} to the cart`, true);
    await page.waitForTimeout(1200); // cart pricing
    await shot('2-cart');

    await page.getByRole('button', { name: /Thanh toán \(F9\)/ }).click();
    await page.getByRole('button', { name: /^Đủ$/ }).first().click();
    await shot('3-payment');
    await page.getByRole('button', { name: /Hoàn tất/ }).click();
    const sold = page.getByText(/Đã bán SO|Đã bán/);
    await sold.first().waitFor({ timeout: 15000 });
    step('cash sale completes with a receipt', true, (await sold.first().textContent())?.trim());
    await page.waitForTimeout(800);
    await shot('4-receipt');
    await page.keyboard.press('Escape');

    // 25% discount on the next sale → approval dialog
    await search.fill(scanned.barcode);
    await search.press('Enter');
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /Giảm giá đơn/ }).click();
    await page.locator('[data-radix-popper-content-wrapper] [role=combobox]').click();
    await page.getByRole('option', { name: '%' }).click();
    await page.locator('[data-radix-popper-content-wrapper] input[type=number]').fill('25');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /Thanh toán \(F9\)/ }).click();
    await page.getByRole('button', { name: /^Đủ$/ }).first().click();
    await page.getByRole('button', { name: /Hoàn tất/ }).click();
    const approval = page.getByText('Cần quản lý phê duyệt');
    await approval.waitFor({ timeout: 10000 });
    step('a 25% discount opens the manager-approval dialog (DISCOUNT_APPROVAL_REQUIRED)', true);
    await page.waitForTimeout(700);
    await shot('5-approval');
    const dialog = page.getByRole('dialog').filter({ hasText: 'Cần quản lý phê duyệt' });
    await dialog.locator('input').nth(0).fill('ch.hcm@scmc.local');
    await dialog.locator('input[type=password]').fill('Scmc@2026!');
    await dialog.getByRole('button', { name: /Phê duyệt/ }).click();
    const done = page.getByText(/Đã bán SO-/);
    await done.last().waitFor({ timeout: 15000 });
    step('store manager approves in the dialog and the discounted sale completes', true, (await done.last().textContent())?.trim());
    await page.waitForTimeout(700);
    await shot('6-approved');
  } catch (e) {
    step('flow', false, String(e).split('\n')[0]);
    await shot('error');
  }
  console.log('API errors seen:', JSON.stringify(apiErrors));
  await browser.close();
  fs.writeFileSync(path.join(__dirname, '..', 'out', 'ui-pos.json'), JSON.stringify({ steps, apiErrors }, null, 2));
})();
