# Proposal

## Why

SCMC runs promotions (seasonal sales, bundle offers, partner deals) and wants to hand out voucher codes, but the system only supports discounts typed in by hand on a line or an order. Manual discounts are applied inconsistently, cannot be limited by date, branch or customer, and cannot be measured afterwards. Promotions and vouchers need to be rules the system applies, in a fixed order with price books and loyalty, so the total is the same in POS and sales orders and every discount can be traced to its source.

## What Changes

- Promotions applied automatically when their conditions are met:
  - percentage or fixed discount on products, categories or brands;
  - order-level discount above a minimum order value;
  - buy X get Y (free or discounted);
  - bundle price for a set of items.
- Promotion conditions: date/time window, days of week, branch, customer group, channel, and whether it can be combined with other promotions.
- Vouchers: codes created singly or in batches, tied to a voucher campaign with value (percentage with cap, or fixed), minimum order, validity, usage limit per code and per customer, and branch/channel limits.
- Voucher redemption at POS and on sales orders, with validation and a clear reason when a code is rejected. Usage is recorded with the order and released if the order is cancelled.
- A defined discount order, extending `pricing/price-resolution`: price book price, then line discount, then promotions, then order discount, then voucher, then loyalty redemption.
- Every applied promotion and voucher is stored on the order (and line where relevant) with its discount amount, for reporting and for reversing on returns.
- Promotion and voucher management UI (list, form, activate/deactivate, usage statistics).

## Capabilities

### New Capabilities
- `pricing/promotions`: Promotion types, conditions, combination rules, and automatic application.
- `pricing/vouchers`: Voucher campaigns, codes, limits, redemption and release.

### Modified Capabilities
- `pricing/price-resolution` (introduced by `price-books`): adds promotion, voucher and loyalty steps and their fixed order.

## Impact

- **Backend**: new `src/promotions` and `src/vouchers` modules; the pricing service in `src/price-books` becomes the full price stack; `src/sales` and `src/pos` store applied discounts; `src/loyalty` redemption moves to the end of the stack.
- **Database**: raw SQL migration for promotions, promotion conditions and targets, voucher campaigns, codes, redemptions, and applied-discount records on orders and lines.
- **Frontend**: promotion and voucher pages; POS cart shows applied promotions and a voucher input; sales-order form likewise.
- **Depends on**: `pos-checkout-core`, `price-books`. **Feeds**: `sales-returns` (re-evaluating promotions), `reports-retail-suite` (promotion performance).

## Out of Scope

- Sending vouchers to customers by SMS, email or Zalo.
- Promotions on e-commerce channels.
- Gift cards or stored-value cards.
