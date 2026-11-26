# Design

## Context

See `proposal.md` for motivation and `specs/reporting/*` for required behavior. Current state:

- `backend/src/reports/reports.service.ts` (503 lines) mixes Prisma `findMany` + in-memory sums with `$queryRaw`. None of its queries filter by status. `getDateRange` uses server-local `new Date(...)`; `TO_CHAR(created_at, …)` and `DATE(created_at)` run in the database session's time zone (UTC by default). "By category" groups on `products.product_type`. Payment-method and revenue reports read `payments` (workshop, linked to `service_orders`). COGS uses `products.cost_price` (current). The movement report returns every row.
- `ReportsController` uses `RolesGuard` with role names. CASL already defines subject `reports` with actions `sales`, `inventory`, `financial`, `service`, `export`; the database has permission rows for `reports:sales|inventory|financial` only.
- `frontend/src/lib/api/reports.ts` (203 lines) wraps the 13 endpoints and is imported by nothing. `frontend/src/pages/ReportsPage.tsx` (561 lines) queries Supabase with `useEffect`, attributes service work to `assigned_employee_id` only (the system now supports several technicians through `service_order_employees` with `is_primary`), and exports CSV in the browser.
- `sales_orders` has both `store_id` (branch) and `location_id` (stock location). `service_orders` has `store_id`.
- Retail line amounts live in `sales_order_items` (`unit_price`, `discount_amount`, `tax_amount`, `total_amount`). The `update_sales_order_totals` trigger overwrites `sales_orders.subtotal`, so `subtotal` is not reliable on its own.
- `inventory_transactions.unit_cost` exists but is empty for sales until `pos-checkout-core` (D6) fills it.
- `xlsx@0.18.5` is used only by `src/attendance/parsers/xlsx-parser.service.ts` (reading uploaded files).

## Goals / Non-Goals

**Goals:**
- One place that defines the reporting rules (statuses, time zone, branch, amounts) so every report and export agrees.
- Correct numbers on today's data, without waiting for the POS changes.
- Report screens that follow the project standards (TanStack Query, Shadcn, filter Sheet, pages under 200 lines).

**Non-Goals:**
- No new business tables, no materialized views, no reporting database.
- No changes to how orders, payments or stock are written (that is `pos-checkout-core`).
- No scheduled or emailed reports.

## Decisions

### D1. A shared report scope built in SQL
A `ReportScope` helper turns query parameters (`from`, `to`, `storeId`, plus report-specific filters) into a validated object, and provides SQL fragments used by every report:
- `revenueOrders`: `status IN ('confirmed','processing','ready','completed')`.
- Period: `from`/`to` are dates (`YYYY-MM-DD`) interpreted in `Asia/Ho_Chi_Minh`; condition `order_date >= (from AT TIME ZONE tz) AND order_date < ((to + 1 day) AT TIME ZONE tz)`.
- Grouping: `date_trunc(:interval, order_date AT TIME ZONE 'Asia/Ho_Chi_Minh')`, joined to `generate_series` so empty periods return zero.
- Branch = `store_id` for both retail and workshop. `location_id` is used only by stock reports.
All retail aggregates move to `$queryRaw` with these fragments, replacing `findMany` + JavaScript sums (fewer rows transferred, one rule set).
- *Alternative*: fix each method separately. Rejected: the same bugs would come back in the next report.

### D2. Amount definitions
Computed from lines, not from `sales_orders.subtotal`:
- gross = Σ `unit_price × quantity`
- discounts = Σ line `discount_amount × quantity` + order `discount_amount` + `loyalty_discount_amount`
- net = gross − discounts (equals Σ `total_amount − tax_amount − shipping_cost`; a test asserts this on fixtures)
- tax = Σ `tax_amount`; shipping = Σ `shipping_cost`
The order-date column is `order_date` if set, else `created_at` (`COALESCE`).

### D3. COGS from stock movements
COGS = Σ over SALE `inventory_transactions` (by `reference_type = 'sales_order'` and `reference_id` in scope) of `|quantity| × COALESCE(unit_cost, current cost)`. The response includes `cogsEstimatedShare` (the share of COGS that used current cost) so the UI can show "partly estimated". Once `pos-checkout-core` records `unit_cost`, the estimated share drops to zero for new sales.
- *Alternative*: store cost on `sales_order_items`. Rejected here: needs a write-path change that belongs to `pos-checkout-core`; the movement already carries the cost.

### D4. Payments split by business line
Retail money received = `sales_order_payments` with `status = 'completed'`, by `payment_date`. Workshop money received = `payments`. Responses always return `{ retail, workshop, combined }` per method. Payment-method names are normalised (`transfer` and `bank_transfer` → bank transfer) in one mapping.

