# Khuyến mãi và voucher (Promotions and vouchers)

Automatic promotions and voucher codes. Specs: `openspec/specs/pricing/promotions`, `pricing/vouchers`,
`pricing/price-resolution` (change `promotions-vouchers`). Migration:
`backend/prisma/migrations/026_promotions_vouchers.sql` (rollback in `rollback/026_promotions_vouchers.sql`).

## Where

- **Hàng hóa → Khuyến Mãi** (`/inventory/promotions`): list with status, rule, conditions and usage; click to edit.
- **Hàng hóa → Voucher** (`/inventory/vouchers`): campaigns; a campaign page lists its codes, creates
  codes (one or a batch) and exports them to CSV.
- **POS**: the cart shows each promotion on its line and in the summary, and has a voucher field.
- **Sales order form**: a "Khuyến mãi và voucher" card shows the server's breakdown and takes a voucher.

## The discount order

Every sale (POS, back-office order, exchange) is computed in this order:

1. Unit price (normal price, price books)
2. Manual line discount
3. Line promotions
4. Order promotion
5. Manual order discount (a percent applies to what is left after step 4)
6. Voucher
7. Loyalty points
8. Tax and shipping

Worked example: VIP jeans priced 900,000 by the VIP price book, "Jeans −10%" (−90,000), "Giảm 50k" order
promotion (−50,000), a 10% voucher capped at 100,000 (10% of 760,000 = −76,000), 20 points (−20,000)
→ **664,000**.

## Promotion types

| Type | Rule |
| --- | --- |
| Giảm giá hàng hóa | Percent (optional cap), amount per unit, or a fixed price ("đồng giá") on chosen products, variants, categories or brands. |
| Giảm giá đơn hàng | Percent (optional cap) or amount when the order, after line promotions, reaches a minimum. |
| Mua X tặng Y | Buy X of the "buy" items, get Y of the "get" items at a discount (100% = free). With the same items on both sides, every X + Y units give Y; the cheapest units are the rewarded ones. |
| Combo | A set of products with quantities sold at a bundle price; the saving is shared over the bundle lines by value. |

**Conditions**: dates, days of the week, time of day (Vietnam time), branches, customer groups (a walk-in
customer only gets promotions for all customers), channel (POS, đơn tại cửa hàng, xưởng, điện thoại).

**Combining**:
- Each line gets at most one line promotion — the one with the largest discount (then priority, then code).
- At most one order promotion applies — the largest whose minimum is met.
- A promotion marked "không kết hợp" cannot be combined across levels: the system keeps whichever is
  better for the customer, the line promotions together or the order promotion alone.

## Vouchers

A campaign sets the value (percent with an optional cap, or an amount), minimum order, validity, branches,
channels, uses per code (default 1), uses per customer, and whether it may be used with promotions.
Codes are unique and case-insensitive; random codes avoid look-alike characters (0/O, 1/I/L).

A code is refused with a reason: inactive, not yet valid, expired, wrong branch or channel, used up,
customer limit reached (needs a customer), not combinable with the promotions in the cart, or below the
minimum ("Đơn tối thiểu …"). One voucher per order. The use is counted in the same transaction as the
sale — two counters cannot both use a single-use code — and is given back if the order is cancelled.
Returns do not give it back.

## Checkout safety

The POS and the order form send the total they showed (`expected_total`). If a promotion starts or ends,
or a voucher is used up, between showing and paying, the sale is refused with `TOTAL_CHANGED` (or
`VOUCHER_REJECTED`) and the cart shows the new figures. No sale is ever charged a different amount than
the screen showed.

## Returns

Refunds already exclude promotion discounts on the line and share order promotions and vouchers by value.
If a return breaks a "mua X tặng Y" or combo for the items the customer keeps, the discount they no longer
qualify for comes off the refund (never below zero). Example: 3 stickers for 100,000 with "mua 2 tặng 1";
one is returned → refund 0; the other two later → 100,000.

## Reports

Sales reports subtract promotion and voucher discounts from net sales; the sales summary shows them as
"promotionDiscounts" and "voucherDiscounts". Each promotion's and campaign's usage (orders, total
discount) is on its page.

## Permissions

| Permission | Granted to |
| --- | --- |
| `promotions:read`, `vouchers:read` | manager, superadmin, store_manager, finance, sales, sales_associate |
| `promotions:create/update/delete`, `vouchers:create/update/delete` | manager, superadmin |

A promotion or campaign already used by orders cannot be deleted; deactivate it instead.

## Not covered

- Editing the items of an existing back-office order (add/remove item) recalculates totals without
  re-running promotions; promotions are applied when the order is created.
- Order-level minimums are not re-checked on returns (the order promotion is shared proportionally).
- Sending vouchers to customers, e-commerce promotions, gift cards.
