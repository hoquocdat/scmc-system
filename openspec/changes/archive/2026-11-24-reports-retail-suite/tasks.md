# Tasks

## 1. Base

- [x] 1.1 Migration 029 with report indexes (D, risks) and rollback; apply; verify with `\di`
- [x] 1.2 Net/returns/COGS rule helpers (D1) shared by the new reports

## 2. Reports (backend)

- [x] 2.1 End of day: `eod.daily`, `eod.shifts` (D3)
- [x] 2.2 Sales: by hour, staff, branch × channel, brand, slow movers, discount analysis
- [x] 2.3 Returns: by product, reasons / staff
- [x] 2.4 Inventory: stock card, in transit, count variances, days of stock / dead stock
- [x] 2.5 Customers: top, receivables aging (D4), loyalty
- [x] 2.6 Suppliers: purchases, payables aging (D4)
- [x] 2.7 Promotions and vouchers performance
- [x] 2.8 Finance: cash balances, P&L (D5)
- [x] 2.9 Endpoints with permissions and export; integration tests with hand-computed figures for every spec scenario that has numbers

## 3. Frontend

- [x] 3.1 Report keys and endpoints; registry entries with KPIs; new groups (D6)
- [x] 3.2 Filter sheet: product picker and type choice
- [x] 3.3 Reports overview and navigation updated

## 4. Checks

- [x] 4.1 All suites, both builds, lint on new files
- [x] 4.2 `docs/reports/RETAIL_REPORTS.md` (each report, definitions of net, returns, COGS, expenses)
