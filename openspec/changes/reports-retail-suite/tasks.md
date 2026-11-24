# Tasks

## 1. Base

- [ ] 1.1 Migration 029 with report indexes (D, risks) and rollback; apply; verify with `\di`
- [ ] 1.2 Net/returns/COGS rule helpers (D1) shared by the new reports

## 2. Reports (backend)

- [ ] 2.1 End of day: `eod.daily`, `eod.shifts` (D3)
- [ ] 2.2 Sales: by hour, staff, branch × channel, brand, slow movers, discount analysis
- [ ] 2.3 Returns: by product, reasons / staff
- [ ] 2.4 Inventory: stock card, in transit, count variances, days of stock / dead stock
- [ ] 2.5 Customers: top, receivables aging (D4), loyalty
- [ ] 2.6 Suppliers: purchases, payables aging (D4)
- [ ] 2.7 Promotions and vouchers performance
- [ ] 2.8 Finance: cash balances, P&L (D5)
- [ ] 2.9 Endpoints with permissions and export; integration tests with hand-computed figures for every spec scenario that has numbers

## 3. Frontend

- [ ] 3.1 Report keys and endpoints; registry entries with KPIs; new groups (D6)
- [ ] 3.2 Filter sheet: product picker and type choice
- [ ] 3.3 Reports overview and navigation updated

## 4. Checks

- [ ] 4.1 All suites, both builds, lint on new files
- [ ] 4.2 `docs/reports/RETAIL_REPORTS.md` (each report, definitions of net, returns, COGS, expenses)
