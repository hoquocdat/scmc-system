# Proposal

## Why

SCMC's reports cannot be trusted today. The backend `reports` module (13 endpoints) has no screen that calls it, and its numbers are wrong: it counts draft and cancelled orders as revenue, subtracts discounts twice, reads workshop `payments` instead of retail `sales_order_payments`, uses today's product cost for past sales, assumes 10% VAT instead of the stored tax, and multiplies units sold by the number of locations in the turnover query. The workshop reports page (`/reports`) still queries Supabase directly, which the project no longer uses. These problems exist now, regardless of the new POS work, so they are fixed first and separately.

## What Changes

- Fix the existing report calculations:
  - only revenue-bearing order statuses are counted (rule set in design);
  - net revenue uses `total_amount` as already discounted;
  - payment-method and revenue reports read retail payments (`sales_order_payments`) and workshop payments (`payments`) separately and combined;
  - cost of goods sold uses the cost recorded on the sale's inventory transaction (`unit_cost`), not the current product cost;
  - VAT uses the stored `tax_amount`;
  - turnover no longer multiplies rows across locations;
  - one consistent branch filter (store vs stock location, decided in design).
- Move the workshop reports (service revenue and monthly trend, technician performance, top parts used) from Supabase to the backend, and add bikes in service by status and service turnaround time.
- A combined revenue view across retail and workshop.
- Report screens built on the corrected endpoints, using TanStack Query and the standard filter Sheet pattern (date range, branch, staff, channel).
- Export for every report to Excel (xlsx) and CSV, generated on the server with the same filters and permission checks as the on-screen report.
- Replace the vulnerable `xlsx@0.18.5` dependency: exports use `exceljs`; the attendance import parser is moved off `xlsx` as well.
- Remove the Supabase client from `ReportsPage`. Other frontend files still import it (`authStore`, `LoginForm`, `DashboardPage`, `EmployeeWorkPage`, `ActivityTimeline`, `ServiceItemsManager`, `PartsUsageManager`); removing those is a separate clean-up, not part of this change.
- Also fix: sales "by category" grouped by `product_type` instead of product category; dates bucketed in UTC instead of Vietnam time (Asia/Ho_Chi_Minh); inventory movement returned without pagination.

## Capabilities

### New Capabilities
- `reporting/sales-reports`: Sales summary, by category, by payment method, top products and trends, with correct revenue rules.
- `reporting/inventory-reports`: Stock valuation, movement, low stock and turnover.
- `reporting/financial-reports`: Revenue, gross profit (COGS at cost of sale) and VAT from stored tax.
- `reporting/workshop-reports`: Service revenue, technician performance, parts used, bikes in service, turnaround time.
- `reporting/report-export`: Server-side xlsx/CSV export for any report, with the same filters and permissions.

### Modified Capabilities
<!-- None in openspec/specs yet. -->

## Impact

- **Backend**: `src/reports` (calculation fixes, new workshop endpoints, export endpoints); `src/attendance/parsers/xlsx-parser.service.ts` (library change); `package.json` (add `exceljs`, remove `xlsx`).
- **Frontend**: rewrite `pages/ReportsPage.tsx` into a reports area with components; wire `lib/api/reports.ts`; remove Supabase usage.
- **Behavior change**: report totals will differ from today's because the old numbers were wrong; this should be announced to managers and finance.
- **Depends on**: none; can start right away. **Feeds**: `reports-retail-suite`.

## Out of Scope

- New retail reports that need data from the other POS changes (end-of-day, returns, promotions, cash book, P&L with expenses); see `reports-retail-suite`.
- Materialized views or a separate reporting database (not needed at current volume; revisit if reports become slow).
- Scheduled or emailed reports.
