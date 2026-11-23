# pos/checkout Specification

## Purpose

Lets store staff ring up and complete an in-store sale at the counter, recording a confirmed sales order with its payments, stock movement and loyalty effects in one step.

## Requirements

### Requirement: Checkout records a POS sales order atomically
Completing checkout SHALL create one sales order with channel `pos`, status `completed`, its line items, its payments and the stock deductions in a single all-or-nothing operation. If any part fails, nothing SHALL be recorded and the cart SHALL remain on screen.

#### Scenario: Successful paid checkout
- **WHEN** a cashier with an open shift checks out a cart of 2 items paid in full by cash
- **THEN** one sales order with channel `pos`, status `completed` and payment status `paid` exists with 2 lines and 1 payment
- **AND** stock at the branch's selling location is reduced by the sold quantities
- **AND** the POS shows the receipt with the new order number

#### Scenario: Failure leaves nothing behind
- **WHEN** checkout fails part-way (for example a stock shortage on the second line)
- **THEN** no sales order, payment, stock movement, loyalty entry or receivable is recorded
- **AND** the cart is unchanged and the error explains which line failed

### Requirement: Server determines prices and totals
The server SHALL compute each line's unit price from the product or variant's current selling price and SHALL compute all order totals itself. Totals sent by the client SHALL NOT be trusted.

#### Scenario: Tampered price is ignored
- **WHEN** a checkout request sends a unit price lower than the product's current price without a permitted discount
- **THEN** the order is recorded at the product's current price, or the request is rejected if the payments no longer cover the total

#### Scenario: Price changed while the cart was open
- **WHEN** a product's price changes between adding it to the cart and checking out
- **THEN** checkout is rejected with a message naming the changed product and its new price, and the cart shows the new price

### Requirement: Discounts within permission
Cashiers SHALL be able to apply a line discount and an order discount (fixed amount or percentage). A discount SHALL NOT exceed the amount it applies to, and discounts above the limit set for the user's role SHALL require a user with discount-approval permission.

#### Scenario: Discount larger than the line
- **WHEN** a cashier enters a line discount greater than that line's amount
- **THEN** the discount is rejected with an explanation

#### Scenario: Discount above the role limit
- **WHEN** a sales associate applies a 30% order discount and their limit is 10%
- **THEN** checkout is blocked until a manager approves the discount, and the approver is recorded on the order

### Requirement: Selling requires available stock
A line SHALL NOT be sold in a quantity greater than the stock on hand at the branch's selling location. The POS SHALL show available stock for the branch while searching and in the cart.

#### Scenario: Not enough stock
- **WHEN** a cashier tries to check out 3 units of a product with 2 units on hand at the branch
- **THEN** checkout is rejected naming the product and the 2 units available

### Requirement: Product lookup and barcode scan
The POS SHALL find products and variants by name, SKU or barcode. A scan or exact SKU/barcode match SHALL add one unit of that item to the cart directly; a repeated scan SHALL increase the quantity.

#### Scenario: Scanning adds to cart
- **WHEN** the cashier scans a code that exactly matches one variant's SKU
- **THEN** that variant is added with quantity 1, and scanning it again makes the quantity 2

#### Scenario: No match
- **WHEN** a scanned code matches nothing
- **THEN** the POS shows "not found" with the code and the cart is unchanged

### Requirement: Customer or walk-in
A sale SHALL be either linked to an existing customer, linked to a customer registered during checkout (name and phone), or recorded as a walk-in sale with no customer.

#### Scenario: Quick registration
- **WHEN** the cashier enters a phone number that matches no customer and adds a name
- **THEN** a customer is created and linked to the sale

#### Scenario: Walk-in sale
- **WHEN** no customer is selected
- **THEN** the sale is recorded without a customer and earns no loyalty points

### Requirement: Split payment
A sale SHALL accept one or more payments with methods cash, card, bank transfer or e-wallet, each recorded with its amount and optional reference. For cash, the amount tendered and change given SHALL be recorded. The sum of payments SHALL NOT exceed the order total.

#### Scenario: Cash and card
- **WHEN** a 1,500,000 VND sale is paid with 500,000 cash and 1,000,000 card
- **THEN** the order has two payments and payment status `paid`

#### Scenario: Cash with change
- **WHEN** a 450,000 VND sale is paid with 500,000 cash tendered
- **THEN** the payment amount is 450,000, tendered 500,000 and change 50,000

