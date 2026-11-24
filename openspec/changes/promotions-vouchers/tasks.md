# Tasks

## 1. Database migration

- [x] 1.1 Write `backend/prisma/migrations/026_promotions_vouchers.sql` (D1): promotions, targets, stores, customer groups, voucher campaigns, campaign stores, vouchers, redemptions, `sales_order_discounts`, new order and line columns, permissions and grants; verify with `\d` and check constraints
- [x] 1.2 Rollback; up/down/up on the test database, apply to dev, `prisma db pull && generate` (remove the `license_plate` artefact), build

## 2. Engine

- [x] 2.1 Pure `PromotionEngine` (D3–D4) with unit tests for every promotion scenario: category percent, order minimum, buy 2 get 1 with 3/5/6 units, bundle with spread, one line promotion per line, non-combinable choice, max discount cap, conditions (days, time window, walk-in vs group)
- [x] 2.2 Pure voucher valuation and validation reasons (D5) with unit tests

## 3. Posting

- [x] 3.1 Load eligible promotions and vouchers in `PriceResolverService`; extend `computeTotals` to the D2 order and return the breakdown; verify the full-stack scenario (664,000)
- [x] 3.2 Store `sales_order_discounts`, line `promotion_discount`, order amounts and voucher code; voucher redemption with row lock in the posting transaction; release on cancel (D5, D6); verify concurrent single-use, release, and that totals without promotions are unchanged (all existing suites pass)
- [x] 3.3 `voucher_code` and `expected_total` on POS checkout and `POST /sales`, `TOTAL_CHANGED` (D8); verify a promotion ending mid-sale
- [x] 3.4 Reports subtract promotion and voucher discounts; sales summary shows them (D6); verify with a report test
- [x] 3.5 Returns: shares include promotion and voucher amounts; buy-X-get-Y and bundle claw-back (D7); verify the broken buy-2-get-1 scenario

## 4. API

- [x] 4.1 `POST /pricing/cart`, `GET /vouchers/check` (D8); verify breakdown and rejection reasons
- [x] 4.2 Promotions CRUD with targets, usage; voucher campaigns CRUD, code generation (single/batch), codes list, CSV export, usage; policies; verify with integration and grant tests

## 5. Frontend

- [ ] 5.1 API clients `lib/api/promotions.ts`, `lib/api/vouchers.ts`
- [ ] 5.2 `/inventory/promotions`: list with status and usage, form Sheet per type with target pickers, activate/deactivate, delete
- [ ] 5.3 `/inventory/vouchers`: campaigns list and form, campaign detail with codes, generate, export
- [ ] 5.4 POS: cart totals from `/pricing/cart`, applied promotions per line and order, voucher field with reason, `voucher_code` + `expected_total` at checkout, `TOTAL_CHANGED` handling
- [ ] 5.5 Sales-order form: same breakdown and voucher field
- [ ] 5.6 Navigation gated by `promotions:read` / `vouchers:read`

## 6. Checks

- [ ] 6.1 All suites, both builds, lint on new files
- [ ] 6.2 `docs/pricing/PROMOTIONS_VOUCHERS.md` (types, combination rule, discount order with the worked example, voucher limits, returns)
