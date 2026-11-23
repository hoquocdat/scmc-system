# Proposal

## Why

Once POS sales, shifts, the cash book, price books, promotions, returns and inventory operations exist, managers need to see what happened each day and whether the business is making money. Store managers want an end-of-day report like the one KiotViet users rely on; owners want a profit and loss that includes returns, discounts and expenses; finance wants receivables and payables by age. This change builds those reports on the corrected reporting base from `reports-fix-and-migrate`.

## What Changes

- **End of day**: per branch and day: sales, returns, net sales, money received by method, cash in/out, sales by staff; and the shift close report (expected vs counted cash, over/short).
- **Sales**: by hour, day, week and month; by branch, staff and channel; by product, category and brand; slow sellers; discount analysis split into line discount, order discount, promotion, voucher and loyalty.
- **Returns**: return rate, value and reasons by product and staff.
- **Inventory**: stock card (movement ledger per product and location), transfers in transit, stock-count variances, days of stock and dead stock.
- **Customers**: top customers and purchase frequency; receivables aging (0-30, 31-60, 61-90, over 90 days); loyalty points issued, redeemed and outstanding.
- **Suppliers**: purchases by supplier, payables aging, supplier returns.
- **Promotions and vouchers**: uses, discount given and revenue per promotion and voucher campaign.
- **Finance**: cash book balances and entries per account; profit and loss: revenue, minus returns and discounts, minus cost of goods sold, minus expenses from the cash book; retail and workshop shown separately and combined.
- All reports use the shared filters and the xlsx/CSV export from `reports-fix-and-migrate`, and respect role permissions (for example only Finance and managers see P&L).

## Capabilities

### New Capabilities
- `reporting/end-of-day`: Daily per-branch summary and shift close report.
- `reporting/returns-reports`: Return rate, value and reasons.
- `reporting/customer-reports`: Top customers, receivables aging, loyalty liability.
- `reporting/supplier-reports`: Purchases, payables aging, supplier returns.
- `reporting/promotion-reports`: Promotion and voucher performance.

### Modified Capabilities
- `reporting/sales-reports` (introduced by `reports-fix-and-migrate`): adds time-of-day, brand, slow sellers and discount-source breakdown.
- `reporting/inventory-reports` (introduced by `reports-fix-and-migrate`): adds stock card, transfers, count variances, days of stock, dead stock.
- `reporting/financial-reports` (introduced by `reports-fix-and-migrate`): adds cash book balances and P&L with returns and expenses.

## Impact

- **Backend**: `src/reports` new endpoints, reading from POS, cash book, returns, promotions, inventory operations, receivables and supplier payables.
- **Database**: indexes to support report queries if needed; no new business tables.
- **Frontend**: new report pages and an end-of-day screen within the reports area from `reports-fix-and-migrate`.
- **Depends on**: `reports-fix-and-migrate`, `pos-checkout-core`, `cash-book`, `sales-returns`, `promotions-vouchers`, `inventory-operations` (each report can ship once its data source exists).

## Out of Scope

- Accounting software export and chart of accounts (POS plan phase 7, undecided).
- Custom report builder.
- Scheduled or emailed reports.
