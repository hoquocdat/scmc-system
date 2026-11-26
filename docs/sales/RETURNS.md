# Trả hàng và đổi hàng (Sales returns)

Partial and full returns, exchanges and customer credit. Spec: `openspec/specs/sales/returns`
(change `sales-returns`). Migration: `backend/prisma/migrations/025_sales_returns.sql` (rollback in
`rollback/025_sales_returns.sql`).

## Where

- **POS**: "Trả hàng (F7)" in the top bar. Type or scan the order number from the receipt.
- **Đơn hàng → order detail**: "Trả hàng" button; the order shows its returns and returned quantities.
- **Bán Hàng → Trả Hàng** (`/sales/returns`): every return with filters, totals and Excel/CSV export.
- **Customer → Tiền Trả Hàng**: the customer's credit balance and its history.

## Rules

| Rule | Detail |
| --- | --- |
| What can be returned | Lines of a confirmed, processing, ready or completed order, up to the sold quantity minus earlier returns. Cancelled and e-commerce orders cannot. Two returns of the same order at the same moment are serialised. |
| Refund value | What the customer paid for those units: price − line discount + tax − the line's share of the order discount and loyalty discount (shared by line value). The last remaining units get the line's remainder, so rounding never refunds more than was paid. Shipping is not refunded. |
| Unpaid orders | The refund first reduces the order's open receivable; only money actually collected is paid back. |
| Refund methods | Cash, card, bank transfer, MoMo, ZaloPay, VNPay (a "Trả hàng" payment in the cash book, on the chosen account or the branch mapping; cash at the POS comes out of the cashier's drawer and lowers the shift's expected cash) or **Giữ cho khách** (customer credit; needs a customer). Several methods can be combined; they must add up to the refund. |
| Stock | "Bán lại được" puts the units back into the order's location at their original cost. "Hàng hỏng" records the movement (`RETURN_DAMAGED`) without changing stock. |
| Loyalty | Points earned on the order are taken back, and points redeemed are given back, in proportion to the returned value; the last return of an order settles the remainder exactly. The balance may go negative if the customer already spent the earned points. |
| Exchange | The returned value pays for the replacement items first (an "exchange" payment, not in the cash book). The customer pays any difference with a normal method; if the replacement costs less, the rest is refunded. Replacement prices come from the normal price rule (price books apply). |
| Approval | A return above **2,000,000 đ** or more than **30 days** after the sale needs `sales_returns:approve` (store managers, managers). Sales staff see "Cần quản lý duyệt"; the approver performs the return and is recorded. Settings: `RETURN_APPROVAL_LIMIT`, `RETURN_WINDOW_DAYS` in the backend environment. |
| Numbering and audit | `TH-YYMM-#####`, never reused; every return is in the activity log. Returns cannot be cancelled: a mistaken return is corrected with a new sale. |

## Examples

| Situation | Result |
| --- | --- |
| Jeans 1,000,000 + exhaust 2,500,000 with a 350,000 order discount; jeans returned | Refund 900,000 |
| 3 stickers that cost 100,000 after discounts, returned one at a time | 33,333 · 33,333 · 33,334 |
| Order 2,000,000 on credit, 500,000 paid; one 1,000,000 item returned | Receivable 1,500,000 → 500,000, nothing paid back |
| Refund 300,000 kept as credit; later purchase 500,000 paid 300,000 by credit + 200,000 cash | Credit 300,000 → 0; only 200,000 reaches the cash book |
| Jeans 1,000,000 exchanged for an exhaust 2,500,000 | New order paid 1,000,000 by exchange + 1,500,000 by the customer |

## Store credit at checkout

In the POS payment sheet, "Tiền trả hàng (số dư)" appears when the selected customer has credit
and cannot exceed the balance. Back-office payments accept `store_credit` too. Credit payments post
no cash book entry.

## Permissions

| Permission | Granted to |
| --- | --- |
| `sales_returns:read` | manager, superadmin, store_manager, finance, sales, sales_associate |
| `sales_returns:create` | manager, superadmin, store_manager, sales, sales_associate |
| `sales_returns:approve` | manager, superadmin, store_manager |

## API

`GET /sales-returns/lookup?code=`, `POST /sales-returns/preview`, `POST /sales-returns`,
`GET /sales-returns` (period, branch, customer, order, kind, search; `format=xlsx|csv`),
`GET /sales-returns/:id`, `GET /customers/:id/credit`. Checkout and back-office payments accept the
`store_credit` method.

## Reports

Sales reports still show orders at their sold value. Returns are listed under `sales.returns`
(export key) and in the cash book under "Trả hàng"; `reports-retail-suite` will net them out of
revenue and profit.
