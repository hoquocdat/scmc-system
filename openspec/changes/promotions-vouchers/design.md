# Design

## Context

`SalesPostingService.computeTotals` prices every order (POS checkout, back-office create, exchanges): price from `PriceResolverService` (base price + price books), manual per-unit line discount and tax, manual order discount (fixed or percent, POS percent above the role limit needs an approval token), loyalty redemption on what is left, then shipping. `sales_orders` stores `discount_amount` (manual order discount) and `loyalty_discount_amount`; lines store per-unit `discount_amount`. Sales reports subtract exactly those fields. Returns (`allocateOrderReductions`) share order-level reductions over lines. The POS cart computes its totals locally from quoted unit prices.

## Goals / Non-Goals

**Goals:** automatic promotions (line discount, order discount, buy X get Y, bundle) with conditions; voucher campaigns and codes with limits; one fixed discount order shared by POS, back office, exchanges and returns; every applied discount stored per order and line; management screens with usage figures; POS and sales-order screens show the server's breakdown.

**Non-Goals:** sending vouchers, e-commerce promotions, gift cards, promotion budgets.

## Decisions

### D1. Data model (migration 026)

- `promotions`: `code` unique, `name`, `type` (`line_discount` | `order_discount` | `buy_x_get_y` | `bundle`), `is_active`, `priority`, `start_at`/`end_at`, `days_of_week` smallint[] (0 = Sunday; null = every day), `time_from`/`time_to` (Vietnam time; null = all day), `all_stores` + `promotion_stores`, `all_customers` + `promotion_customer_groups`, `channels` text[] (null = all), `combinable` bool, `discount_kind` (`percent` | `amount` | `fixed_price`), `discount_value`, `max_discount`, `min_order_amount`, `buy_quantity`, `get_quantity`, `get_discount_percent` (100 = free), `bundle_price`, `notes`, audit columns.
- `promotion_targets`: `promotion_id`, `role` (`target` | `buy` | `get` | `bundle`), `target_type` (`product` | `variant` | `category` | `brand`; bundles: product or variant), `target_id`, `quantity` (bundle component quantity).
- `voucher_campaigns`: `code` unique, `name`, `discount_kind` (`percent` | `amount`), `discount_value`, `max_discount`, `min_order_amount`, `start_at`/`end_at`, `all_stores` + `voucher_campaign_stores`, `channels`, `uses_per_code` (default 1), `uses_per_customer` (null = unlimited), `combinable_with_promotions` (default true), `is_active`, `notes`, audit columns.
- `vouchers`: `campaign_id`, `code` unique (upper case), `is_active`, `used_count`, `created_at`.
- `voucher_redemptions`: `voucher_id`, `campaign_id`, `sales_order_id`, `customer_id`, `amount`, `status` (`applied` | `released`), `released_at`; unique (`voucher_id`, `sales_order_id`).
- `sales_order_discounts`: `sales_order_id`, `sales_order_item_id` (null for order-level), `source_type` (`promotion` | `voucher`), `promotion_id`, `voucher_id`, `amount`, `description`.
- `sales_order_items.promotion_discount` (line total, default 0); `sales_orders.promotion_discount_amount` (order-level promotions), `voucher_discount_amount`, `voucher_code`.
- Permissions `promotions:read|create|update|delete`, `vouchers:read|create|update|delete`. Grants: manager, superadmin all; store_manager, finance, sales, sales_associate read.

### D2. The discount order (extends `pricing/price-resolution`)

1. Unit price (base price, price books).
2. Manual line discount (per unit).
3. Line promotions (`line_discount`, `buy_x_get_y`, `bundle`) on the line value after step 2.
4. Order promotion (`order_discount`) on the amount after step 3.
5. Manual order discount (a percent applies to the amount after step 4).
6. Voucher on the amount after step 5.
7. Loyalty redemption on the amount after step 6 (as today).
8. Tax, shipping.

All amounts are whole đồng. `computeTotals` returns every step, the applied promotions (with per-line amounts) and the voucher.

### D3. Which promotions apply

Eligible: active, inside dates, day of week and time window (Vietnam time), branch, customer group (walk-in: only "all customers"), channel.

