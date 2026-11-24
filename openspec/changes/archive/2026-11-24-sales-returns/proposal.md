# Proposal

## Why

The only way to undo a sale today is to cancel the whole order, which puts all stock back and reverses all loyalty points. A store cannot run like that: customers return one item out of three, swap a size of jeans, or bring back a part that did not fit. SCMC needs partial returns and exchanges that put the right stock back, refund the right amount the right way, and correct loyalty points, receivables and applied discounts.

## What Changes

- Sales returns linked to an original order: choose lines and quantities to return, up to what was sold minus what was already returned, with a reason per line.
- Refund amount calculated from what the customer actually paid for those items, including their share of order-level discounts, promotions, vouchers and loyalty redemption.
- Refund options: cash or another method (written to the cash book), reduce the customer's outstanding receivable when the order is not fully paid, or keep as customer credit.
- Restocking: returned items go back to a chosen location, or are recorded as damaged and not resellable.
- Loyalty: points earned on the returned part are reversed proportionally; redeemed points are handled by a rule chosen in design.
- Promotions and vouchers: if a return breaks a promotion's condition (for example buy 2 get 1), the refund is adjusted; voucher usage is not restored on a partial return.
- Exchanges: one transaction that returns items and sells replacements, with the customer paying or being refunded the difference.
- Returns at POS (from a receipt barcode or order search) and from the sales-order detail page.
- Return documents have their own number, are recorded in the activity log, and refunds above a set amount need manager permission.

## Capabilities

### New Capabilities
- `sales/returns`: Partial and full returns, refund calculation, refund methods, restocking, loyalty and discount reversal, and exchanges.

### Modified Capabilities
<!-- None in openspec/specs yet. Effects on cash book, loyalty and receivables are captured as requirements of `sales/returns`. -->

## Impact

- **Backend**: new `src/sales-returns` module; uses `src/inventory` (RETURN transactions), `src/loyalty` (proportional reversal), `src/customers` receivables, `src/cash-book` (refund entries), applied-discount data from `promotions-vouchers`.
- **Database**: raw SQL migration for returns, return lines, refund records and customer credit.
- **Frontend**: return flow in POS and on `SalesOrderDetailPage`; returns list page; return receipt.
- **Depends on**: `pos-checkout-core`, `cash-book`, `price-books`, `promotions-vouchers`. **Feeds**: `reports-retail-suite` (returns, P&L).

## Out of Scope

- Returns to suppliers (already exists in `supplier-returns`).
- Warranty claims and repairs for returned parts (workshop flow).
- Returns for orders from e-commerce channels.
