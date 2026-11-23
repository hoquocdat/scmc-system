# Proposal

## Why

Today a product has one `retail_price` plus a single time-boxed `sale_price`, and variants can override them. SCMC needs different prices for different situations: wholesale or partner workshops, VIP customers, one branch versus another, and planned price changes. Staff currently do this with manual line discounts, which is slow, inconsistent and invisible in reports. Price books (bảng giá) solve this, and they need one shared price-resolution rule so POS and sales orders always charge the same price.

## What Changes

- Price books: named price lists with a priority, an active date range, and conditions on branch (store) and customer group. A default price book is the product's own retail price.
- Price book entries per product or variant: a fixed price, or a rule relative to the base price (for example retail minus 10%).
- Customer groups (new): customers can belong to groups (for example Wholesale, VIP, Partner workshop) that price books target.
- A single price-resolution service used by both POS and the sales-order form: given product/variant, branch, customer and date, it returns the unit price and which price book supplied it.
- The chosen price book is stored on each order line so reports and returns know which price was charged.
- Staff can see which price book applies and, with permission, choose a different applicable price book for a sale.
- Price book management UI with bulk editing and import/export (xlsx) of entries.
- Existing `sale_price`/date fields stay readable during the transition; design decides whether they become a system price book.

## Capabilities

### New Capabilities
- `pricing/price-books`: Price books, entries, conditions (branch, customer group, date), priority, and management.
- `pricing/price-resolution`: The single rule that determines a line's unit price from base price and applicable price books; later extended by promotions and vouchers.
- `customers/customer-groups`: Grouping customers so pricing and promotions can target them.

### Modified Capabilities
<!-- None in openspec/specs yet. `pos/checkout` (from pos-checkout-core) starts using price resolution; that is captured as a requirement of `pricing/price-resolution`. -->

## Impact

- **Backend**: new `src/price-books` module; `src/customers` (groups); `src/sales` and `src/pos` call price resolution instead of reading `retail_price` directly.
- **Database**: raw SQL migration for price books, entries, customer groups and membership; `price_book_id` on `sales_order_items`.
- **Frontend**: price book pages; customer group field on customer forms; price source shown in POS cart and sales-order form.
- **Dependencies**: xlsx library for import/export (shared choice with `reports-fix-and-migrate`, which proposes `exceljs`).
- **Depends on**: `pos-checkout-core`. **Feeds**: `promotions-vouchers`, `sales-returns`.

## Out of Scope

- Promotions, discounts by rule, and vouchers (see `promotions-vouchers`).
- Supplier/purchase price lists.
- Multi-currency.
