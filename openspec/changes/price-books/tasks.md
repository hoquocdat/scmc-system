# Tasks

## 1. Database migration

- [ ] 1.1 Write `backend/prisma/migrations/024_price_books.sql`: customer groups and members, price books with store/group conditions, entries (mode/value checks, partial unique indexes, item indexes), `sales_order_items.price_book_id|base_unit_price|price_source`, `sales_orders.price_book_id`, permissions and grants (D1); verify with `\d` and that a duplicate entry per book and item fails
- [ ] 1.2 Write the rollback script; verify up/down/up on the test database, apply to dev, `npx prisma db pull && npx prisma generate` (remove the `license_plate` `@unique` artefact), `npm run build` succeeds

## 2. Resolution

- [ ] 2.1 Implement the pure rule (D3: candidates, variant-over-product, priority and tie-break, fixed/percent/amount, rounding) with unit tests for every spec scenario of `pricing/price-resolution`
- [ ] 2.2 Extend `PriceResolverService.resolveMany` with `{storeId, customerId, priceBookId}` (manual choice rules, inactive groups ignored), loading only the requested items' entries; verify with integration tests: wholesale customer, priority, branch condition, dates, manual choice with fallback to base, invalid manual book refused
- [ ] 2.3 Use it in `SalesPostingService.computeTotals` and record `price_book_id`, `base_unit_price`, `price_source` on lines and `sales_orders.price_book_id`; make `SalesService.addItem` resolve the price; add `price_book_id` to the POS checkout and back-office create DTOs with the `price_books:apply` check (D4); verify: POS sale and back-office order of a wholesale customer priced from the book, `PRICE_CHANGED` when a book starts mid-cart, sales associate refused a manual book, addItem ignores the request price

## 3. API

- [ ] 3.1 Customer groups CRUD and membership (`PUT /customers/:id/groups`, groups on customer detail, `groupId` filter on the list) with permissions and the delete rule; verify with integration tests
- [ ] 3.2 Price books CRUD with conditions, entries list (with base and resulting price, search, paging), upsert/remove, bulk add by products/category/brand; verify with integration tests including the duplicate-code, end-before-start and percent>100 refusals
- [ ] 3.3 xlsx export and all-or-nothing import with row errors (≤ 5,000 rows); verify the unknown-SKU and round-trip scenarios
- [ ] 3.4 `POST /pricing/quote` and `GET /pricing/applicable-books` (D5); verify the responses for the wholesale customer and walk-in cases

## 4. Frontend

- [ ] 4.1 API clients `lib/api/price-books.ts` and `lib/api/customer-groups.ts`
- [ ] 4.2 `/products/price-books` list with create/edit Sheet (conditions, dates, priority) and same-priority warning; `/products/price-books/:id` entries table with inline edit, remove, add-products Sheet (products, category, brand), import/export; shadcn only, pages < 200 lines
- [ ] 4.3 `/customers/groups` page and group multi-select on the customer edit sheet, group filter on the customer list
- [ ] 4.4 POS: quote-driven cart prices with price source per line, applicable/chosen price book Select gated by `price_books:apply`, `price_book_id` sent at checkout
- [ ] 4.5 Sales-order form: quote-driven prices, price source per line, price book Select gated by permission
- [ ] 4.6 Navigation entries gated by `price_books:read` and `customer_groups:read`

## 5. Checks

- [ ] 5.1 Run backend unit and integration suites, both builds and lint on new files; verify all pass
- [ ] 5.2 Write `docs/pricing/PRICE_BOOKS.md` (concepts, resolution rule with examples, how to set up wholesale and branch prices, import format)
