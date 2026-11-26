# Design

## Context

A sale is posted by `SalesPostingService` in one transaction: order and lines (unit price, per-unit line discount and tax, unit cost, price book), `SALE` stock movements at the order's location (`inventory_transactions`; the `update_inventory_from_transaction` trigger moves `inventory.quantity_on_hand` for `RECEIVE|ADJUST|RETURN|TRANSFER_IN` and `SALE|TRANSFER_OUT`, and ignores other types), payments with one cash book receipt each, a receivable for the unpaid balance, loyalty redemption at confirmation and earning on full payment. Order-level reductions are `sales_orders.discount_amount` and `loyalty_discount_amount`. Shipping is a separate amount.

The only undo today is `SalesService.cancel`, which is refused for completed orders (every POS sale), returns all stock and reverses all loyalty points.

`promotions-vouchers` is not built yet. Its applied discounts will be one more order-level or line-level reduction; this design allocates reductions through one function so that change only adds inputs.

## Goals / Non-Goals

**Goals:** partial and full returns of completed/confirmed orders; refund equal to what was actually paid for the returned units; refund to cash book accounts, to the receivable, or to customer credit; restock or record as damaged; proportional loyalty correction; exchanges in one transaction; POS and back office; numbering, activity log, approval above a limit.

**Non-Goals:** cancelling a return (a mistaken return is corrected by a new sale), refunding shipping, supplier returns, warranty, e-commerce orders, returns of workshop service orders.

## Decisions

### D1. Data model (migration 025)

- `sales_returns`: `return_number` unique (`TH-YYMM-#####` from `next_document_number('TH', period)`), `sales_order_id`, `store_id`, `customer_id`, `pos_session_id`, `kind` (`return` | `exchange`), `exchange_order_id` (the replacement order), `goods_amount` (refund value of the returned units), `receivable_reduction`, `refund_amount` (paid back through methods), `points_reversed`, `points_restored`, `reason`, `notes`, `approved_by`, `created_by`, `created_at`.
- `sales_return_items`: `sales_return_id`, `sales_order_item_id`, `product_id`, `product_variant_id`, `quantity` > 0, `unit_refund`, `line_refund`, `unit_cost`, `restock` bool, `location_id` (null when damaged), `reason_code` (`changed_mind` | `wrong_size` | `defective` | `wrong_item` | `other`), `reason_note`.
- `sales_return_refunds`: `sales_return_id`, `method` (`cash` | `card` | `bank_transfer` | `ewallet_*` | `store_credit` | `exchange`), `amount` > 0, `cash_account_id`.
- `customer_credit_transactions`: `customer_id`, `amount` (+ credit given, − credit used), `balance_after`, `source_type` (`sales_return` | `sales_order_payment` | `adjustment`), `source_id`, `created_by`, `created_at`; `customers.credit_balance` numeric default 0 kept in step under a row lock.
- `sales_order_items.returned_quantity` int default 0, `returned_amount` numeric default 0; `sales_orders.returned_amount` numeric default 0 and `return_status` (`none` | `partial` | `full`).
- Cash book system category `sales_return` (out); payment method `store_credit` allowed on sales payments.
- Permissions `sales_returns:read|create|approve`. Grants: read → finance, manager, superadmin, store_manager, sales, sales_associate; create → manager, superadmin, store_manager, sales, sales_associate; approve → manager, superadmin, store_manager.

### D2. What can be returned

Orders with status `confirmed`, `processing`, `ready` or `completed` and channel not `ecommerce`. Per line, returnable = `quantity − returned_quantity`. The order row is locked (`SELECT … FOR UPDATE`) for the whole return so two returns of the same order cannot both pass the check. Returns are allowed for 30 days after the order date by default (`RETURN_WINDOW_DAYS`); after that only with `sales_returns:approve`.

### D3. Refund value (allocation)

For each order line: `line_net = (unit_price − discount_amount + tax_amount) × quantity`. Order-level reductions (`discount_amount + loyalty_discount_amount`, later promotion and voucher amounts) are split over lines in proportion to `line_net` with the largest-remainder method so the shares add up exactly. `line_paid_value = line_net − line_share`.

Returning `k` of the line's remaining `r` units: if `k = r`, the refund is `line_paid_value − returned_amount` (the remainder, so rounding never over-refunds); otherwise `round(line_paid_value × k / quantity)`. `goods_amount` is the sum over returned lines. Shipping is never refunded.

`allocateOrderReductions(order, lines)` is the single function computing `line_paid_value`; `promotions-vouchers` adds its reductions there.

