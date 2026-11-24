# Design

## Context

The reports area (`reports-fix-and-migrate`) gives every report the same envelope (`ReportResult`: columns, rows, totals, meta), the same query (`from`, `to`, `storeId`, `interval`, paging, `limit`, `sortBy`, `productId`, `locationId`, `type`), Vietnam-time date scoping (`ReportScope`), xlsx/csv export through one interceptor, and permissions `reports:sales|inventory|financial|service|export`. The frontend renders any report from a registry entry (title, filters, KPIs, chart). Since then the data model gained shifts and the cash book, price books, promotions and vouchers (`sales_order_discounts`, order and line promotion/voucher amounts), returns (`sales_returns`, items, refunds), inventory operations (transfers, counts, write-offs, reservations), customer credit, and QR payments.

## Goals / Non-Goals

**Goals:** the end-of-day and shift reports; the sales, returns, inventory, customer, supplier, promotion and finance reports listed in the proposal; all through the existing envelope, filters, export and permissions.

**Non-Goals:** accounting export, custom report builder, scheduled reports, new business tables.

## Decisions

### D1. One rule for "net"

- **Gross** = Σ unit price × quantity of revenue-status orders (confirmed, processing, ready, completed).
- **Discounts** = line + order (manual) + promotion (line and order) + voucher + loyalty.
- **Net sales** = gross − discounts (as the existing summary now does).
- **Returns** = Σ `goods_amount` of returns created in the period (by return date, not order date).
- **Net after returns** = net sales − returns.
- **COGS** = cost of `SALE` movements − cost of restocked `RETURN` movements from sales returns (damaged returns stay in COGS).
- Exchange orders are ordinary sales; the exchange value appears as a payment method "exchange".

### D2. Report list (key → endpoint, permission)

| Key | Endpoint | Permission |
| --- | --- | --- |
| `eod.daily` | `/reports/eod/daily` | sales |
| `eod.shifts` | `/reports/eod/shifts` | sales |
| `sales.by-hour` | `/reports/sales/by-hour` | sales |
| `sales.by-staff` | `/reports/sales/by-staff` | sales |
| `sales.by-branch` | `/reports/sales/by-branch` (branch × channel) | sales |
| `sales.by-brand` | `/reports/sales/by-brand` | sales |
| `sales.slow-movers` | `/reports/sales/slow-movers` | sales |
| `sales.discounts` | `/reports/sales/discounts` (per interval) | sales |
| `returns.by-product` | `/reports/returns/by-product` | sales |
| `returns.reasons` | `/reports/returns/reasons` (by reason, `type=staff` by staff) | sales |
| `inventory.stock-card` | `/reports/inventory/stock-card` (`productId`, `locationId`) | inventory |
| `inventory.in-transit` | `/reports/inventory/in-transit` | inventory |
| `inventory.count-variances` | `/reports/inventory/count-variances` | inventory |
| `inventory.days-of-stock` | `/reports/inventory/days-of-stock` (`type=dead` for no sale in the period) | inventory |
| `customers.top` | `/reports/customers/top` | sales |
| `customers.receivables-aging` | `/reports/customers/receivables-aging` | financial |
| `customers.loyalty` | `/reports/customers/loyalty` | sales |
| `suppliers.purchases` | `/reports/suppliers/purchases` | financial |
| `suppliers.payables-aging` | `/reports/suppliers/payables-aging` | financial |
| `promotions.performance` | `/reports/promotions/performance` | sales |
| `financial.cash-balances` | `/reports/financial/cash-balances` | financial |
| `financial.pnl` | `/reports/financial/pnl` | financial |

### D3. End of day

`eod.daily` rows are branches for the chosen day (default today): orders, gross, each discount source, net, returns, net after returns, received by method (cash, card, bank transfer, e-wallets, store credit, exchange, plus receivable collections), refunds paid out, drawer cash in/out from shifts and vouchers, and new receivables (credit sales). Meta holds sales by staff. `eod.shifts` rows are shifts closed or open in the period: cashier, opened/closed, opening float, cash sales, cash refunds, cash in/out, expected, counted, over/short.

### D4. Aging

Ages are counted in days from the document date to the report's end date (default today): 0–30, 31–60, 61–90, over 90. Customer receivables use `customer_receivables.balance` with the order date; supplier payables use `purchase_orders.total_amount − paid_amount` for approved/received orders with the order date.

### D5. Profit and loss

Rows: retail gross, discounts, returns, retail net revenue; workshop revenue (from `financial.revenue`); total revenue; retail COGS (D1) and workshop parts cost; gross profit; operating expenses from the cash book (posted payment entries whose category is an expense: payroll, rent, utilities, shipping, maintenance, other expense and custom payment categories; excluding supplier payments, transfers, sales returns, shift cash out and count differences, which are not expenses); net profit. Columns: retail, workshop, combined. Supplier payments are not expenses because purchases become COGS when sold.

### D6. Frontend

New groups in the reports area: "Cuối ngày", "Khách hàng", "Nhà cung cấp", "Khuyến mãi" alongside sales, inventory, finance, workshop. The filter sheet gains a product picker (stock card) and a "type" choice where a report has one. Each report is one registry entry with KPIs where useful.

## Risks / Trade-offs

- **Query cost** on large data: indexes added for `sales_returns(created_at)`, `inventory_transactions(product_id, created_at)` / variant, `sales_order_discounts(promotion_id)` (exists), `customer_receivables(status)`.
- **Return date vs order date**: returns are counted when they happen, so a day's net can be negative; this matches the cash reality and is stated on the report.

## Migration Plan

Migration 029 adds indexes only. Deploy backend then frontend.

## Open Questions

None blocking.
