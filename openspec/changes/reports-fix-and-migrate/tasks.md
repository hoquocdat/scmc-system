# Tasks

## 1. Setup

- [x] 1.1 Write `backend/prisma/migrations/022_reports_permissions.sql` adding `reports:service` and `reports:export` and the grants in design D9, apply it, run `npx prisma db pull && npx prisma generate`; verify by querying `role_permissions` for manager, finance, store manager and warehouse staff
- [x] 1.2 Add `exceljs` to `backend/package.json`; verify `npm install` and `npm run build` succeed

## 2. Report scope and test fixtures

- [x] 2.1 Add a Jest integration test setup with report fixtures (orders in every status across two stores, line and order discounts, loyalty discount, tax, payments in both tables, a sale at 06:30 Vietnam time, variants with own cost, service orders with several technicians); verify a placeholder test passes with `npm run test`
- [x] 2.2 Implement `ReportScope` (date parsing in Asia/Ho_Chi_Minh with inclusive end date, store filter, revenue-status fragment, period grouping with empty periods) (design D1); verify with unit tests for the early-morning sale, the inclusive end date and an empty day

## 3. Sales reports

- [x] 3.1 Rewrite the sales summary with the amount definitions in design D2 and the revenue-status rule; verify with tests for the spec scenarios "Cancelled and draft orders excluded" and "Discount counted once", and that net sales equals Σ total − tax − shipping on the fixtures
- [x] 3.2 Rewrite sales by category to group by product category with "Uncategorized"; verify with a test using the "Denim" / "Exhaust" scenario
- [x] 3.3 Rewrite sales by payment method to use completed `sales_order_payments` for retail, with normalised method names (D4); verify with the spec's cash 500,000 / card 1,000,000 scenario
- [x] 3.4 Rewrite top products (by quantity or net sales, variants included) and trends (day/week/month with zero periods); verify with tests for ranking order and the zero-day scenario
- [x] 3.5 Switch the sales endpoints to `PoliciesGuard` with `reports:sales` and add the store filter to all of them; verify with tests that a technician is refused and the Hanoi filter counts only Hanoi orders

## 4. Inventory reports

- [x] 4.1 Fix stock valuation to use variant cost when present, per location and total; verify with the spec's 3 × 400,000 = 1,200,000 scenario
- [x] 4.2 Page the movement report (`page`, `pageSize`, `total`) and add product, location and type filters; verify with a test returning 50 of 5,000 rows with total 5,000
- [x] 4.3 Fix turnover so units sold are aggregated before joining stock (no multiplication by locations); verify with the two-location scenario returning 10 units
- [x] 4.4 Keep low stock per location with shortfall, and guard inventory endpoints with `reports:inventory`; verify with the "at reorder point" scenario and a refused sales associate

## 5. Financial reports

- [x] 5.1 Implement COGS from SALE stock movements with `unit_cost`, falling back to current cost and returning `cogsEstimatedShare` (D3); verify with tests: cost changed after sale keeps the old cost, and a historical sale without cost is flagged as estimated
- [x] 5.2 Rewrite the revenue report as retail net sales, workshop revenue and combined, plus money received per method for retail, workshop and combined (D4, D5); verify with the spec's 40,000,000 + 25,000,000 = 65,000,000 scenario and the "received differs from sales" scenario
- [x] 5.3 Rewrite VAT from recorded `tax_amount` per day and period; verify with the 80,000 mixed-tax scenario
- [x] 5.4 Rewrite dashboard KPIs to reuse the same queries in Vietnam time, including workshop revenue; verify with a test that month-to-date net sales equals the sales summary for the same month and store
- [x] 5.5 Guard financial endpoints with `reports:financial`; verify a sales associate is refused the profit report

## 6. Workshop reports

