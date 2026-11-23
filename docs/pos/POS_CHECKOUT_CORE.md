# POS checkout core

Release note for the OpenSpec change `pos-checkout-core`
(`openspec/changes/pos-checkout-core/`): the POS terminal now records real
sales inside a cashier shift, on the shared sales-order posting rules.

## What changed

### Checkout
- `POST /api/pos/checkout` records the whole sale in one atomic call: sales order with `channel = pos`, status `completed`, lines at **server-resolved prices**, payments (split allowed), SALE stock movements with the unit cost at time of sale, receivable for any unpaid balance, loyalty redemption and earning. Nothing is written if any part fails.
- Idempotent on `client_request_id`: a retry (including a concurrent duplicate) returns the existing order with `idempotent_replay: true`.
- Error codes the POS reacts to: `SHIFT_NOT_OPEN` (409), `PRICE_CHANGED` (409, with the new prices), `INSUFFICIENT_STOCK` (409, with availability), `DISCOUNT_APPROVAL_REQUIRED` (403), `PAYMENT_RULE` (422).
- Payment rules: non-cash payments cannot exceed the total; cash records tendered and change; a walk-in sale must be paid in full; a known customer may owe a balance only when the cashier has `pos:credit`.
- Discount limits per role (`roles.max_discount_percent`, 10% for sales roles by default). Above the limit a user with `pos:approve` signs in on the device (separate, non-persisted Supabase session) and `POST /api/pos/discount-approvals` issues a 5-minute token bound to that cart; the approver is stored on the order.
- Quick customer registration by name + phone (reuses an existing phone).
- `POST /api/pos/orders/:id/reprint` returns receipt data and logs the reprint (`pos:reprint`).

### Shifts
- One open shift per user (database rule). Opening takes a **branch (store)**; the selling location is the store's default warehouse. `GET /api/pos/sessions/current` resumes it on any device.
- Cash in/out with a reason; refused on closed shifts.
- Expected cash = opening + cash payment amounts + cash in − cash out. Closing records counted cash, difference and who closed. Viewing or closing another user's shift needs `pos:supervise`.
- Shift summary: sales count and total, amounts per payment method, credit given, movements, expected vs counted.

### Shared sales-order fixes (affect the back-office sales order form too)
- **Drafts no longer deduct stock.** Stock is deducted exactly once when an order is confirmed or created as completed, under row locks. Before this, create + confirm deducted twice.
- Receivable = total − completed payments, created only when a balance remains; payments keep it in sync in the same transaction.
- Prices and totals are computed on the server; client-sent unit prices and totals are ignored.
- Order numbers come from `document_counters` (per Vietnam business day): race-free, never reused. Shift numbers use the same counter.
- The inventory trigger updates only the exact stock row (variant movements no longer change the base product's row).
- The 006 trigger that rewrote `sales_orders.subtotal` is dropped.
- Cancelling an order returns stock only if it had been deducted.

### Frontend (`/pos`)
Rebuilt on shadcn components: shift gate (open/resume), cart tabs (several open invoices, kept on the device), product search with scanner input (exact SKU adds one unit), variant picker, branch stock on cards and lines, line and order discounts, loyalty points, one payment sheet with split payments and change, error handling per code, approval dialog, shift sheet (cash in/out, summary, close), receipt from server data (80 mm default, A4 option), reprint from the order page, keyboard shortcuts (F1 lists them), offline banner.

## Permissions (migration 021)
`pos:create` (sell, own shift), `pos:approve`, `pos:credit`, `pos:supervise`, `pos:reprint` in addition to the existing `pos:read|void|refund`. Sales associate/sales: read, create. Store manager, manager, superadmin: all. Finance: read, supervise.

## Deployment
1. Apply `backend/prisma/migrations/021_pos_checkout_core.sql`, then `npx prisma db pull && npx prisma generate`. Rollback script: `backend/prisma/migrations/rollback/021_pos_checkout_core.sql`.
2. Deploy backend, then frontend.
3. **Before go-live, reconcile stock**: `npm run cli:reconcile-stock` lists every stock row whose quantity differs from its movement history (expected after the double-deduction bug); `--apply` records ADJUST movements to align them. Run it read-only on a copy of production first and review with the store managers.

## Verification performed
- Backend: 23 unit tests, 76 integration tests (`npm run test:int`), covering every checkout and shift spec scenario, the sales-order fixes, 20 concurrent order numbers, idempotency, approval tokens, permissions.
- End-to-end over the real API with JWTs on a seeded test database: open → sell (split payment, loyalty) → idempotent retry → price change → approval → cash out → reprint → close → order in `/sales` and in the reports.
- Frontend: `npm run build` and ESLint on the new files. The UI was not clicked through in a browser (login is Supabase-only here); a manual pass is still due.

## Known limitations / follow-ups
- Barcode scanning matches SKU until `inventory-operations` adds a barcode field.
- The loyalty discount is applied by the server; the payment sheet shows the amount due before loyalty, so with points redeemed the cashier enters the smaller server total (the receipt shows the final figures).
- Shift cash movements still live in `pos_session_transactions`; `cash-book` will move them into the ledger.
