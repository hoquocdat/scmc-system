# Tasks

## 1. Database migration

- [x] 1.1 Write `backend/prisma/migrations/021_pos_checkout_core.sql`: `document_counters` table and a new `generate_sales_order_number()` using `INSERT … ON CONFLICT … RETURNING`, with today's counter seeded from existing `SO-YYYYMMDD-NNNN` numbers (design D7); verify by running `SELECT generate_sales_order_number()` twice and getting consecutive numbers that do not exist in `sales_orders`
- [x] 1.2 In the same migration add `sales_orders.pos_session_id`, `client_request_id` (unique, nullable), `discount_approved_by`; `pos_sessions.store_id` (backfilled from `stores.default_warehouse_id = location_id`), `closed_by`, and partial unique index `(user_id) WHERE status = 'open'`; `roles.max_discount_percent` (D4, D8, D9); verify with `\d sales_orders` and `\d pos_sessions` and that every existing session has a `store_id`
- [x] 1.3 Replace `update_inventory_from_transaction()` so a transaction updates the variant row when it has `product_variant_id`, otherwise the product row with `product_variant_id IS NULL` (D6); verify with SQL: insert a variant SALE transaction and check only the variant's inventory row changes
- [x] 1.4 Add permission rows `pos:approve`, `pos:credit`, `pos:manage`, `pos:reprint` and default grants (sales associate: `pos:create`; store manager and manager: all `pos:*`) (D9); verify by querying `role_permissions` for each role
- [x] 1.5 Write the matching down script restoring the previous function bodies and dropping the added columns; verify by applying up, down, up on a copy of the dev database without errors
- [x] 1.6 Apply the migration to the dev database, run `npx prisma db pull && npx prisma generate`, and verify `npm run build` in `backend` succeeds

## 2. Shared sales posting (fixes existing sales-order defects)

- [x] 2.1 Add a Jest integration test setup that runs against a disposable Postgres schema (fixtures for store, location, products, variants, customer, loyalty rules); verify a placeholder test passes with `npm run test`
- [x] 2.2 Add an optional transaction-client argument to the `LoyaltyService` methods used for redeem, earn and reverse, keeping current callers working; verify existing loyalty behavior with tests for redeem and earn inside a transaction
- [x] 2.3 Implement `PriceResolver` (variant override, product price + variant adjustment, sale price only inside its date window) (D5); verify with unit tests for each rule, including an expired sale price
- [x] 2.4 Implement `SalesPostingService.post(tx, draft)` writing order, lines, payments, SALE stock transactions with `unit_cost`, receivable for total minus paid (only if > 0) and loyalty, with inventory row locks and an insufficient-stock error (D2, D6); verify with integration tests: paid sale, partly paid sale (receivable = balance), fully paid sale (no receivable), insufficient stock (nothing written), loyalty failure (nothing written)
- [x] 2.5 Change `SalesService.create` so drafts write no stock transactions, and `SalesService.confirm` posts stock and receivable through `SalesPostingService`; verify with an integration test that create + confirm deducts stock exactly once and the sales-order form flow (create then confirm) still succeeds
- [x] 2.6 Make `SalesService.addPayment` update the order's receivable in the same transaction; verify with a test that paying 1,000,000 on a 3,000,000 confirmed order leaves a receivable balance of 2,000,000
- [x] 2.7 Make `SalesService.create` compute prices and totals on the server (ignore client `total_amount`, use `PriceResolver`) and resolve the `update_sales_order_totals` trigger conflict (D2, risk note); verify with a test that a tampered `unit_price`/`total_amount` is not stored and that stored `subtotal` equals the computed subtotal
- [x] 2.8 Add an order-number concurrency test creating 20 orders in parallel; verify all numbers are distinct and none reuses a cancelled order's number

## 3. Shift management backend

- [x] 3.1 Update shift open to require `store_id`, derive `location_id` from the store's default warehouse, and reject a second open shift; verify with tests for open and for the duplicate-open refusal (spec: Open a shift)
- [x] 3.2 Add `GET /api/pos/shifts/current` returning the caller's open shift; verify with a test that it returns the shift after "reload" (a second request) and 404 when none is open
- [x] 3.3 Validate cash in/out amounts > 0 and refuse movements on closed shifts; verify with tests for both cases
- [x] 3.4 Rewrite expected cash as opening + cash payment amounts in the shift + cash in − cash out, and close to record counted cash, difference, `closed_by`, close time (D8); verify with the spec's 2,000,000 / 3,000,000 / 200,000 / 1,000,000 → 3,800,000 scenario as a test
- [x] 3.5 Add a shift summary endpoint (sales count and total, amounts per payment method, credit given, movements, expected/counted/difference) and a history list with branch, cashier, status and date filters; verify with tests for the spec's summary-by-method scenario
- [x] 3.6 Move `PosController` from `RolesGuard` to `PoliciesGuard` with `pos:create` for own shift actions and `pos:manage` for others' shifts, and write activity-log entries for open, movements and close; verify with tests that a sales associate cannot read another cashier's shift and that the log entries exist

