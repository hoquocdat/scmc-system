# finance/cash-book Specification

## Purpose

Keeps one ledger (sổ quỹ) of every amount of money received and paid, per cash, bank and e-wallet account of each branch, so balances, daily cash and operating expenses are known.

## Requirements

### Requirement: Cash book accounts
The system SHALL keep cash book accounts of type cash, bank or e-wallet. Each account SHALL belong to one branch, have a name, an active flag and, for bank accounts, the bank name and account number. Each branch SHALL have exactly one cash account marked as its POS drawer.

#### Scenario: Branch accounts
- **WHEN** an administrator lists the accounts of the HCMC branch
- **THEN** the list shows its POS drawer cash account, its safe, its bank account and its e-wallet account with their balances

#### Scenario: Second POS drawer refused
- **WHEN** an administrator marks a second cash account of the same branch as POS drawer
- **THEN** the change is refused

### Requirement: New branches get default accounts
Creating a branch SHALL create its POS drawer cash account and a default bank account, and SHALL map every payment method to an account of that branch, so the branch can take payments immediately.

#### Scenario: New branch
- **WHEN** a branch "SCMC Da Nang" is created
- **THEN** it has a POS drawer account and a bank account, cash maps to the drawer and card, bank transfer and e-wallets map to the bank account

### Requirement: Payment method to account mapping
Each branch SHALL map each payment method (cash, card, bank transfer, MoMo, ZaloPay, VNPay) to one of its active accounts. Money received or paid through a method at a branch SHALL be recorded on the mapped account unless an account is chosen explicitly.

#### Scenario: Card payment lands on the bank account
- **WHEN** a POS sale at HCMC is paid 1,000,000 by card and card maps to "Vietcombank HCMC"
- **THEN** a 1,000,000 receipt is recorded on "Vietcombank HCMC"

#### Scenario: Mapping to an inactive account refused
- **WHEN** an administrator maps cash to an inactive account
- **THEN** the change is refused

### Requirement: Opening balance
An account SHALL be able to receive one opening balance entry with an amount and a date. Balances SHALL count only entries on or after the opening balance date. Historical payments made before the cash book existed SHALL NOT be imported.

#### Scenario: Go-live opening balance
- **WHEN** finance sets the HCMC safe's opening balance to 50,000,000 on 1 December
- **THEN** the safe's balance on 1 December starts from 50,000,000

#### Scenario: Second opening balance refused
- **WHEN** an opening balance is entered for an account that already has one
- **THEN** it is refused; the existing one must be cancelled first

### Requirement: Entries
Every cash book entry SHALL record its number, account, branch, direction (receipt or payment), amount greater than zero, date and time, category, counterparty (customer, supplier, employee or other, with name), source document if any, the user who recorded it and a note. Receipt numbers SHALL use the prefix PT and payment numbers PC, unique and never reused.

#### Scenario: Entry fields
- **WHEN** a receipt is recorded
- **THEN** it has a number like PT-20261201-0001, its account, branch, amount, date, category, counterparty and recorder

#### Scenario: Zero amount refused
- **WHEN** an entry of 0 VND is submitted
- **THEN** it is refused

### Requirement: Automatic entries from sales payments
Every completed payment on a sales order, including POS sales and receivable collections, SHALL create a receipt in the same transaction as the payment, on the account mapped to the order's branch and the payment method, with category "Bán hàng" or "Thu nợ khách hàng", the customer as counterparty and the order as source. For cash payments the receipt amount SHALL be the amount applied to the order, not the amount tendered.

#### Scenario: POS cash sale
- **WHEN** a POS sale of 450,000 is paid with 500,000 cash and 50,000 change
- **THEN** one 450,000 receipt is recorded on the branch's POS drawer, linked to the order and the shift

#### Scenario: Receivable collection
- **WHEN** a customer pays 2,000,000 against an outstanding order by bank transfer
- **THEN** a 2,000,000 receipt with category "Thu nợ khách hàng" is recorded on the mapped bank account

#### Scenario: Payment fails, no entry
- **WHEN** a checkout fails after payments were validated
- **THEN** no cash book entry exists for it

### Requirement: Automatic entries from workshop payments
Every payment recorded on a service order SHALL create a receipt with category "Dịch vụ xưởng" on the account mapped to the service order's branch (the default branch when the order has none) and the payment method. Deleting a workshop payment SHALL create a reversing payment entry instead of deleting the receipt.

#### Scenario: Workshop deposit
- **WHEN** a 1,000,000 cash deposit is recorded on a service order at Hanoi
- **THEN** a 1,000,000 receipt is recorded on the Hanoi POS drawer with the service order as source

#### Scenario: Payment deleted
- **WHEN** that deposit is deleted
- **THEN** a 1,000,000 payment entry marked as reversal of the receipt is recorded, and the drawer balance returns to its previous value

