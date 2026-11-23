# Tasks

## 1. Database migration

- [ ] 1.1 Write `backend/prisma/migrations/023_cash_book.sql`: `cash_book_accounts` (one POS drawer per store, partial unique index), `cash_book_method_accounts`, `cash_book_categories` (system and example categories), `cash_book_entries` (amount > 0 check, indexes, one posted opening balance per account), `image_entity_type` value `cash_book_entry` (design D1); verify with `\d` on each table and that inserting a second POS drawer for a store fails
- [ ] 1.2 In the same migration seed default accounts and method mappings for every existing store, and permissions `cash_book:read|receive|pay|transfer|cancel|configure` with the grants in D9; verify by querying accounts and mappings per store and `role_permissions` per role
- [ ] 1.3 Migrate `pos_session_transactions` rows into drawer entries with their shift, direction and original time (D4); verify on the test database that the count and signed sum per shift match before and after
- [ ] 1.4 Write the rollback script `prisma/migrations/rollback/023_cash_book.sql`; verify up/down/up on the test database, then apply to the dev database, run `npx prisma db pull && npx prisma generate`, and `npm run build` succeeds
- [ ] 1.5 Add the migration to `test/integration/setup-db.sh`'s ordered set (it already applies all `0*.sql`); verify `npm run test:int:setup` rebuilds the test database without errors

## 2. Posting core

- [ ] 2.1 Add CASL subject `cash_book` and actions `receive`, `pay`, `configure` (plus existing `transfer`, `cancel` as needed) to the ability factory; verify with a permissions integration test of the D9 grant matrix
- [ ] 2.2 Implement `CashBookPostingService.post` (account resolution by explicit id or branch mapping with method normalisation, active and same-branch checks, PT/PC numbering, insert) and `reverse` (D2, D3); verify with integration tests: mapped card payment lands on the bank account, `transfer` normalises to bank transfer, missing mapping raises `CASH_ACCOUNT_NOT_CONFIGURED`, numbers are unique under 20 concurrent posts
- [ ] 2.3 Implement balances (opening balance date rule, posted only, Vietnam time) (D6); verify with the spec scenario 10,000,000 + 5,000,000 − 2,000,000 = 13,000,000 and that a cancelled entry is excluded
- [ ] 2.4 Implement `CashBookAccountsService.createDefaultsFor(tx, store)` and call it from `StoresService.create` in a transaction (D5); verify a newly created store has a drawer, a bank account and a full method mapping

## 3. Automatic entries from money flows

- [ ] 3.1 Post `sale` receipts from `SalesPostingService` payments and `SalesService.addPayment`, carrying the order's branch, customer and `pos_session_id`, amount net of change (D2); verify: POS cash sale 450,000 with 500,000 tendered gives one 450,000 drawer receipt linked to order and shift; a failing checkout leaves no entry
- [ ] 3.2 Post `receivable_collection` receipts from `CustomersService.applyPaymentToReceivable`, linking the cashier's open shift at that branch if any; verify with the 2,000,000 bank transfer scenario
- [ ] 3.3 Wrap `PaymentsService.create`/`remove` in transactions; post `workshop_service` receipts (service-order branch, default store fallback) and reversal entries on delete; verify the deposit and deletion scenarios and that the drawer balance returns to its previous value
- [ ] 3.4 Add optional `cash_account_id` to the supplier payment DTO and post `supplier_payment` entries in `SupplierPaymentsService.create`'s transaction; verify the 20,000,000 bank transfer scenario and the default-store fallback
- [ ] 3.5 Wrap `PayrollService.markPaid` in a transaction, add optional `cash_account_id`, and post one `payroll` entry per paid slip; verify the three-slip 27,000,000 scenario and that a failure leaves the period unpaid
- [ ] 3.6 Add a completeness integration test that runs every flow above and asserts each completed payment row and each paid slip has exactly one automatic entry; verify it fails when one posting call is removed

