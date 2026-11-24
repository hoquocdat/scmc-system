# inventory/stock-reservations Specification

## Purpose

Keeps stock promised to customers' pending orders from being sold to someone else.

## Requirements

### Requirement: Reservations
Sales orders saved as pending (đặt hàng) SHALL reserve their quantities at the order's location; confirming, cancelling or editing the order SHALL update the reservation.

#### Scenario: Pending order
- **WHEN** a pending order reserves 3 helmets at HCMC with 5 on hand
- **THEN** HCMC shows 5 on hand, 3 reserved and 2 available

### Requirement: Available stock
Selling at POS, confirming other orders, shipping transfers and writing off SHALL be limited to available stock; confirming a pending order SHALL use its own reservation.

#### Scenario: POS limited by reservation
- **WHEN** a cashier sells 3 helmets while 2 are available
- **THEN** the sale is refused for insufficient stock

#### Scenario: Confirm the pending order
- **WHEN** the pending order of 3 helmets is confirmed
- **THEN** stock falls to 2 on hand and 0 reserved