### D4. Where the money goes

1. If the order has an open receivable, `receivable_reduction = min(goods_amount, receivable balance)` is taken off it first (balance and original amount reduced; status `paid` at zero). Money not yet paid is never handed back.
2. The rest, `refund_amount`, must be covered exactly by the requested refund lines: cash-book methods (a payment entry `PC`, category `sales_return`, on the chosen account or the branch mapping, counterparty the customer, `source_type 'sales_return'`; cash from the POS drawer links to the cashier's open shift, so expected cash drops) or `store_credit` (needs a customer; adds to the credit balance, no cash book entry).
3. The refund may not exceed what the order collected minus what earlier returns already refunded (`paid_amount − previous refunds`); the check also blocks refunding an unpaid order in cash.

### D5. Stock

Restocked lines write a `RETURN` movement (+quantity, original `unit_cost`, `reference_type 'sales_return'`) at the chosen location of the order's branch (default: the order's location). A missing stock row is created at 0 first so the trigger can add to it. Damaged lines write `RETURN_DAMAGED` (ignored by the trigger, kept for reports) with no stock change.

### D6. Loyalty

- **Earned points**: reversed in proportion to the returned value: `round(earned × goods_amount / (total_amount − shipping))`, capped so the total reversed never exceeds `loyalty_points_earned`; the last return of an order reverses the remainder.
- **Redeemed points**: restored in the same proportion (the refund already excludes the loyalty discount share, so the customer gets back the points that paid for the returned items), capped the same way.
- Written as `reverse`/`adjust` loyalty transactions referencing the return; the balance may go negative when earned points were already spent (shown on the customer page). Tier is re-evaluated as today.

### D7. Exchanges

One request carries return lines and replacement lines. In one transaction: post the return (D3–D6), then create the replacement order through `SalesPostingService.createOrderIn` (same branch, customer, shift for POS, prices by the price rule) paid first by an `exchange` payment equal to `min(goods_amount after receivable reduction, new total)` (no cash book entry; it is money already held). If the new order costs more, the customer pays the difference with the normal payment lines; if less, the remainder is refunded through refund lines (D4). `sales_returns.exchange_order_id` links both.

### D8. Approval and audit

A return whose `goods_amount` exceeds `RETURN_APPROVAL_LIMIT` (default 2,000,000 đ) or that is outside the window needs `sales_returns:approve` (403 `RETURN_APPROVAL_REQUIRED` otherwise; the store manager performs it). `approved_by` records the approver. Every return writes an activity log entry with order, amounts and lines.

### D9. Store credit at checkout

`store_credit` becomes a payment method at POS checkout and on back-office payments: it needs a customer, cannot exceed the credit balance (checked under a lock on the customer row), writes a −amount credit transaction, and posts no cash book entry. Cash book posting skips the non-money methods `store_credit` and `exchange`.

### D10. API

- `GET /sales-returns/lookup?code=` (order number or id) → order with returnable lines: sold, returned, remaining quantity and refundable value per unit.
- `POST /sales-returns/preview` → computed amounts (goods, receivable reduction, refund due, points) without writing.
- `POST /sales-returns` → return or exchange. `GET /sales-returns` (filters: period, branch, customer, order, kind; report envelope with xlsx/csv export key `sales.returns`), `GET /sales-returns/:id`.
- `GET /customers/:id/credit` → balance and transactions.

### D11. Frontend

- `ReturnSheet` (shared): order lookup, line quantity/reason/restock, exchange items (product search with quoted prices), refund lines with account choice, live preview, confirm, receipt.
- POS: "Trả hàng" button (F7) opens it with the shift's branch; receipt template for returns.
- `SalesOrderDetailPage`: "Trả hàng" button, returned quantities per line, list of returns.
- `/sales/returns`: list with the standard filter Sheet and badges, detail Sheet, export.
- Customer page: credit balance and history; POS payment sheet offers "Tiền trả hàng (số dư)" when the customer has credit.

## Risks / Trade-offs

- **Concurrent returns** → order row lock (D2).
- **Rounding** → remainder on the last unit (D3); tested to never exceed the line's paid value.
- **Negative loyalty balance** → allowed and visible, rather than refusing a legitimate return.
- **Promotions not yet built** → their share is added in `allocateOrderReductions` later; until then the order discount covers every manual discount.

## Migration Plan

Apply 025 (new tables/columns with defaults; no data change). Deploy backend then frontend. Rollback drops the new objects.

## Open Questions

None blocking. Approval limit and window are environment settings until a settings screen exists.
