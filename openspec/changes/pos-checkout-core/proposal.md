# Proposal

## Why

The `/pos` screen looks complete but does not record a sale: every payment handler in `POSPage.tsx` only logs to the console and shows a receipt, so no order, payment, stock movement or loyalty entry is created. The backend already has a mature sales-order flow and a POS shift (session) API, but the two are not connected, there is no shift UI, and a sale cannot be traced to the cash drawer it was taken into. This change makes the POS the working front door of SCMC's internal retail system (single-tenant, multi-branch: HCMC and Hanoi) and is the foundation every other POS change builds on.

## What Changes

- Checkout creates a real sales order with `channel = POS`, already confirmed, with its payments, in one atomic call. It reuses the existing sales-order logic for stock deduction (SALE inventory transaction), loyalty redemption/earning and receivables.
- Each POS sale is linked to the cashier's open shift (`pos_sessions`). Selling requires an open shift for the current user and branch.
- Shift UI: open a shift (opening cash), record cash in/out during the shift, close the shift with counted cash, and see the expected-vs-counted difference and sales by payment method.
- Split payment: one sale can be paid with several methods (cash, card, bank transfer, e-wallet recorded manually).
- Sale on credit: a sale can be completed with an unpaid balance for a known customer; the balance becomes a customer receivable (existing receivables flow). Walk-in sales without a customer must be paid in full.
- Several open invoices at the same time (tabs), so a cashier can hold one customer's cart while serving another. Carts that have not been checked out are kept on the device only.
- Barcode/SKU scan input and keyboard shortcuts for the common actions (search, pay, new tab, hold).
- Receipts show the real cashier, branch (store) and order number instead of hardcoded values, and can be reprinted from the order.
- POS sales are attributed to an employee and branch so the existing sales-by-employee and sales-by-channel reports include them.
- Fix existing sales-order defects in the shared posting code, which POS sales would otherwise hit: stock deducted twice on create + confirm, a full receivable created even for paid orders, receivables not reduced by order payments, race-prone and reusable order numbers, client-supplied prices and totals trusted, and variant stock transactions also changing the base product's stock. **BREAKING** (behavior): draft sales orders no longer deduct stock; stock is deducted once on confirmation.
- Online only: when the API is unreachable the POS shows a clear error and blocks checkout. Offline queuing is out of scope.

## Capabilities

### New Capabilities
- `pos/checkout`: Ringing up a sale at the counter: cart and tabs, product lookup and scanning, customer selection (or walk-in), discounts already supported by sales orders, split payment, sale on credit, and receipt.
- `pos/shift-management`: Cashier shifts per user and branch: opening, cash in/out, closing with counted cash, reconciliation, and the rule that POS sales belong to an open shift.

### Modified Capabilities
<!-- None: there are no baseline specs yet. The existing sales-order behavior is reused, not changed. -->

## Impact

- **Backend**: `src/pos` (new checkout endpoint, link session to sales orders, shift summary by payment method); `src/sales` (reused create-and-pay path, possibly extracted into a shared service); permissions for POS actions via the existing CASL/permissions system.
- **Database**: new raw SQL migration adding `pos_session_id` to `sales_orders` (and indexes); no change to existing data.
- **Frontend**: `pages/pos/POSPage.tsx` broken into components under `components/pos/` (it is already ~490 lines); new shift open/close/cash dialogs; payment dialogs rewired to `useMutation`; receipt template reads real cashier and store.
- **Dependencies**: none new.
- **Later changes depend on this**: `cash-book`, `price-books`, `sales-returns`, `promotions-vouchers`, `ewallet-qr-payments`, `reports-retail-suite`.

## Out of Scope

- Offline mode, e-invoicing (HĐĐT), e-commerce channels.
- Price books, promotions, vouchers (separate changes); only the existing line/order discounts and loyalty redemption are used here.
- Integrated e-wallet QR (MoMo/ZaloPay/VNPay); see `ewallet-qr-payments`. E-wallet payments are recorded manually here.
- Returns and exchanges; see `sales-returns`.
- Turning shift cash movements into cash-book entries; see `cash-book`.
