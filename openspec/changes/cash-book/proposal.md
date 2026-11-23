# Proposal

## Why

SCMC has no single record of money in and money out. Retail payments live in `sales_order_payments`, workshop payments in `payments`, supplier payments in `supplier_payments`, payroll in `payroll_slips`, and POS drawer movements in `pos_session_transactions`. There is no way to see a branch's cash or bank balance, record an ordinary expense (rent, utilities, petty cash), or produce a profit and loss that includes operating costs. A cash book (sổ quỹ) gives every money flow one ledger per account.

## What Changes

- Cash book accounts per branch: cash (one or more drawers/safes), bank accounts, and e-wallet accounts, each with an opening balance and a running balance.
- Receipt vouchers (phiếu thu) and payment vouchers (phiếu chi) with category, counterparty (customer, supplier, employee, other), amount, method, account, date, note and attachment.
- Automatic entries from existing money flows, created in the same database transaction as the source record:
  - retail sale payments and receivable collections (receipts);
  - workshop service payments (receipts);
  - supplier payments (payments);
  - payroll payouts (payments);
  - POS shift cash in/out (receipts/payments on the drawer account).
- Manual vouchers for expenses and other income, with categories that can be configured.
- Transfers between accounts (for example drawer to safe, safe to bank) as a linked pair of entries.
- POS shifts become a counted window over the drawer's cash-book account: shift cash in/out is written as cash-book entries, and shift reconciliation reads from the cash book. **BREAKING** (internal): `pos_session_transactions` stops being the source of truth for drawer movements; existing rows are migrated.
- Entries generated automatically cannot be edited directly; they are corrected by reversing the source (for example cancelling a payment). Manual vouchers can be cancelled with a reason, never deleted.
- Cash book list with filters (branch, account, type, category, date, counterparty) and running balances.

## Capabilities

### New Capabilities
- `finance/cash-book`: Accounts, receipt and payment vouchers, automatic posting from money flows, transfers between accounts, balances, and correction rules.

### Modified Capabilities
- `pos/shift-management` (introduced by `pos-checkout-core`): shift cash movements and reconciliation are recorded in and read from the cash book.

## Impact

- **Backend**: new `src/cash-book` module; posting hooks in `src/sales` (payments), `src/payments` (workshop), `src/supplier-payments`, `src/payroll`, `src/pos`.
- **Database**: raw SQL migration for accounts, entries and categories; data migration from `pos_session_transactions`; optional backfill of historical payments (decided in design).
- **Frontend**: new cash book pages (list, voucher form Sheet, accounts settings).
- **Permissions**: new cash-book permissions; only Finance and managers create manual payment vouchers, in line with the rule that only Finance processes payments.
- **Depends on**: `pos-checkout-core`. **Feeds**: `sales-returns` (refunds), `reports-retail-suite` (end-of-day, P&L with expenses).

## Out of Scope

- Double-entry general ledger, chart of accounts, or export to accounting software (POS plan phase 7, undecided).
- Bank statement import or automatic bank reconciliation.