### D5. Workshop rules
- Delivered date = `pickup_date`, falling back to `actual_completion_date`, then `updated_at`, for orders with `status = 'delivered'`. Revenue = `COALESCE(final_cost, estimated_cost, 0)`.
- Technician performance joins `service_order_employees`; order count per employee; revenue only where `is_primary`. Orders with no `service_order_employees` rows fall back to `assigned_employee_id` as primary (older data).
- Bikes in service = current snapshot (`status NOT IN ('delivered','cancelled')`), not period-based.
- Turnaround uses `percentile_cont(0.5)` for the median.
- Parts used = `service_parts` joined to `parts`, by `created_at` in scope.

### D6. API shape
Keep existing paths; add `/reports/workshop/{revenue,technicians,parts,in-service,turnaround}`. Common query params: `from`, `to`, `storeId`, `interval`, `page`, `pageSize`. Every report endpoint also accepts `format=xlsx|csv`; with a format the same service method runs without paging and the controller streams a file instead of JSON. Paged endpoints (movement) return `{ data, total, page, pageSize }`.
Controller switches to `PoliciesGuard` + `@CheckPolicies({ subject: 'reports', action: Sales | Inventory | Financial | Service })`; exports additionally require `reports:export`.

### D7. Export with exceljs, server-side
An `ExportService` takes a report definition `{ title, columns: [{ key, header (vi/en), type: 'text'|'number'|'money'|'date'|'percent' }], rows, totals? }` and writes:
- xlsx via `exceljs` streaming writer: title block (report, branch, period, generated at, by), header row, typed cells (money as number with `#,##0` format), frozen header, auto-filter, totals row.
- csv: UTF-8 with BOM, comma separated, same columns.
Each report method returns rows plus its column definition, so screen and file share one source. Limit 100,000 rows; above that the request fails with `413` and the message from the spec. Each export writes an `activity_logs` entry.
- *Alternative*: client-side export (current CSV approach). Rejected: would need to fetch every page into the browser and bypasses server-side limits and logging.
- `xlsx` is removed; the attendance parser is rewritten on `exceljs` reading (`workbook.xlsx.load(buffer)`).

### D8. Frontend structure
`/reports` becomes a reports area with a left list of report groups (Sales, Inventory, Finance, Workshop) and nested routes (`/reports/sales/summary`, `/reports/workshop/technicians`, …), each page under 200 lines.
- Shared components in `components/reports/`: `ReportLayout` (title, filter button, export menu), `ReportFilterSheet` (date range presets, branch, staff/channel where relevant; follows the "Lọc" Sheet pattern), `ReportFilterBadges`, `KpiCards`, `ReportTable` (on the generic DataTable), `TrendChart`.
- Filters live in the URL (`useSearchParams` + `useMemo`) and in query keys: `['reports', reportKey, filters]`.
- Export calls the same endpoint with `format` and downloads the blob.
- `/sales/reports` (employee and channel) stays and is linked from the Sales group; its backend lives in `sales` and is not changed here other than applying the D1 scope rules.
- `ReportsPage.tsx` and its Supabase import are deleted.

### D9. Report permissions seed
Migration adds `reports:service` and `reports:export` permission rows and grants: manager and finance all report actions; store manager sales, inventory, service, export; warehouse staff inventory.

## Risks / Trade-offs

- [Managers see different numbers than before] → Expected; the old numbers were wrong. Release note lists each corrected rule; first release shows a one-time banner on the reports area.
- [Historic COGS uses current cost] → Flagged in the response and UI as estimated, as the spec requires.
- [Delivered date fallback is imprecise for old orders without `pickup_date`] → Documented in the report footnote; new deliveries set `pickup_date`.
- [Time-zone conversion makes indexes on `created_at` less useful] → Conditions compare the raw column against converted bounds (sargable); only grouping converts.
- [Large exports hold memory] → exceljs streaming writer and a 100,000 row cap.
- [exceljs cannot read legacy `.xls`] → Check attendance import files in use; if `.xls` is needed, convert on upload is out of scope and the parser rejects `.xls` with a clear message.
- [Role-name guard replaced by permissions] → Seed grants mirror today's role access so no one loses access on deploy; verified against `@Roles` lists in the controller.

## Migration Plan

1. `backend/prisma/migrations/022_reports_permissions.sql`: permission rows and grants (D9). Optional supporting indexes: `sales_orders (store_id, order_date)`, `inventory_transactions (reference_type, reference_id)` already exists.
2. Backend: `ReportScope`, rewritten queries, workshop endpoints, export service; replace `xlsx` with `exceljs` in `package.json` and the attendance parser.
3. Frontend: reports area and components; delete `ReportsPage.tsx`; update navigation in `AppLayout.tsx`.
4. Rollback: backend and frontend can be reverted independently of the migration (it only adds permission rows).

## Open Questions

- Report column headers: Vietnamese only, or follow the app's language switcher (`LanguageSwitcher.tsx` exists). Defaults to the switcher; does not change the design.
- Exact preset list for date ranges (today, yesterday, this week, last week, this month, last month, this year, custom).
