# Spec Delta

## Purpose

Lets a store take back some or all items of a sale, or exchange them, refunding exactly what the customer paid for those items and putting stock, loyalty points, receivables and the cash book right.

## ADDED Requirements

### Requirement: Returnable lines
A return SHALL refer to one confirmed or completed order. For each line, staff SHALL be able to return up to the sold quantity minus what earlier returns took back. Two returns of the same order at the same time SHALL NOT together exceed the sold quantity.

#### Scenario: Partial return
- **WHEN** an order sold 3 stickers and 1 pair of jeans and 1 sticker was already returned
- **THEN** the lookup shows 2 stickers and 1 pair of jeans returnable

#### Scenario: Too many
- **WHEN** staff try to return 3 stickers from that order
- **THEN** the return is refused

#### Scenario: Cancelled order
- **WHEN** staff look up a cancelled order
- **THEN** no line is returnable

### Requirement: Refund value
The refund for returned units SHALL be what the customer paid for them: unit price minus line discount plus tax, minus the line's share of order-level discounts and loyalty redemption, split over lines in proportion to their value. Returning the last remaining units of a line SHALL refund the line's remaining value so that rounding never refunds more than was paid. Shipping SHALL NOT be refunded.

#### Scenario: Order discount shared
- **WHEN** an order of jeans 1,000,000 and helmet 3,000,000 had a 400,000 order discount and the jeans are returned
- **THEN** the refund is 900,000

#### Scenario: Unit by unit
- **WHEN** 3 stickers paid 100,000 in total after discounts are returned one at a time
- **THEN** the refunds are 33,333, 33,333 and 33,334

### Requirement: Refund destination
A refund SHALL first reduce the order's outstanding receivable, and the remainder SHALL be paid back exactly by the chosen methods: cash, card, bank transfer or e-wallet (recorded as a cash book payment on the chosen or mapped account) or customer credit. The refund SHALL NOT exceed what the order collected less earlier refunds.

#### Scenario: Cash refund at POS
- **WHEN** a cashier refunds 450,000 in cash during a shift
- **THEN** a 450,000 payment entry "Trả hàng" is recorded on the branch drawer linked to the shift, and the shift's expected cash falls by 450,000

#### Scenario: Unpaid credit sale
- **WHEN** an order of 2,000,000 was sold on credit with 500,000 paid and items worth 800,000 are returned
- **THEN** the receivable falls from 1,500,000 to 700,000 and nothing is paid back

#### Scenario: Refund split does not add up
- **WHEN** the refund due is 900,000 and the requested refund lines add up to 800,000
- **THEN** the return is refused

### Requirement: Customer credit
A refund SHALL be keepable as customer credit for an identified customer. Credit SHALL be usable as a payment method at POS and on back-office payments up to the customer's balance, and every change SHALL be recorded with its source.

#### Scenario: Credit then spend
- **WHEN** 300,000 is refunded as credit and the customer later buys for 500,000 paying 300,000 by credit and 200,000 in cash
- **THEN** the credit balance goes 0 → 300,000 → 0 and only the 200,000 cash is recorded in the cash book

#### Scenario: Credit without a customer
- **WHEN** staff choose credit on a walk-in sale's return
- **THEN** the return is refused

### Requirement: Restocking
Each returned line SHALL either go back into stock at a location of the order's branch, increasing stock by the returned quantity at the original cost, or be recorded as damaged without changing stock.

#### Scenario: Restock
- **WHEN** 1 helmet is returned to the HCMC store location
- **THEN** HCMC store stock of the helmet rises by 1

#### Scenario: Damaged
- **WHEN** a defective exhaust is returned as damaged
- **THEN** stock is unchanged and the movement is recorded as damaged

### Requirement: Loyalty correction
Points earned on the order SHALL be reversed, and points redeemed on it SHALL be restored, in proportion to the returned value; a full return SHALL reverse and restore the remainder exactly.

#### Scenario: Half returned
- **WHEN** an order earned 100 points and redeemed 50, and half its value is returned
- **THEN** 50 points are reversed and 25 restored

### Requirement: Exchanges
An exchange SHALL return items and sell replacements in one transaction. The returned value SHALL pay for the replacements first; the customer SHALL pay any difference, or receive it back through the refund methods.

#### Scenario: Swap size, same price
- **WHEN** jeans size 30 are exchanged for size 32 at the same price
- **THEN** a return and a new order are created, size 30 stock rises by 1, size 32 stock falls by 1, and no money moves

#### Scenario: More expensive replacement
- **WHEN** a 1,000,000 item is exchanged for a 1,500,000 item and the customer pays 500,000 by card
- **THEN** the new order is paid 1,000,000 by exchange and 500,000 by card, and only the card payment is recorded in the cash book

### Requirement: Documents, approval and audit
Each return SHALL get its own never-reused number `TH-YYMM-#####`, SHALL be recorded in the activity log, and SHALL be listed with filters and exportable to xlsx/csv. A return above the approval limit, or after the return window, SHALL need `sales_returns:approve`; creating returns SHALL need `sales_returns:create`.

#### Scenario: Above limit
- **WHEN** a sales associate starts a 5,000,000 return with a 2,000,000 limit
- **THEN** it is refused with `RETURN_APPROVAL_REQUIRED`, and a store manager can complete it

### Requirement: Return at POS and back office
Staff SHALL be able to start a return at POS from a receipt's order number and from the sales-order detail page, see the refund before confirming, and print a return receipt.

#### Scenario: From the receipt
- **WHEN** a cashier types the order number from a receipt
- **THEN** the order's returnable lines and refundable amounts are shown