- **Line promotions**: each candidate is evaluated alone on the cart; they are applied best-first (largest discount, then priority, then code) and a line can carry **one** line promotion — a candidate touching a line already taken is skipped.
- **Order promotion**: the best one whose minimum order is met on the amount after line promotions.
- **Combination**: if the order promotion or any applied line promotion is not `combinable`, only the better side is kept: the line promotions together, or the order promotion alone (re-evaluated on the amount without line promotions).
- **Vouchers**: a campaign with `combinable_with_promotions = false` is refused when a promotion applies, with that reason.

### D4. Promotion arithmetic

- **line_discount**: lines matching the targets (product, variant, category, brand). Percent: `round(line × p / 100)`; amount: per unit × quantity; fixed price: `(unit − manual discount − fixed) × quantity` when positive. `max_discount` caps the promotion's total (spread over its lines by largest remainder).
- **buy_x_get_y**: buy set B, get set G. When B and G are the same set, groups of x + y units give y rewards; otherwise rewards = `min(floor(units in B / x) × y, units in G)`. Rewards go to the cheapest G units, at `get_discount_percent`.
- **bundle**: components with quantities and a bundle price; `k = min(floor(qty / required))` bundles; discount `k × (Σ component unit price × required − bundle_price)` spread over the component lines by value.
- **order_discount**: needs `min_order_amount`; percent (capped by `max_discount`) or amount (≤ the amount).

A pure `PromotionEngine` (`evaluatePromotions(lines, promotions, context)`) implements D3–D4 and is unit-tested.

### D5. Vouchers

Validation (each failure has its own reason): code exists and is active; campaign active and in dates; branch and channel; minimum order (on the amount after step 5); uses per code; uses per customer (needs a customer when limited); combinable with the applied promotions. Value: percent of the base capped by `max_discount`, or the fixed amount, never more than the base. One voucher per order.

Redemption happens in the posting transaction: the voucher row is locked (`FOR UPDATE`), the limits are re-checked, a redemption is inserted and `used_count` incremented. Cancelling an order releases it (`status = released`, `used_count − 1`). Returns do not restore usage.

### D6. Storage and reports

On posting, `sales_order_discounts` rows are written (one per promotion per line, one for an order promotion, one for the voucher), `sales_order_items.promotion_discount` and `total_amount` include the line promotions, and the order stores `promotion_discount_amount`, `voucher_discount_amount`, `voucher_code`. Sales reports subtract the new amounts wherever they subtract discounts today, and the sales summary shows promotion and voucher discounts as their own figures.

### D7. Returns

`allocateOrderReductions` also shares `promotion_discount_amount + voucher_discount_amount`, and a line's value already excludes its `promotion_discount`. For `buy_x_get_y` and `bundle`, a return re-evaluates those promotions on the units the customer keeps; the discount the kept units no longer qualify for is taken off the refund (never below zero). Example: buy 2 get 1 free on 50,000 stickers, 3 sold for 100,000, one paid sticker returned → refund 0 (the kept 2 stickers no longer earn a free one: they cost 100,000).

### D8. Screens and APIs

- `POST /pricing/cart`: the full D2 breakdown for a cart (lines with manual discounts, order discount, voucher code, points, customer, branch, channel), applied promotions per line, and the voucher's value or rejection reason. The POS cart and the sales-order form use it for every total they show.
- POS checkout and `POST /sales` accept `voucher_code` and `expected_total`; a differing total is refused with `TOTAL_CHANGED` and the new breakdown, so a promotion starting mid-sale never silently changes what is charged.
- `/promotions` CRUD with targets and usage (orders, total discount); `/voucher-campaigns` CRUD, `POST /voucher-campaigns/:id/codes` (single code or a batch of N with a prefix), codes list with usage, CSV export of codes; `GET /vouchers/check?code=` for staff.
- Frontend: `/inventory/promotions` (list, form Sheet per type with target pickers, activate/deactivate, usage), `/inventory/vouchers` (campaigns, detail with codes, generate, export); POS cart shows applied promotions and a voucher field; the sales-order form likewise.

## Risks / Trade-offs

- **Greedy line selection** is not always the global optimum; it is deterministic and explainable ("each item gets its best promotion").
- **Order-level min-order on returns** is not re-evaluated (the order promotion is shared proportionally); only buy-X-get-Y and bundles claw back.
- **Concurrent voucher use** → row lock and re-check in the posting transaction.

## Migration Plan

Apply 026 (new tables and zero-default columns). Deploy backend, then frontend. With no promotions or vouchers, totals are unchanged. Rollback drops the new objects.

## Open Questions

None blocking.
