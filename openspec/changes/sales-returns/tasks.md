# Tasks

## 1. Database migration

- [x] 1.1 Write `backend/prisma/migrations/025_sales_returns.sql`: `sales_returns`, `sales_return_items`, `sales_return_refunds`, `customer_credit_transactions`, `customers.credit_balance`, returned quantity/amount columns on order lines and orders, `return_status`, cash book category `sales_return`, permissions and grants (D1); verify with `\d` and the check constraints
- [x] 1.2 Rollback script; verify up/down/up on the test database, apply to dev, `prisma db pull && generate` (remove the `license_plate` artefact), build succeeds

## 2. Calculation core

- [x] 2.1 Pure `allocateOrderReductions` and `refundFor(line, k)` (D3) with unit tests: order discount shared, loyalty discount shared, unit-by-unit 33,333/33,333/33,334, never above the line's paid value
- [x] 2.2 Pure loyalty proportion (D6) with unit tests: half returned 100/50 → 50/25, full return takes the remainder

## 3. Returns service

- [x] 3.1 `lookup` and `preview`: returnable lines, receivable reduction, refund due, points (D2–D6); verify with integration tests including cancelled order and too-many refusals
- [x] 3.2 `create` in one transaction with the order row lock: return number, items with restock/damaged movements, receivable reduction, refund lines (cash book entries with shift link, store credit), loyalty, order columns, activity log; approval limit and window (D8); verify every spec scenario of returns, refunds, restocking and loyalty, and that two concurrent returns cannot exceed the sold quantity
- [x] 3.3 Exchanges through `createOrderIn` with the `exchange` payment (D7); verify same-price swap and more-expensive replacement
- [x] 3.4 Store credit as a payment method at checkout and on back-office payments, cash book skipping non-money methods (D9); verify the credit-then-spend scenario and the over-balance refusal
- [x] 3.5 Controller, list with report envelope and export key `sales.returns`, detail, customer credit endpoint, policies (D10); verify with route policy and grant-matrix tests

## 4. Frontend

- [ ] 4.1 API client `lib/api/sales-returns.ts`; `store_credit` in payment method types
- [ ] 4.2 `ReturnSheet`: lookup, lines (quantity, reason, restock/damaged, location), exchange items, refund lines with account, live preview, confirm, return receipt; shadcn only
- [ ] 4.3 POS: "Trả hàng" button (F7), store credit option in the payment sheet when the customer has credit
- [ ] 4.4 Sales-order detail: "Trả hàng" button, returned quantities, the order's returns
- [ ] 4.5 `/sales/returns` list with filter Sheet, badges, detail Sheet, export; navigation entry gated by `sales_returns:read`
- [ ] 4.6 Customer page: credit balance and history

## 5. Checks

- [ ] 5.1 End-to-end scenario test: sale with order discount and loyalty, partial cash return in a shift, exchange, credit refund then spend; verify drawer balance, shift expected cash, stock, points, receivable and credit against hand-computed figures
- [ ] 5.2 All suites, both builds, lint on new files
- [ ] 5.3 `docs/sales/RETURNS.md` (rules, refund examples, approval limit, behaviour for cashiers)
