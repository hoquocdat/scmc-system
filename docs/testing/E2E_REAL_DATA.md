# End-to-end test with realistic data

A full trading day at both branches, driven through the real API and the real web app, with every figure
checked independently. Harness: `backend/test/e2e-real/`.

## What it does

1. **Fresh database** `scmc_sms_e2e`, built from every migration (`test/integration/setup-db.sh`).
2. **Seed through the API** (`seed.ts`). Users are created in Supabase Auth and sign in with a password,
   the same way the web app does:
   - 9 users: superadmin, manager, finance, two store managers, three cashiers, warehouse staff
   - 2 branches, each with a drawer and a bank account, payment methods mapped, opening bank balances
   - 121 sellable SKUs: helmets, jackets, gloves and boots in sizes, accessories, parts, oil sold by the
     bottle or the case of 12, stickers sold singly or by the box of 10; barcodes on 12 items
   - 5 purchase orders, approved and so received at HCMC, 60 % paid
   - 40 % of every SKU transferred to Hanoi
   - 150 customers, a VIP group, a VIP price book (−10 % helmets and jackets)
   - 3 promotions (stickers buy 2 get 1, gloves −15 %, orders from 10M −300,000), a voucher campaign with
     40 single-use codes, VietQR at both branches
3. **Trade a day** (`trade.ts`), the way the POS screens call the API: cart pricing, then QR or approval
   if needed, then checkout.
   - 104 sales across 3 shifts (two at HCMC, one at Hanoi)
   - Payments: cash with change, card, VietQR confirmed by the cashier, card + cash splits, store credit
   - Members redeem points and use vouchers; VIP prices apply; a 15 % manual discount gets a store
     manager's approval
   - Returns, previewed first: cash refund, store credit, a size exchange, a damaged item. Returns over
     2,000,000 are completed by the store manager.
   - A transfer that arrives one unit short; a transfer left on the road; a glove count at Hanoi
     (one short, one over); a write-off; rent and utilities from the banks; a shipping expense from the drawer
   - Shift closes: one exact, one 20,000 short, one 10,000 over
   - Refusals that must hold: overselling, a stale total, a used voucher, cashiers opening the P&L or
     payables, warehouse staff checking out, a cashier approving a purchase order or changing QR settings
   - Checkout replays with the same request id
4. **Verify** (`verify.ts`): 83 checks. Each expected figure is computed from what was done: what was
   sold, paid, refunded, moved and spent, and at what cost. The checks cover:
   - Stock for every SKU at both branches, and the stock card
   - Order totals and payments
   - End of day per branch: every discount source, returns, money received by method, refunds
   - Sales reports, by staff, by hour, discounts
   - Every shift's expected cash, recomputed as float + cash sales + exchange top-ups − cash refunds −
     drawer expenses
   - Cash book balances of all four accounts
   - Returns, in transit, count variances, transfer losses, write-offs
   - P&L (revenue, COGS net of restocked returns, expenses), promotions and vouchers
   - Customers, loyalty, supplier purchases and payables
   - Every report downloaded as xlsx and csv (67 files)
5. **Browser** (`ui/`, Playwright with the cached Chromium). Login runs through the real form at
   `http://100.113.111.29:5173`.
   - Every main screen and every report page, as manager and as cashier
   - A POS sale end to end: open shift, scan a barcode, pay cash, complete
   - A 25 % discount: the manager-approval dialog opens, the store manager approves, the sale completes

## Running it

```bash
# once: local Supabase (auth + storage) from the repo root; config in supabase/ (not committed)
npx supabase@2.40.7 start -x vector,logflare,imgproxy,supavisor,postgres-meta,studio,realtime,edge-runtime,mailpit

# backend against the e2e database (frontend/.env and backend/.env point at local Supabase)
cd backend
DATABASE_URL=postgresql://backbone_user:backbone_password@127.0.0.1:5434/scmc_sms_e2e npm run start:dev

# in another terminal: rebuild the database, seed, trade, verify (about 7 minutes)
bash test/e2e-real/run.sh all

# browser checks (frontend: npm run dev -- --host)
npm i --no-save playwright-core@1.57.0
node test/e2e-real/ui/ui-check.js && CASHIER=thungan2.hcm@scmc.local node test/e2e-real/ui/ui-pos.js
```

Output goes to `backend/test/e2e-real/out/` (ignored by git): `state.json` (ids), `ledger.json` (every
action), `report.json` (checks), and `shots/` (screenshots). All users' password is `Scmc@2026!`. Log in
to the web app with e.g. `manager@scmc.local` to look at the day.