## 4. Vouchers, transfers, corrections, list

- [ ] 4.1 Implement `POST /cash-book/receipts` and `/payments` (manual vouchers with category, counterparty, note, date) guarded by `cash_book:receive` / `cash_book:pay`, with attachments through `ImagesService` (`cash_book_entry`); verify the rent scenario, the zero-amount refusal and that a sales associate is refused a payment voucher
- [ ] 4.2 Implement transfers (D7) and opening balances (one posted per account) guarded by their permissions; verify drawer-to-safe, same-account refusal, second opening balance refusal
- [ ] 4.3 Implement cancel for manual vouchers, transfers (both sides) and opening balances, refusing automatic entries with `AUTOMATIC_ENTRY` (D8); verify cancelled entries stay listed with reason and are excluded from balances
- [ ] 4.4 Implement accounts, method mapping and categories endpoints with their rules (one drawer per store, no mapping to inactive accounts, no deactivating a mapped account, system categories protected); verify each rule with a test
- [ ] 4.5 Implement `GET /cash-book/entries` (filters, paging, single-account opening balance, running balance, totals) and `GET /cash-book/balances`, plus `format=xlsx|csv` using `ExportService`; verify the 5 March account statement scenario and an exported file with every matching row
- [ ] 4.6 Write activity-log entries for every create, cancel and configuration change, and document the endpoints in Swagger; verify log rows in tests and the paths in `/api/docs-json`

## 5. POS shifts on the cash book

- [ ] 5.1 Change shift cash in/out to post drawer entries (and transfers when `target_account_id` is given) instead of writing `pos_session_transactions`; verify the cash-drop-into-safe scenario and that a closed shift refuses movements
- [ ] 5.2 Compute expected cash and the shift summary movements from the cash book (D4); verify the 3,800,000 scenario still holds and the workshop-deposit-during-shift scenario adds 500,000
- [ ] 5.3 Post the `cash_count_difference` entry on close when the difference is non-zero; verify the 50,000 shortage and the exact-count scenarios
- [ ] 5.4 Re-run the existing POS and sales integration suites; verify all pass unchanged except where the spec changed

## 6. Frontend

- [ ] 6.1 Add `frontend/src/lib/api/cash-book.ts` (types and endpoints); verify `npm run build` passes type checks
- [ ] 6.2 Build `/cash-book` page with filter Sheet, active-filter badges, KPI cards, entries table with running balance, export menu, entry detail Sheet with cancel and attachments, all with shadcn components and TanStack Query; verify in the app against API data and `npm run lint` on the new files
- [ ] 6.3 Build receipt voucher, payment voucher and transfer Sheets (shown according to permissions); verify each creates an entry and refreshes balances
- [ ] 6.4 Build `/settings/cash-book` with tabs for accounts, method mapping per branch, categories and opening balances; verify each rule's error is shown in the UI
- [ ] 6.5 Add the account Select to the supplier payment dialog and the payroll mark-paid dialog, and the optional "to account" to the POS shift cash movement form; verify the chosen account receives the entry
- [ ] 6.6 Add navigation entries (Finance → Sổ quỹ; Settings → Sổ quỹ) gated by `cash_book:read` / `cash_book:configure`; verify visibility per role

## 7. Integration checks

- [ ] 7.1 End-to-end over the API on the seeded test database: configure accounts, opening balances, POS sale, receivable collection, workshop deposit and deletion, supplier payment, payroll paid, voucher, transfer, shift close with difference; verify every balance and the shift expected cash by hand-computed figures
- [ ] 7.2 Run backend unit and integration suites, both builds and lint on new files; verify all pass
- [ ] 7.3 Write `docs/finance/CASH_BOOK.md` (go-live steps: accounts, mappings, opening balances; behavior changes for cashiers and finance); verify the steps against the dev database

## Workflow follow-up

- Archive after review; `sales-returns` and `reports-retail-suite` build on `finance/cash-book`.
