# Reports: corrected figures, workshop migration and export

Release note for the OpenSpec change `reports-fix-and-migrate`
(`openspec/changes/reports-fix-and-migrate/`). Figures shown in the reports
area will differ from the old `/reports` page and from the old
`/api/reports/*` responses. This note lists every rule that changed so
managers and finance can reconcile.

## What changed in the numbers

| Rule | Before | Now |
|---|---|---|
| Orders counted as revenue | every sales order, including draft, pending and cancelled | only `confirmed`, `processing`, `ready`, `completed` |
| Net revenue | `total_amount - discount_amount` (discount subtracted twice) | gross (Σ unit price × qty) − line discounts − order discount − loyalty discount; equals total − tax − shipping |
| Payment method / money received | read the workshop `payments` table only | retail from `sales_order_payments` (status `completed`), workshop from `payments`, shown separately and combined |
| Cost of goods sold | current `products.cost_price` | cost recorded on the SALE stock movement (`inventory_transactions.unit_cost`); current cost only as a flagged estimate for old sales |
| VAT | fixed 10% of revenue | the `tax_amount` recorded on each order |
| Turnover | units multiplied by the number of stock locations | units aggregated before joining stock |
| Branch filter | `location_id` (stock location) | `store_id` (branch) for retail and workshop; `locationId` only on stock reports |
| Sales by category | grouped by `product_type` | grouped by product category, `Uncategorized` when none |
| Day / week / month boundaries | UTC | Asia/Ho_Chi_Minh; end date inclusive |
| Stock valuation of variants | product cost | variant `cost_price_override` when set |
| Workshop revenue date | order creation date | delivery date (`pickup_date`, else `actual_completion_date`, else `updated_at`) |
| Technician revenue | `assigned_employee_id` only | every assigned technician gets the order counted; revenue to the primary technician (fallback: `assigned_employee_id`) |

## What was added

- `ReportsModule` is now registered in `AppModule` (it had been commented out, so the reports API was never mounted).
- Workshop reports served by the API: service revenue and trend, technician performance, parts used, bikes in service by status, turnaround (average and median).
- Dashboard KPIs include workshop revenue and bikes in service.
- Every report accepts `format=xlsx|csv` and streams a file with the same filters; requires `reports:export`. Files have a title block, typed cells (amounts are numbers), frozen header, auto-filter and a totals row; CSV is UTF-8 with BOM. Exports are logged in `activity_logs` (`entity_type = report`, `action = export`). Limit: 100,000 rows (HTTP 413 above).
- Permissions: `reports:sales | inventory | financial | service | export` through `PoliciesGuard`. Migration `022_reports_permissions.sql` grants manager and finance everything; store manager sales, inventory, service, export; warehouse staff inventory.
- Frontend reports area at `/reports/*` (overview + 17 reports) built on the shared `ReportLayout`, filter Sheet, badges, KPI cards, chart and table components; filters live in the URL. The old Supabase-backed `ReportsPage` is removed.
- `xlsx@0.18.5` (vulnerable) replaced by `exceljs`; the attendance import parser now reads `.xlsx` through exceljs and rejects `.xls` with a message.

## Deployment

1. Apply `backend/prisma/migrations/022_reports_permissions.sql`, then `npx prisma db pull && npx prisma generate`.
2. Deploy backend, then frontend. No data migration.
3. Rollback: revert the code; the migration only adds permission grants.

## Verification performed

- Backend: 10 unit tests (ReportScope, ExportService) and 43 integration tests against a disposable Postgres (`npm run test:int:setup && npm run test:int`), covering every spec scenario, the permission matrix and the export interceptor.
- End-to-end API check on the seeded test database with real JWTs: figures, CSV/XLSX downloads, activity log entries, 401/403/400 paths.
- Frontend: `npm run build` and ESLint on the new files (the repository has pre-existing lint errors elsewhere).

### Timings (test database with ~12,000 sales orders, 36,000 lines, 27,000 stock movements, 3,000 service orders)

One-month range, warm call, local Postgres in Docker:

| Report | ms | Report | ms |
|---|---|---|---|
| sales/summary | 36 | financial/revenue | 49 |
| sales/by-category | 36 | financial/profit | 55 |
| sales/by-payment-method | 26 | financial/vat | 31 |
| sales/top-products | 35 | workshop/revenue | 23 |
| sales/trends | 31 | workshop/technicians | 23 |
| inventory/valuation | 21 | workshop/parts | 21 |
| inventory/movement | 38 | workshop/in-service | 21 |
| inventory/low-stock | 21 | workshop/turnaround | 21 |
| inventory/turnover | 32 | dashboard/kpis | 56 |

12-month exports: sales trends xlsx 0.3 s; top products xlsx 0.2 s; stock movement with 27,009 rows: xlsx 1.9 s (1.4 MB), csv 0.5 s (3.1 MB).

## Old vs new comparison on production data (to do before release)

Not yet done: this environment has no copy of production data. Run on a copy of the production database for one past month and record the differences per rule above (status filter, discounts, payments table, time zone, category grouping, COGS). Suggested procedure:

1. Restore a production dump into a scratch database and point `DATABASE_URL` at it.
2. Call each `/api/reports/*` endpoint for the month and keep the JSON.
3. Recompute the old figures with the previous queries (git history: `backend/src/reports/reports.service.ts` before this change) and tabulate old, new and cause.

## Known limitations

- COGS for sales recorded before stock movements carried `unit_cost` uses the current product cost; the profit report shows the estimated share (`cogsEstimatedShare`) and the UI shows a notice. New sales will carry cost once `pos-checkout-core` ships.
- Delivery date for old service orders without `pickup_date` falls back to `actual_completion_date`, then `updated_at`.
- Report headers are Vietnamese on screen; exports take `lang=vi|en`.