### Requirement: Automatic entries from supplier payments
Every supplier payment SHALL create a payment entry with category "Trả nhà cung cấp", the supplier as counterparty and the supplier payment as source, on the account chosen when paying, or the default branch's account mapped to the payment method when none is chosen.

#### Scenario: Supplier paid by bank
- **WHEN** finance pays a supplier 20,000,000 by bank transfer from "Vietcombank HCMC"
- **THEN** a 20,000,000 payment entry is recorded on "Vietcombank HCMC" naming the supplier

### Requirement: Automatic entries from payroll
Marking a payroll period as paid SHALL create one payment entry per paid payslip, for its net pay, with category "Lương nhân viên", the employee as counterparty, on the account chosen when paying (or the default branch's account mapped to the method).

#### Scenario: Payroll paid
- **WHEN** a period with three finalized slips of 8,000,000, 9,000,000 and 10,000,000 net pay is marked paid by bank transfer
- **THEN** three payment entries totalling 27,000,000 are recorded on the chosen account, one per employee

### Requirement: Manual vouchers
Users with permission SHALL record receipt vouchers (phiếu thu) and payment vouchers (phiếu chi) for other income and expenses, choosing account, category, counterparty, amount, date, note and optional attachments.

#### Scenario: Pay rent
- **WHEN** finance records a payment voucher of 30,000,000 for category "Thuê mặt bằng" from the HCMC bank account
- **THEN** the voucher gets a PC number and the bank balance decreases by 30,000,000

#### Scenario: Attachment
- **WHEN** a payment voucher is recorded with a photo of the invoice
- **THEN** the photo is stored with the voucher and shown when it is opened

### Requirement: Categories
Entries SHALL have a category from a configurable list per direction. System categories used by automatic entries SHALL exist from the start and SHALL NOT be deleted; other categories SHALL be added, renamed or deactivated by administrators.

#### Scenario: Add expense category
- **WHEN** an administrator adds payment category "Điện nước"
- **THEN** it can be chosen on new payment vouchers

#### Scenario: System category protected
- **WHEN** an administrator tries to delete "Bán hàng"
- **THEN** it is refused

### Requirement: Transfers between accounts
Users with permission SHALL move money between two accounts as one transfer that records a payment on the source and a receipt on the destination with the same amount, date and transfer reference. Cancelling a transfer SHALL cancel both sides.

#### Scenario: Drawer to safe
- **WHEN** 5,000,000 is transferred from the HCMC POS drawer to the HCMC safe
- **THEN** the drawer decreases and the safe increases by 5,000,000, and both entries show the same transfer reference

#### Scenario: Same account refused
- **WHEN** a transfer names the same account as source and destination
- **THEN** it is refused

### Requirement: Corrections
Automatic entries SHALL NOT be edited or cancelled directly; they SHALL be corrected only by reversing their source. Manual vouchers and transfers SHALL be cancelled with a reason, never deleted; a cancelled entry SHALL stay visible, marked cancelled with who and when, and SHALL be excluded from balances.

#### Scenario: Cancel a manual voucher
- **WHEN** finance cancels a payment voucher with reason "nhập sai số tiền"
- **THEN** the voucher is shown as cancelled with the reason, and the account balance no longer includes it

#### Scenario: Automatic entry protected
- **WHEN** a user tries to cancel the receipt created by a POS sale
- **THEN** it is refused with a message that the source must be reversed

### Requirement: Balances
The system SHALL show for each account its balance at any date: opening balance plus receipts minus payments, counting only posted (not cancelled) entries, in Vietnam time. The account list SHALL show current balances, and a branch total.

#### Scenario: Balance at a date
- **WHEN** an account has opening balance 10,000,000 on 1 March, receipts of 5,000,000 and payments of 2,000,000 during March
- **THEN** its balance at the end of 31 March is 13,000,000

### Requirement: Cash book list
Users with permission SHALL list entries filtered by branch, account, direction, category, counterparty, source type, status and date range, with the opening balance of the period, totals of receipts and payments, closing balance and a running balance per entry when a single account is selected. The list SHALL be exportable to Excel and CSV.

#### Scenario: Account statement
- **WHEN** a user lists the HCMC POS drawer for 5 March
- **THEN** the list shows the balance at the start of 5 March, each entry with its running balance, the day's receipts and payments, and the closing balance

### Requirement: Cash book permissions
Viewing the cash book SHALL require cash-book read permission. Recording receipt vouchers, recording payment vouchers, recording transfers, cancelling vouchers and managing accounts and categories SHALL each require their own permission. Every create and cancel SHALL be recorded in the activity log.

#### Scenario: Sales associate cannot pay out
- **WHEN** a sales associate without payment-voucher permission records a payment voucher
- **THEN** it is refused
