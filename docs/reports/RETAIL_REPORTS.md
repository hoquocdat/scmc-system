# Báo cáo bán lẻ (retail reports suite)

End of day, shifts, sales, returns, stock, customers, suppliers, promotions and finance reports.
Specs: `openspec/specs/reporting/*` (change `reports-retail-suite`). Migration: `backend/prisma/migrations/029_report_indexes.sql`
(indexes only; rollback in `rollback/029_report_indexes.sql`).

Every report uses the shared query (`from`, `to` as Vietnam calendar days, `storeId`, `interval`, `limit`, `sortBy`,
`productId`, `locationId`, `type`), the same envelope (columns, rows, totals, meta) and exports to xlsx/csv with
`format=xlsx|csv` (needs `reports:export`). In the app: **Báo cáo** → choose a group on the left; **Lọc** opens the
filter sheet; **Xuất** downloads what is on screen.

## Definitions

| Term | Rule |
| --- | --- |
| Revenue orders | Status confirmed, processing, ready or completed; dated by order date (else created). Draft, pending and cancelled orders never count. |
| Gross | Σ unit price × quantity of the order lines. |
| Discounts | Manual line + manual order + promotion (line and order) + voucher + loyalty points. |
| Net sales | Gross − discounts. |
| Returns | Σ goods value of returns **created in the period** (by return date, not the original order date). A day can therefore have negative net after returns. |
| Net after returns | Net sales − returns. |
| COGS | Cost of `SALE` stock movements of revenue orders in the period − cost of **restocked** `RETURN` movements of returns made in the period. Damaged returns stay in COGS. Costs are per base unit (a box of 10 moves 10 units at cost ÷ 10). Movements without a recorded cost use the current product cost. |
| Operating expenses | Posted cash book **payments** whose category is an expense (payroll, rent, utilities, shipping, maintenance, other expense and custom payment categories), net of automatic reversals. Not expenses: supplier payments (purchases become COGS when sold), transfers between accounts, sales-return refunds, shift cash out, count differences. |
| Aging | Days from the document date to the report's last day: 0–30, 31–60, 61–90, over 90. Customers: open `customer_receivables.balance` by order date. Suppliers: approved purchase orders' total − paid by order date. Balances are current, not as of the end date. |
| Base units | Quantities in stock reports (sold, on hand, days of stock) are in base units. |

## Reports

| Group | Report | Endpoint | Permission | Notes |
| --- | --- | --- | --- | --- |
| Cuối ngày | Báo cáo cuối ngày | `/reports/eod/daily` | reports:sales | Per branch: orders, gross, each discount source, net, returns, net after returns, money received by method (cash, card, bank transfer, e-wallets, store credit, exchange), refunds paid, drawer cash in/out other than sales and refunds, new credit sales. Meta: sales by staff. Opens on **Hôm nay**. |
| Cuối ngày | Báo cáo ca | `/reports/eod/shifts` | reports:sales | Per shift: float, cash sales, cash refunds, other cash in/out, expected, counted, over/short (closed shifts use the figures saved at close). |
| Bán hàng | Doanh thu theo giờ | `/reports/sales/by-hour` | reports:sales | Hours 00–23 with orders, net, average order. |
| Bán hàng | Doanh thu theo nhân viên | `/reports/sales/by-staff` | reports:sales | Seller of the order; returns are charged to the seller of the original order. |
| Bán hàng | Theo chi nhánh và kênh | `/reports/sales/by-branch` | reports:sales | Branch × channel with share. |
| Bán hàng | Doanh thu theo thương hiệu | `/reports/sales/by-brand` | reports:sales | Variants use the master product's brand. Net per line = line value less its promotion, plus its share of order-level reductions. |
| Bán hàng | Giảm giá theo nguồn | `/reports/sales/discounts` | reports:sales | Per day/week/month: manual, promotions, vouchers, loyalty, total and rate on gross. |
| Bán hàng | Hàng bán chậm | `/reports/sales/slow-movers` | reports:sales | Items in stock ordered by least sold, then highest stock value; last sale date. |
| Bán hàng | Trả hàng theo sản phẩm | `/reports/returns/by-product` | reports:sales | Quantity, restocked, damaged, value and return rate (returned ÷ sold in the period). |
| Bán hàng | Trả hàng theo lý do | `/reports/returns/reasons` | reports:sales | By reason (most returns first); **Nhóm theo → Nhân viên** (`type=staff`) groups by who processed them. |
| Tồn kho | Thẻ kho | `/reports/inventory/stock-card` | reports:inventory | Needs a product (filter sheet product picker). Opening balance, each movement with its document number, running balance, closing balance. Damaged returns and transfer losses are listed under "Ghi nhận" without changing the balance. |
| Tồn kho | Hàng đang chuyển | `/reports/inventory/in-transit` | reports:inventory | Transfers shipped and not fully received: quantity and value still on the road, days since shipping. |
| Tồn kho | Chênh lệch kiểm kho | `/reports/inventory/count-variances` | reports:inventory | Lines with a difference from counts completed in the period; shortage and surplus value. |
| Tồn kho | Số ngày tồn kho | `/reports/inventory/days-of-stock` | reports:inventory | On hand ÷ (sold ÷ days in the period). **Xem → Hàng không bán được** (`type=dead`): in stock, nothing sold in the period, by stock value. |
| Khách hàng | Khách hàng mua nhiều | `/reports/customers/top` | reports:sales | By net after returns, or by orders (`sortBy=orders`); tier, points, amount owed. |
| Khách hàng | Tuổi nợ khách hàng | `/reports/customers/receivables-aging` | reports:financial | Shown to manager and finance only. |
| Khách hàng | Tích điểm | `/reports/customers/loyalty` | reports:sales | Per tier: members, active, points earned/redeemed/reversed in the period, value redeemed, balance and its value at the current redemption rate (the outstanding liability). |
| Nhà cung cấp | Nhập hàng theo nhà cung cấp | `/reports/suppliers/purchases` | reports:financial | Approved purchase orders in the period, received value, supplier returns, payments in the period, owed now. |
| Nhà cung cấp | Tuổi nợ nhà cung cấp | `/reports/suppliers/payables-aging` | reports:financial | |
| Khuyến mãi | Hiệu quả khuyến mãi | `/reports/promotions/performance` | reports:sales | Per promotion and voucher campaign: orders, discount, net sales of those orders, average order vs. all orders, discount ÷ gross. An order with a promotion and a voucher counts in both rows. |
| Tài chính | Số dư quỹ | `/reports/financial/cash-balances` | reports:financial | Per cash book account: opening, in, out, closing (posted entries). |
| Tài chính | Kết quả kinh doanh | `/reports/financial/pnl` | reports:financial | Rows: retail gross, discounts, returns, net revenue (retail; workshop = delivered service orders), COGS / parts used on delivered orders, gross profit, each expense category, operating expenses, net profit. Columns retail, workshop, combined; expenses are not split by business line. |

The earlier reports (sales summary, trends, categories, payment methods, top products, valuation, movement, low stock,
turnover, revenue, gross profit, VAT, workshop) are unchanged.

## Notes

- Branch filter: sales figures use the order's branch; stock figures use the branch's warehouse
  (`stores.default_warehouse_id`); cash figures use the account's branch.
- Ranked reports return at most `limit` rows on screen; exports return up to 5,000.
- Order and line amounts are `numeric(10,2)`: a single order cannot exceed 99,999,999.99 ₫.
- Figures are checked by `backend/test/integration/retail-suite-reports.int-spec.ts` (one day at the counter, every
  figure by hand) and `retail-suite-scenarios.int-spec.ts` (one test per numbered spec scenario).
