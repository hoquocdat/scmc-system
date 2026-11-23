# Sổ quỹ (Cash book)

The cash book records every movement of money in and out of the company's cash, bank and e-wallet
accounts, per branch. Spec: `openspec/specs/finance/cash-book` (change `cash-book`). Migration:
`backend/prisma/migrations/023_cash_book.sql` (rollback in `rollback/023_cash_book.sql`).

## Concepts

| Term | Meaning |
| --- | --- |
| Tài khoản quỹ (account) | One cash, bank or e-wallet account belonging to a branch. Each branch has exactly one **POS drawer** (két quầy) cash account. |
| Phương thức → tài khoản (method mapping) | For each branch, which account receives each payment method (cash, card, bank transfer, MoMo, ZaloPay, VNPay). |
| Loại thu chi (category) | Why money moved. System categories are used by automatic entries and cannot be edited; custom ones are for manual vouchers. |
| Phiếu thu / phiếu chi (PT / PC) | One entry, numbered `PT-YYMM-#####` (receipt) or `PC-YYMM-#####` (payment). Numbers are never reused. |
| Số dư đầu kỳ (opening balance) | The real balance of an account at the start of a chosen date. Balances are counted from that date. |

## Go-live steps

Do these once per branch, in this order, before the first sale after deployment. All steps are on
**Cài đặt → Sổ quỹ** (`/settings/cash-book`) and need `cash_book:configure` (finance, manager,
superadmin).

1. **Apply the migration.** It creates, for every existing branch, a `<CODE>-CASH` account (the POS
   drawer) and a `<CODE>-BANK` account, maps cash to the drawer and every other method to the bank
   account, and moves the existing shift cash movements into the cash book.
2. **Accounts tab.** Rename the defaults if needed, fill the bank name and account number, and add
   the other accounts the branch really holds (a safe `KÉT SẮT`, a second bank, a MoMo wallet, …).
   New branches get the two default accounts automatically when they are created.
3. **Payment methods tab.** For each branch, choose the account receiving each method. A payment
   whose method has no account is refused with `CASH_ACCOUNT_NOT_CONFIGURED`, so check every row.
4. **Opening balances tab.** Count the drawer and safes and read the bank statements, then enter
   each account's balance at the start of the go-live date. One opening balance per account; to
   correct one, cancel it in the cash book and enter it again.
5. **Categories tab.** Add the expense and income categories finance uses (rent, utilities, shipping
   and maintenance are already there).
6. **Permissions.** Defaults: finance, manager and superadmin have everything; store managers can
   read, record receipts and transfer. Adjust in **Cài đặt → Vai trò** if needed.

Nothing before the go-live date is backfilled: historic sales and payments have no entries.

## What writes to the cash book automatically

Each entry is written in the same database transaction as the operation; if the entry cannot be
written (for example a missing mapping or an inactive account), the operation fails as a whole.

| Operation | Entry | Account |
| --- | --- | --- |
| POS and back-office order payment | PT "Bán hàng" (cash net of change) | method mapping of the order's branch |
| Customer receivable collection | PT "Thu nợ khách hàng" | method mapping |
| Workshop payment / deposit | PT "Dịch vụ xưởng"; deleting the payment posts a reversal PC | mapping of the service order's branch (default branch if none) |
| Supplier payment | PC "Trả nhà cung cấp" | chosen account, else mapping of the default branch |
| Payroll marked paid | one PC "Lương nhân viên" per slip | chosen account, else mapping |
| Shift cash in / out | PT "Nộp tiền vào quầy" / PC "Rút tiền khỏi quầy" on the drawer, or a transfer when a target account is chosen | drawer |
| Shift close with a counted difference | PT/PC "Chênh lệch kiểm quỹ" | drawer |

Automatic entries cannot be cancelled from the cash book; correct the source document instead.

## Behaviour changes

**Cashiers (POS)**

- Cash in / out in the shift sheet now has an optional account: choosing the safe or the bank moves
  the money there (two linked entries) instead of recording it as leaving the business.
- Expected cash at close = opening float + every drawer entry linked to the shift (sales in cash,
  cash in/out, transfers made from the shift sheet). Money moved in or out of the drawer by someone
  else through the cash book is **not** part of the shift; during a shift, move drawer cash only
  through the shift sheet.
- A non-zero difference at close is booked as "Chênh lệch kiểm quỹ", so the drawer balance always
  equals the counted cash.

**Finance and managers**

- **Sổ quỹ** (`/cash-book`) lists entries with filters (period, branch, account, type, category,
  counterparty, source, status) and exports them to Excel/CSV. Selecting one account shows the
  opening balance, a running balance per entry and the closing balance.
- Manual receipt and payment vouchers (with attachments), transfers between accounts and
  cancellation with a reason (a cancelled entry stays visible, struck through). Cancelling one side
  of a transfer cancels both.
- The supplier payment dialog and the payroll "mark paid" dialog ask which account pays; payroll
  now also asks for the payment method (previously the request was rejected without one).

## API

All under `/cash-book`, guarded by `cash_book:<action>`:
`GET entries` (report envelope; `format=xlsx|csv` downloads), `GET entries/:id`, `GET balances`,
`POST receipts | payments | transfers | opening-balances`, `POST entries/:id/cancel`,
`GET|POST accounts`, `PATCH accounts/:id`, `GET|PUT accounts/method-map`,
`GET|POST categories`, `PATCH|DELETE categories/:id`. See Swagger for the payloads.

## Verification

`backend/test/integration/cash-book-scenario.int-spec.ts` runs one full day at a branch (opening
balances, POS sale, shift transfer, receivable collection, workshop deposit and deletion, supplier
payment, payroll, vouchers, transfer, shift close with a shortfall) and checks every balance and
the shift's expected cash against figures computed by hand.
