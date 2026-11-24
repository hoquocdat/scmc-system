# Spec Delta

## ADDED Requirements

### Requirement: Discount order
The amount of a sale SHALL be computed in this fixed order: unit price (base price and price books), manual line discount, line promotions, order promotion, manual order discount, voucher, loyalty redemption, then tax and shipping. POS checkout, back-office orders and exchanges SHALL use this order.

#### Scenario: Full stack
- **WHEN** a VIP customer buys jeans priced 900,000 by "VIP" with a 10% line promotion, the cart has a 50,000 order promotion, a 10% voucher capped at 100,000 and redeems 20 points worth 20,000
- **THEN** the order total is 900,000 − 90,000 − 50,000 − 76,000 − 20,000 = 664,000

### Requirement: Cart breakdown for screens
The system SHALL return, for a cart, every step of the discount order, the promotions applied to each line and to the order, and the voucher's value or the reason it was rejected. POS and the sales-order form SHALL show these figures.

#### Scenario: Cart shows the promotion
- **WHEN** a cashier adds 3 stickers under "Mua 2 tặng 1"
- **THEN** the cart shows the promotion on the sticker line and the total 100,000

### Requirement: Total checked at checkout
A checkout or order creation that states the total it showed SHALL be refused with `TOTAL_CHANGED` and the new breakdown when the computed total differs.

#### Scenario: Promotion ended mid-sale
- **WHEN** a promotion ends between the cart preview and payment
- **THEN** checkout is refused with `TOTAL_CHANGED` and the cart shows the new total