#### Scenario: Overpayment by non-cash method
- **WHEN** card payments total more than the order total
- **THEN** checkout is rejected

### Requirement: Sale on credit
A sale for a known customer SHALL be completable with less than the full amount paid when the cashier has permission to sell on credit. The unpaid balance SHALL be recorded as that customer's receivable for the order. A walk-in sale SHALL be paid in full.

#### Scenario: Partly paid sale
- **WHEN** a known customer pays 1,000,000 of a 3,000,000 VND sale and the cashier has credit permission
- **THEN** the order has payment status `partial` and the customer's receivable for it is 2,000,000

#### Scenario: Fully paid sale creates no debt
- **WHEN** a known customer pays the full amount
- **THEN** no outstanding receivable exists for that order

#### Scenario: Walk-in cannot owe
- **WHEN** a walk-in sale is checked out with less than the full amount paid
- **THEN** checkout is rejected

### Requirement: Loyalty in POS sales
For sales linked to a customer, the POS SHALL show the customer's points and tier, SHALL allow redeeming points within the loyalty rules, and SHALL award points when the sale is fully paid, all as part of the same checkout.

#### Scenario: Redeem and earn
- **WHEN** a member redeems points on a sale that is then fully paid
- **THEN** the points are deducted, the loyalty discount appears on the order and receipt, and points are earned on the amount after the loyalty discount

#### Scenario: Redemption invalid
- **WHEN** the cashier tries to redeem more points than the customer may redeem
- **THEN** checkout is rejected with the allowed maximum, and nothing is recorded

### Requirement: Multiple open carts
The POS SHALL let a cashier keep several carts open at once as tabs, switch between them, and close a tab without recording a sale. Open carts SHALL survive a page reload on the same device and SHALL NOT be stored on the server.

#### Scenario: Hold and switch
- **WHEN** the cashier opens a second tab while the first has items
- **THEN** the first cart is kept unchanged and can be resumed

#### Scenario: Reload keeps carts
- **WHEN** the browser page is reloaded
- **THEN** the open carts and their items are restored

### Requirement: Keyboard operation
The POS SHALL provide keyboard shortcuts for focusing search, opening payment, completing payment, opening a new tab and switching tabs, and SHALL list them on screen.

#### Scenario: Pay with keyboard
- **WHEN** the cashier presses the payment shortcut with a non-empty cart
- **THEN** the payment dialog opens with the amount due ready for entry

### Requirement: Receipt
After checkout the POS SHALL show a printable receipt with branch name and address, order number, date and time, cashier name, customer (if any), lines with quantities, prices and discounts, loyalty discount, total, each payment, change, and remaining balance for credit sales. A receipt SHALL be reprintable from the order later.

#### Scenario: Receipt content
- **WHEN** a sale is completed by cashier "An" at the Hanoi branch
- **THEN** the receipt shows "An", the Hanoi branch name and address, and the order number

#### Scenario: Reprint
- **WHEN** a user opens a past POS order and chooses reprint
- **THEN** the same receipt content is shown, marked as a reprint

### Requirement: Order numbers are unique and never reused
Every sales order SHALL receive a unique order number at creation, also when several orders are created at the same moment, and a number SHALL never be given to a second order, even after cancellation.

#### Scenario: Simultaneous checkouts
- **WHEN** two cashiers at different branches check out at the same moment
- **THEN** both orders are recorded with different order numbers

### Requirement: Online only
The POS SHALL require a connection to the server to check out. When the server cannot be reached, the POS SHALL show that it is offline and SHALL block checkout while keeping the open carts.

#### Scenario: Connection lost
- **WHEN** the server is unreachable while the cashier presses complete payment
- **THEN** no sale is assumed recorded, the POS shows an offline message, and the cart remains

#### Scenario: Unknown outcome is not duplicated
- **WHEN** a checkout request times out and the cashier retries the same cart
- **THEN** at most one sales order is recorded for that cart

### Requirement: POS access control
Only users with POS sale permission SHALL check out. Discount approval, selling on credit, and reprinting SHALL each be controlled by permissions. All checkouts SHALL be recorded in the activity log with the user, branch and order.

#### Scenario: User without POS permission
- **WHEN** a technician without POS permission calls checkout
- **THEN** the request is refused and nothing is recorded
