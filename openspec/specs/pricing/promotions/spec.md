# pricing/promotions Specification

## Purpose

Discount rules the system applies by itself when their conditions are met, so promotions are applied the same way at every counter and can be measured.

## Requirements

### Requirement: Promotion types
The system SHALL support promotions of four types: a percent, amount or fixed-price discount on products, variants, categories or brands; an order discount above a minimum order value; buy X get Y free or discounted; and a bundle price for a set of items. Percent discounts SHALL accept a maximum discount.

#### Scenario: Category percent
- **WHEN** "Găng tay −20%" targets category Gloves and a cart holds gloves at 500,000
- **THEN** the gloves line gets 100,000 off

#### Scenario: Order discount
- **WHEN** "Đơn từ 5 triệu giảm 300k" applies and the cart is worth 5,200,000 after line promotions
- **THEN** the order gets 300,000 off; at 4,900,000 it gets nothing

#### Scenario: Buy 2 get 1
- **WHEN** "Mua 2 tặng 1" targets stickers at 50,000 and the cart holds 3 stickers
- **THEN** one sticker is free (50,000 off); with 5 stickers one is free, with 6 two are

#### Scenario: Bundle
- **WHEN** "Combo mũ + găng 2.200.000" covers helmet 2,000,000 and gloves 500,000 and the cart holds 1 helmet and 2 gloves
- **THEN** one bundle applies with 300,000 off, shared over the helmet and one pair of gloves by value

### Requirement: Promotion conditions
A promotion SHALL apply only when it is active, the sale time is inside its dates, days of week and time of day (Vietnam time), and the sale's branch, customer group and channel meet its conditions.

#### Scenario: Happy hour
- **WHEN** a promotion runs Saturday 17:00–20:00 and a sale happens Saturday 16:30
- **THEN** it does not apply

#### Scenario: Customer group
- **WHEN** a promotion targets group "VIP" and the sale is to a walk-in customer
- **THEN** it does not apply

### Requirement: Combining promotions
Each line SHALL receive at most one line promotion, the one giving the largest discount. At most one order promotion SHALL apply, the largest whose minimum is met. When the order promotion or an applied line promotion is not combinable, only the better of the line promotions together and the order promotion alone SHALL apply.

#### Scenario: Two promotions on one item
- **WHEN** jeans are 10% off in one promotion and 150,000 off in another and cost 1,000,000
- **THEN** the jeans line gets 150,000 off only

#### Scenario: Not combinable
- **WHEN** line promotions give 200,000 off, a non-combinable order promotion gives 300,000 off
- **THEN** only the order promotion applies

### Requirement: Applied promotions recorded
Each applied promotion SHALL be stored with the order and, for line promotions, with each line it discounted, with its amount; sales reports SHALL subtract promotion discounts from net sales and show them separately.

#### Scenario: Traceable discount
- **WHEN** an order receives "Mua 2 tặng 1" on stickers
- **THEN** the sticker line shows 50,000 promotion discount linked to that promotion, and the sales summary shows 50,000 under promotion discounts

### Requirement: Returns and promotions
A return SHALL refund what was paid net of promotion discounts. When returned items break a buy-X-get-Y or bundle condition for the items kept, the discount the kept items no longer qualify for SHALL be taken off the refund, never below zero.

#### Scenario: Buy 2 get 1 broken
- **WHEN** 3 stickers were bought for 100,000 under "Mua 2 tặng 1" and one is returned
- **THEN** the refund is 0

### Requirement: Promotion management
Staff with `promotions:create|update|delete` SHALL be able to create, edit, activate, deactivate and delete promotions; anyone with `promotions:read` SHALL see promotions with their usage (orders and total discount).

#### Scenario: Usage
- **WHEN** a manager opens "Mua 2 tặng 1" after 12 orders used it
- **THEN** it shows 12 orders and the total discount given
