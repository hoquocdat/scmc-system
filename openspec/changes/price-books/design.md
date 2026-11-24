# Design

## Context

Pricing today is one pure rule in `backend/src/sales/pricing/price-resolver.ts` (`resolvePrice`): a variant's `retail_price_override`, else the product's `sale_price` inside its date window or `retail_price`, plus the variant's `price_adjustment`. `PriceResolverService.resolveMany` loads products and variants and is used by `SalesPostingService.computeTotals`, which both POS checkout and back-office orders go through. POS sends `expected_unit_price` per line and the server rejects a mismatch with `PRICE_CHANGED`. The POS cart computes its displayed price with `displayPrice` in `frontend/src/hooks/usePosCarts.ts`, a copy of the server rule. `SalesService.addItem` (editing an existing back-office order) still takes the unit price from the request.

Customers have no grouping other than loyalty tiers. There is no per-branch or per-customer price.

## Goals / Non-Goals

**Goals:** price books with conditions (branch, customer group, dates) and priority; one resolution rule for POS and back office; the price book recorded on each order line; staff can see and, with permission, choose the price book; management with bulk add and xlsx import/export; customer groups.

**Non-Goals:** promotions/vouchers (next change), purchase price lists, multi-currency, price history beyond the order lines.

## Decisions

### D1. Data model (migration 024)

- `customer_groups` (`code` unique, `name`, `description`, `is_active`) and `customer_group_members` (PK `customer_id, group_id`). A customer can be in several groups.
- `price_books`: `code` unique, `name`, `priority` int (higher wins), `is_active`, `start_at`/`end_at` (nullable timestamptz), `all_stores` bool, `all_customers` bool, `allow_manual` bool (staff may pick it at the counter), `notes`, audit columns.
- `price_book_stores` (PK `price_book_id, store_id`) and `price_book_customer_groups` (PK `price_book_id, group_id`). When `all_stores`/`all_customers` is false, the book applies only to the listed branches/groups; `all_customers = false` with no groups never applies automatically.
- `price_book_entries`: `price_book_id`, `product_id`, `product_variant_id` nullable, `mode` (`fixed` | `percent_off` | `amount_off`), `value` numeric(12,2) ≥ 0 (percent ≤ 100). Unique per book and item: partial unique indexes for `variant IS NULL` and `IS NOT NULL`.
- `sales_order_items.price_book_id` (nullable FK, `ON DELETE SET NULL`), `base_unit_price` numeric(12,2) (price before the book) and `price_source` varchar(30).
- Permissions `price_books:read|create|update|delete|apply` and `customer_groups:read|create|update|delete`. Grants: manager, superadmin all; finance `price_books:read`, `customer_groups:read`; store_manager `price_books:read|apply`, `customer_groups:read|create|update`; sales_associate (and `sales`) `price_books:read`, `customer_groups:read`.

### D2. The base price stays the "default price book"

The current rule (variant override, product sale price window, retail, variant adjustment) becomes the **base price**. It is not migrated into a system price book: `sale_price` keeps working as today and `promotions-vouchers` will absorb it. Every book's relative entries apply to this base.

### D3. Resolution rule (pure function + service)

`resolveLinePrice(base, books, item, ctx)`:

1. Candidate books: active, `start_at ≤ at ≤ end_at` (nulls open), branch condition met, customer condition met (customer in one of the listed groups, or `all_customers`), and having an entry for the item.
2. An entry for the exact variant wins over the product-level entry of the same book. A product-level entry applies to all variants: `fixed` gives the same price for every variant, relative modes apply to each variant's base.
3. Highest `priority` wins; ties broken by later `start_at`, then `code` (deterministic).
4. `fixed` → value; `percent_off` → `round(base × (100 − value) / 100)`; `amount_off` → `max(0, base − value)`. Prices are whole đồng.
5. No candidate → base price, `price_book_id = null`.

A price book replaces the base price even when higher (a planned price increase is a valid use).

**Manual choice:** a request may name `price_book_id`. The book must be active, inside its dates, allow manual selection and be valid for the branch; the customer-group condition is waived (staff use it to give wholesale prices to a walk-in partner). Items without an entry in the chosen book get the base price — never another book — so the outcome is predictable. Choosing requires `price_books:apply`; without it the request is refused (403).

`PriceResolverService.resolveMany(requests, { at, storeId, customerId, priceBookId }, tx)` keeps its signature shape, returning `ResolvedPrice` extended with `basePrice`, `priceBookId`, `priceBookName`, and `source: 'price_book'` when a book applied. Existing callers that pass only `at` keep base behaviour.

### D4. Where it is used

- `SalesPostingService.computeTotals` passes the draft's store, customer and `price_book_id`; lines store `price_book_id`, `base_unit_price`, `price_source`. `PRICE_CHANGED` compares against the resolved price, so a book that starts or ends mid-sale is caught.
- POS checkout DTO and back-office create DTO gain optional `price_book_id`; the permission check is done where the actor is known (`PosCheckoutService`, `SalesController`/`SalesService`).
- `SalesService.addItem` resolves the price with the order's store and customer (and the book recorded on its other lines when one was chosen) instead of trusting the request.
- `sales_orders.price_book_id` records the manually chosen book (null = automatic) so later edits and returns use it.

### D5. Quote API for the screens

`POST /pricing/quote` `{store_id, customer_id?, price_book_id?, items: [{product_id, product_variant_id?}]}` → per item `unit_price`, `base_price`, `price_book_id`, `price_book_name`. `GET /pricing/applicable-books?store_id&customer_id` → books that apply automatically and the ones the user may choose. Both guarded by `price_books:read`. The POS cart and the sales-order form call the quote with TanStack Query whenever lines, customer, branch or chosen book change and show the price source per line; `displayPrice` remains only as an instant placeholder before the quote returns. Checkout still sends `expected_unit_price` from the quote.

### D6. Management

- `/products/price-books`: list (name, priority, dates, conditions, entry count, active), create/edit Sheet with conditions.
- `/products/price-books/:id`: entries table (product, SKU, variant, base price, mode, value, resulting price) with search and paging; inline edit; remove; "Add products" Sheet that adds selected products or a whole category/brand with one rule; xlsx export and import.
- Import: xlsx with columns `SKU`, `Variant SKU` (optional), `Mode` (`fixed|percent_off|amount_off`, Vietnamese labels accepted), `Value`. Upserts by item; returns counts and row errors; nothing is written if any row is invalid. Uses `exceljs` (already a dependency).
- Customer groups: `/customers/groups` page (list, create, edit, members count) and a group multi-select on the customer edit sheet; `GET /customers?groupId=` filter.

### D7. Performance

Resolution loads candidate books for the branch/customer once per request (books, conditions and the entries for the requested items only), so a 30-line cart is 3–4 queries. Index `price_book_entries(product_id)` and `(product_variant_id)`.

## Risks / Trade-offs

- **POS and server disagree** while a quote is in flight → checkout's `PRICE_CHANGED` path already re-prices the cart.
- **Two books with equal priority** → deterministic tie-break, and the list page warns when two active books share a priority.
- **Sale price plus price book** → books apply to the base, which may already be a sale price. Documented; promotions will clarify.
- **Large imports** → limited to 5,000 rows per file.

## Migration Plan

Apply 024 (no data change for existing orders; new columns null). Deploy backend then frontend. With no price books defined, every price is unchanged. Rollback script drops the new tables and columns.

## Open Questions

None blocking; per-line manual book choice can come later if needed.