## Result (2026-11-26)

- **Verify:** 83/83 checks
- **Refusals:** 21/21 held
- **Trading errors:** 0
- **Browser:** 65/70 pages clean. The other 5 are intended refusals: no open shift answers 404; the
  cashier and the manager opened by URL pages they aren't allowed to see. The POS flow passes.

## Defects found and fixed

| # | Defect | Effect | Fix |
| --- | --- | --- | --- |
| 1 | Money columns were `NUMERIC(10,2)` (max 99,999,999.99) on 52 columns, plus the purchase-order totals function | A purchase-order line of 10 premium helmets failed with a 500; large sales and shift cash would too | Migration 030 widens them to `NUMERIC(15,2)`; the dependent view, trigger and function are recreated |
| 2 | The legacy `@Roles` guards never named `superadmin` and used role names that don't exist (`admin`, `warehouse`) | The superadmin got 403 on products, categories, purchase orders, inventory and payroll | `roleMatches()`: superadmin passes, legacy names map to the real roles |
| 3 | The frontend API client replaced every HTTP error with a plain `Error` | The POS never recognised a refusal: no discount-approval dialog, no price-changed or out-of-stock details, no stale-total re-pricing, no shift resume. Opening the POS took about 3 s | The interceptor keeps the AxiosError and only replaces its message |
| 4 | Cart ids came from `crypto.randomUUID()`, which only exists over HTTPS or localhost | Every POS sale failed (400) when the app was opened at `http://<LAN IP>` | `lib/uuid.ts` falls back to `crypto.getRandomValues`; saved carts with old ids get a new one |
| 5 | A store manager's refund or expense paid from the drawer, a manual drawer voucher, or a drawer transfer during a shift wasn't linked to the open shift | The shift's expected cash ran 6,080,000 too high, so the cashier would have looked short | Drawer entries link to the user's shift, otherwise the branch's open shift (not for back-dated vouchers) |
| 6 | The stock card ignored purchase-order receipts and supplier returns (`purchase` / `return`) | Wrong opening balance and running balance (−10 instead of 5) | Included in the stock card's movement rule |
| 7 | Stock counts by category or brand included master products | A count sheet listed every model's parent at 0 | Products with size/colour products under them are left out |
| 8 | Report tables paged at 10 rows and showed a row-selection count | The P&L's net profit was on page 2 | Report tables show 100 rows, with no selection count |
| 9 | Toasts in the bottom-right corner | The "Đã bán …" toast covered the POS pay button for the next customer, and the buttons at the bottom of side sheets | Toasts at the top centre |
| 10 | Breadcrumb labelled any unknown page "Chi tiết đơn hàng"; `/cash-book` had none | Wrong titles on reports and most new screens | Labels for the new screens; report pages show group › report |
| 11 | Header logo hotlinked from a website that now returns 404 | Broken logo and a console error on every page | Local `/logo.svg` |
| 12 | The "Vai trò" menu was shown to managers, but only superadmin can read roles | Managers landed on a page that fails | Menu entry for superadmin only |
| 13 | Swagger merged DTOs with the same class name | API docs showed the supplier-return body for `POST /sales-returns` (and similar for payments and transfers) | `@ApiSchema` names |
| 14 | The QR settings copy button used `navigator.clipboard` | It threw over plain HTTP | Falls back to asking the user to copy |

## Decisions for the business (not changed)

- **Store managers cannot record payment vouchers** (phiếu chi). They have read, receive and transfer
  only, so a drawer expense needs a manager or finance user. Grant `cash_book:pay` to `store_manager` if
  branches should pay small expenses themselves.
- **Store managers cannot create purchase orders.** Only warehouse staff and managers can; managers approve.
- **Purchase orders always receive into the default warehouse (HCMC).** Hanoi gets stock by transfer.
  A per-order receiving branch would be a new feature.
- **Promotions apply to exchange orders.** In the size exchange, the original order and the exchange
  order each got the "orders from 10M, −300,000" discount, so the customer received 150,000 back for
  swapping a size. If that should not happen, exchanges need to keep the original order's promotion
  instead of re-applying promotions.
- **Returns above 2,000,000 need a store manager** (`RETURN_APPROVAL_LIMIT`, environment variable).

## Not covered

Real MoMo/ZaloPay/VNPay sandboxes and real bank transfers; printing to a thermal printer; several days of
history (all trading happens on the run's day); the older workshop screens beyond loading.