## 4. Checkout endpoint

- [x] 4.1 Create the checkout DTO and `POST /api/pos/checkout` guarded by `pos:create`, requiring an open shift of the caller (D3); verify with tests: no open shift → `409 SHIFT_NOT_OPEN`, technician without permission → 403
- [x] 4.2 Implement `PosCheckoutService`: resolve customer (existing, quick-register by phone, or walk-in), check `expected_unit_price` against `PriceResolver` (→ `409 PRICE_CHANGED` with new prices), compute discounts and totals, post through `SalesPostingService` as channel `pos`, status `completed`, linked to the shift; verify with tests for paid checkout, quick registration and price-changed rejection
- [x] 4.3 Implement payment rules: split payments, cash tendered/change, non-cash overpayment rejected, partial payment only for a known customer with `pos:credit`; verify with tests for each scenario in spec "Split payment" and "Sale on credit"
- [x] 4.4 Implement discount limits from `roles.max_discount_percent`, `POST /api/pos/discount-approvals` (password check, 5-minute token bound to `client_request_id` and approved percentage, rate-limited, logged) and `discount_approved_by` (D9); verify with tests: above-limit without token → `403 DISCOUNT_APPROVAL_REQUIRED`, with valid token → success and approver stored, expired or wrong-cart token → refused
- [x] 4.5 Implement idempotency on `client_request_id` (D4); verify with a test that two identical requests (including concurrent ones) produce one order and the second returns it
- [x] 4.6 Write activity-log entries for every checkout and add a reprint endpoint guarded by `pos:reprint` that logs the reprint; verify with tests that both entries are written
- [x] 4.7 Document the checkout, shift and approval endpoints in Swagger decorators; verify they appear with request and error schemas at the Swagger UI

## 5. POS frontend

- [x] 5.1 Add POS API functions and types in `frontend/src/lib/api/pos.ts` for shifts, checkout, approvals and reprint; verify `npm run build` passes type checks
- [x] 5.2 Build `PosShiftGate` (open shift with store choice remembered on the device, resume current shift) using `useQuery(['pos','shift','current'])` and `useMutation`; verify in the running app that opening a shift and reloading resumes it
- [x] 5.3 Split `POSPage.tsx` into `CartTabs`, `ProductSearch`, `CartLines`, `CartSummary` under `components/pos/`, with carts persisted per user and store in `localStorage` (wrapped in try/catch) and a page file under 150 lines (D10); verify in the app that two tabs survive a reload and `npm run lint` passes
- [x] 5.4 Make product search show branch stock and add scan handling (exact SKU match adds one unit; repeat adds quantity; no match shows "not found"); verify in the app with a USB scanner or by typing a SKU and Enter
- [x] 5.5 Replace the three payment dialogs with one `PaymentSheet` supporting split payment, cash tendered/change and credit sales for known customers; wire checkout as a `useMutation` sending `client_request_id`, keeping the cart on any error and invalidating products, shift and customer queries on success; verify in the app: cash+card sale, credit sale, and a rejected walk-in partial payment
- [x] 5.6 Handle checkout errors in the UI: price changed (update cart prices), insufficient stock (highlight line), approval required (open `ApprovalDialog`), offline/network error (banner, cart kept); verify each case in the app (stop the backend for the offline case)
- [x] 5.7 Build `ShiftSheet` for cash in/out, close with counted cash and the printable shift summary; verify in the app that closing shows the expected difference and further checkout is blocked
- [x] 5.8 Add keyboard shortcuts (F2, F4, F9, Ctrl+Enter, Ctrl+T, Ctrl+1…9) through one hook with an on-screen list; verify each shortcut in the app
- [x] 5.9 Rebuild the receipt from server data (branch name/address, order number, cashier, customer, lines, discounts, loyalty, payments, change, balance) with an 80 mm print stylesheet, A4 option, and reprint from the sales-order detail page marked "BẢN IN LẠI"; verify by printing to PDF in both sizes and reprinting a past order
- [x] 5.10 Show customer points and tier in the cart and allow point redemption within limits; verify in the app that a member's redeemed and earned points appear on the receipt and customer page

## 6. Integration checks

- [x] 6.1 Run an end-to-end pass on the dev stack: open shift → scan items → split payment → receipt → cash out → close shift; verify the order appears in `/sales/orders` with channel POS, stock dropped once, the shift summary matches, and `/sales/reports` by employee and channel include the sale
- [x] 6.2 Run the full backend test suite and both `npm run lint` and `npm run build` (backend and frontend); verify all pass
- [x] 6.3 Write a stock reconciliation script (recompute `quantity_on_hand` from `inventory_transactions` per location and list differences) and run it read-only on a copy of production data; verify it outputs a difference report for the go-live decision (design risk: existing stock levels)

## Workflow follow-up

- Decide with the store managers whether to run a stock count or apply the reconciliation before go-live.
- Archive the change after review, then start `cash-book`, which modifies `pos/shift-management`.
