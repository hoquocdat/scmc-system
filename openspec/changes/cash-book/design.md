# Design

## Context

See `proposal.md` for motivation and `specs/finance/cash-book`, `specs/pos/shift-management` for behavior. Where money moves today:

| Flow | Writer | Table | Branch known? | Notes |
|---|---|---|---|---|
| POS / back-office sale payments | `SalesPostingService.createOrderIn`, `SalesService.addPayment` (both in a transaction) | `sales_order_payments` | yes, `sales_orders.store_id` | POS orders carry `pos_session_id` |
| Receivable collection | `CustomersService.applyPaymentToReceivable` (inside `recordReceivablePayment`'s transaction) | `sales_order_payments` | yes | does not call `settleIn` |
| Workshop payments | `PaymentsService.create` / `remove` (no transaction, hard delete) | `payments` | via `service_orders.store_id` (nullable) | enum `payment_method` incl. `transfer` |
| Supplier payments | `SupplierPaymentsService.create` (transaction) | `supplier_payments` | no | allocations to purchase orders |
| Payroll | `PayrollService.markPaid` (two separate updates, no transaction) | `payroll_periods`, `payroll_slips` | no | one method per period; net pay per slip |
| Shift cash in/out | `PosService.addCashMovement` | `pos_session_transactions` (signed amounts) | yes, shift `store_id` | expected cash computed from sales payments + movements |

Other facts: `document_counters` / `next_document_number(type, period)` exist (migration 021) for never-reused numbers; images are stored through `ImagesService` (Supabase storage) with `image_entity_type`; CASL subjects are a fixed union in `casl-ability.factory.ts`; report exports go through `ExportService` + `ReportExportInterceptor` (needs `reports:export`).

## Goals / Non-Goals

**Goals:** one posting service every money writer calls inside its own transaction; balances derived from entries only; shifts read the drawer from the cash book; no change to how sales, supplier payments or payroll compute amounts.

**Non-Goals:** double-entry accounting or chart of accounts; bank reconciliation; backfilling history (opening balances instead, decision D6); refunds (they come with `sales-returns`, which will call the same posting service); approval workflows for vouchers.

## Decisions

### D1. Data model (migration 023)
- `cash_book_accounts`: `id, store_id, code, name, type ('cash'|'bank'|'ewallet'), is_pos_drawer, bank_name, account_number, is_active, created_at`. Partial unique index `(store_id) WHERE is_pos_drawer`.
- `cash_book_method_accounts`: `(store_id, payment_method) → account_id`, primary key `(store_id, payment_method)`; `payment_method` is text holding the normalised method (`cash`, `card`, `bank_transfer`, `ewallet_momo`, `ewallet_zalopay`, `ewallet_vnpay`); `transfer` is normalised to `bank_transfer` on lookup.
- `cash_book_categories`: `id, code (unique), name, direction ('in'|'out'), is_system, is_active`. Seeded system codes: `sale`, `receivable_collection`, `workshop_service`, `shift_cash_in`, `opening_balance`, `transfer_in`, `other_income` (in); `supplier_payment`, `payroll`, `shift_cash_out`, `transfer_out`, `cash_count_difference`, `reversal`, `other_expense` (out); plus `cash_count_difference` in. Seeded editable examples: `Thuê mặt bằng`, `Điện nước`, `Vận chuyển`, `Sửa chữa`.
- `cash_book_entries`: `id, entry_number (unique), account_id, store_id, direction, amount (>0, CHECK), entry_date timestamptz, category_id, counterparty_type ('customer'|'supplier'|'employee'|'other'|null), counterparty_id, counterparty_name, source_type, source_id, pos_session_id, transfer_group_id, reverses_entry_id, is_automatic, status ('posted'|'cancelled'), cancelled_at, cancelled_by, cancel_reason, note, created_by, created_at`. Indexes: `(account_id, entry_date)`, `(store_id, entry_date)`, `(source_type, source_id)`, `(pos_session_id)`, `(transfer_group_id)`. Partial unique index on `(account_id) WHERE category = opening_balance AND status = 'posted'` via a `is_opening` boolean column.
- `image_entity_type` gains `cash_book_entry` for attachments (reuse `ImagesService`).
- Entry numbers: `PT-YYYYMMDD-NNNN` / `PC-YYYYMMDD-NNNN` from `next_document_number('PT'|'PC', vn_date)`.
- *Alternative*: a balance column updated on each entry. Rejected: balances at past dates and cancellations make a stored balance a second source of truth; `SUM` over the `(account_id, entry_date)` index is fast at SCMC's volume.

### D2. `CashBookPostingService`, called explicitly by every writer
`post(tx, {storeId, method?, accountId?, direction, amount, categoryCode, counterparty, source, posSessionId?, note, createdBy, at})` resolves the account (explicit id, else the branch mapping for the method), validates it belongs to the branch and is active, numbers and inserts the entry. `reverse(tx, sourceType, sourceId, reason, by)` inserts opposite-direction entries with `reverses_entry_id` for every posted automatic entry of that source.
Call sites (all inside the caller's transaction): `SalesPostingService` payments and `SalesService.addPayment` (category `sale`); `CustomersService.applyPaymentToReceivable` (`receivable_collection`); `PaymentsService.create`/`remove` (wrapped in a transaction; `workshop_service`, reversal on delete); `SupplierPaymentsService.create` (`supplier_payment`, account from new optional DTO field `cash_account_id`); `PayrollService.markPaid` (wrapped in a transaction; one `payroll` entry per slip, account from new optional `cash_account_id`); `PosService` cash movements and close (D4).
- *Alternative*: database triggers on the payment tables. Rejected: supplier and payroll payments need an account chosen by the user, which a trigger cannot receive, and the posting rules (mapping, counterparty, shift link) are easier to test in TypeScript. A completeness test (tasks) guards against a writer that forgets to post.

### D3. Account resolution and missing data
- Branch for supplier payments and payroll: the chosen account's branch; without a chosen account, the default store (`stores.is_default`).
- Workshop payment without a service-order branch: default store.
- Missing mapping or inactive account → `422 CASH_ACCOUNT_NOT_CONFIGURED` and the whole source transaction rolls back (money is never recorded without its ledger entry). D5 makes this rare.

### D4. POS shifts on the cash book
- Cash in/out: entry on the store's POS drawer with `pos_session_id`, categories `shift_cash_in` / `shift_cash_out`. With `target_account_id` (same branch), a transfer (D7) whose drawer side carries the `pos_session_id`.
- Sales cash payments already post to the drawer with the order's `pos_session_id`; receipts and workshop cash taken while the cashier has an open shift at that branch get the cashier's `pos_session_id` too (the receiving user's open shift, if any).
- Expected cash = `opening_cash + Σ(in) − Σ(out)` over posted drawer entries with that `pos_session_id` (excluding the close difference entry).
- Close: non-zero difference → entry `cash_count_difference` (in or out) with the shift id.
- Data migration: each existing `pos_session_transactions` row becomes an entry (shift's store drawer, sign → direction, `shift_cash_in/out`, original timestamp, `is_automatic = true`). The table is kept read-only for rollback and no longer written.
- Shift summary: `movements` now come from the cash book (entries of the shift other than sales receipts).

### D5. Default accounts
Migration 023 creates, for every existing store: `Tiền mặt quầy <store>` (cash, POS drawer), `Ngân hàng <store>` (bank), and maps cash → drawer, all other methods → bank. `StoresService.create` does the same in its transaction via `CashBookAccountsService.createDefaultsFor(tx, store)`. Finance renames accounts, adds safes and e-wallet accounts, and remaps methods in settings.

### D6. No historical backfill; opening balances
At go-live finance records an opening balance per account (category `opening_balance`, `is_opening`). Balances count entries with `entry_date >=` that account's opening date; accounts without an opening balance count everything. Importing past payments was rejected: past cash on hand is unknown (drawer counts were never recorded), so imported history would produce balances that disagree with reality from day one.

### D7. Transfers
`POST /cash-book/transfers` writes two entries (out on source, in on destination, categories `transfer_out`/`transfer_in`) sharing a `transfer_group_id`; both accounts must be active and different; cross-branch transfers are allowed (bank to bank). Cancel cancels both.

### D8. Corrections
Automatic entries (`is_automatic`) reject cancel with `409 AUTOMATIC_ENTRY`. Manual vouchers, transfers and opening balances are cancelled (status, reason, who, when), never deleted. Reversals of automatic entries come from source flows only (D2 `reverse`).

### D9. API and permissions
Module `src/cash-book`: `GET/POST/PATCH /cash-book/accounts`, `PUT /cash-book/accounts/method-map`, `GET/POST/PATCH /cash-book/categories`, `GET /cash-book/entries` (filters; with a single account: opening balance, running balance, totals; paged; `format=xlsx|csv` through `ExportService`, response shaped as `ReportResult`), `GET /cash-book/entries/:id`, `POST /cash-book/receipts`, `POST /cash-book/payments`, `POST /cash-book/transfers`, `POST /cash-book/opening-balances`, `POST /cash-book/entries/:id/cancel`, `GET /cash-book/balances?storeId&at`.
CASL subject `cash_book`; permissions `cash_book:read`, `cash_book:receive` (receipt vouchers), `cash_book:pay` (payment vouchers), `cash_book:transfer`, `cash_book:cancel`, `cash_book:configure` (accounts, mapping, categories, opening balances). Grants: finance all; manager all; store_manager read, receive, transfer; sales/sales_associate none (POS movements stay under `pos:create`). Activity log on every create/cancel/configure.

### D10. Frontend
`/cash-book` (list page < 200 lines) with the standard "Lọc" Sheet (branch, account, direction, category, counterparty type, source, status, date preset reusing `useReportFilters`), KPI cards (opening, receipts, payments, closing), entries table with running balance when one account is selected, export menu. Sheets for receipt voucher, payment voucher, transfer (shadcn `Sheet`, `CurrencyInput`, `Select`, image upload via existing image components). Entry detail Sheet with cancel (reason) and attachments. Settings page `/settings/cash-book` with tabs: accounts (add/edit, POS drawer flag), method mapping table per branch, categories, opening balances. Supplier payment dialog and payroll "mark paid" dialog get an account Select (defaulting to the mapping). Shift sheet: optional "to account" for cash out/in. All data via TanStack Query; navigation entry under Finance.

## Risks / Trade-offs

- [A future money writer forgets to call the posting service] → Integration completeness test: after exercising every flow, every completed `sales_order_payments`, `payments`, `supplier_payments` row and every paid slip has exactly one matching automatic entry.
- [Posting failure blocks a sale] → Only when the branch has no mapping or an inactive mapped account; D5 seeds defaults, the settings page prevents deactivating a mapped account, and the error code says what to fix.
- [Workshop payment delete and payroll mark-paid were not transactional] → Both wrapped in transactions in this change.
- [Expected cash now includes non-sale cash taken by the cashier (workshop deposits, receivable collections)] → Intended (spec scenario); it matches what is physically in the drawer.
- [Shared drawer with two simultaneous shifts at one branch] → Each shift counts only entries linked to it; the account balance remains branch-wide. Documented for store managers.
- [Opening balance date vs earlier automatic entries] → Entries before an account's opening balance date are listed but not counted; the list shows them greyed.

## Migration Plan

1. `backend/prisma/migrations/023_cash_book.sql`: tables, indexes, `image_entity_type` value, categories seed, default accounts and mappings per store, permissions and grants, migration of `pos_session_transactions`. Rollback script in `prisma/migrations/rollback/023_cash_book.sql`.
2. `npx prisma db pull && npx prisma generate`.
3. Deploy backend then frontend.
4. Go-live: finance creates safes/e-wallet accounts, checks mappings, enters opening balances per account (counted cash, bank statement balance).

## Open Questions

- Account names and which branches have safes or e-wallet accounts (configuration, not code).