- [x] 6.1 Add `/reports/workshop/revenue` (delivered orders by delivery date with the fallback in D5, monthly trend, store filter); verify with the "delivered orders only" and "dated by delivery" scenarios
- [x] 6.2 Add `/reports/workshop/technicians` using `service_order_employees` with primary-only revenue and the `assigned_employee_id` fallback; verify with the two-technician scenario (A: 1 order, 4,000,000; B: 1 order, 0)
- [x] 6.3 Add `/reports/workshop/parts`, `/reports/workshop/in-service` and `/reports/workshop/turnaround` (average and median); verify with the top-parts, status-breakdown (in service 6) and 2-and-4-day (average 3) scenarios
- [x] 6.4 Guard workshop endpoints with `reports:service` and require authentication; verify an unauthenticated request is refused

## 7. Export

- [x] 7.1 Give every report method a column definition (key, Vietnamese/English header, type) returned alongside its rows; verify with a unit test that each report endpoint exposes columns matching its row keys
- [x] 7.2 Implement `ExportService` for xlsx (title block, typed cells, money format, frozen header, auto-filter, totals row; streaming) and CSV (UTF-8 with BOM) (D7); verify by generating both files from fixtures, opening the xlsx with exceljs in a test to check that amount cells are numbers, and checking the CSV starts with a BOM and keeps "Nguyễn Văn Ánh"
- [x] 7.3 Add `format=xlsx|csv` to every report endpoint, requiring `reports:export` plus the report's own permission, exporting all rows up to 100,000 and refusing above with `413`, and writing an activity-log entry; verify with tests for a paged report exporting all rows, the forbidden-report refusal, the over-limit refusal and the log entry
- [x] 7.4 Rewrite `src/attendance/parsers/xlsx-parser.service.ts` on exceljs, rejecting `.xls` with a clear message, and remove `xlsx` from `package.json`; verify by importing an existing attendance `.xlsx` sample with the same result as before, and `npm ls xlsx` shows nothing

## 8. Reports frontend

- [x] 8.1 Update `frontend/src/lib/api/reports.ts` for the new parameters, responses (paging, retail/workshop/combined, `cogsEstimatedShare`), workshop endpoints and file download; verify `npm run build` passes type checks
- [x] 8.2 Build shared components in `components/reports/`: `ReportLayout`, `ReportFilterSheet` (date presets, branch, extra filters; "Lọc" Sheet pattern with padding standards), `ReportFilterBadges`, `KpiCards`, `ReportTable` on the generic DataTable, `TrendChart`; filters stored in the URL and in query keys `['reports', key, filters]`; verify in the app that filters survive a page refresh
- [x] 8.3 Build the sales report pages (summary, by category, by payment method, top products, trends) under `/reports/sales/*`, each under 200 lines; verify in the app against the API responses for the same filters
- [x] 8.4 Build inventory report pages (valuation, movement with paging, low stock, turnover); verify in the app, including paging through movements
- [x] 8.5 Build finance pages (revenue with retail/workshop/combined, gross profit with an "estimated" notice when `cogsEstimatedShare` > 0, VAT); verify in the app that the notice appears for periods before cost capture
- [x] 8.6 Build workshop pages (revenue, technicians, parts, bikes in service, turnaround) replacing the old `ReportsPage` content; verify in the app that the figures match the API for the same period
- [x] 8.7 Add the export menu (Excel, CSV) to `ReportLayout` downloading through the API with current filters, and an error toast for refused or too-large exports; verify by exporting one report of each group and opening the files in Excel or LibreOffice
- [x] 8.8 Delete `pages/ReportsPage.tsx`, register the new routes in `App.tsx`, update navigation in `AppLayout.tsx` (reports groups, link to `/sales/reports`), and add a one-time banner explaining corrected figures; verify `/reports` works, no file under `pages/` or `components/reports/` imports `lib/supabase`, and `npm run lint` passes

## 9. Integration checks

- [ ] 9.1 Compare old and new figures for one past month on a copy of production data and record the differences with their cause (status filter, discounts, payments table, time zone, category grouping); verify the comparison table is attached to the release note
- [x] 9.2 Run the full backend test suite and `npm run lint` / `npm run build` for backend and frontend; verify all pass
- [x] 9.3 Check performance on production-sized data: each report under 2 seconds for a one-month range and a 12-month export completes; verify with timings recorded in the release note

## Workflow follow-up

- Announce the corrected report figures to managers and finance before release.
- Archive the change after review; `reports-retail-suite` builds on its capabilities.
