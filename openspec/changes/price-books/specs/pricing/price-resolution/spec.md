# Spec Delta

## Purpose

One rule decides the unit price of every sold line, at the POS and in back-office orders, from the base price and the applicable price books, so the same item costs the same wherever it is sold.

## ADDED Requirements

### Requirement: Base price
The base price SHALL be the existing product rule: a variant's own retail price when set, otherwise the product's sale price inside its date window or its retail price, plus the variant's price adjustment. With no applicable price book, the line price SHALL be the base price.

#### Scenario: No price books
- **WHEN** no price book exists and helmet H1 has retail price 2,000,000
- **THEN** a POS sale of H1 is priced 2,000,000 with no price book recorded

### Requirement: Automatic price book selection
A price book SHALL apply to a line when it is active, the sale time is inside its dates, the sale's branch meets its branch condition, the customer meets its customer condition, and it has an entry for the item (the variant's own entry first, else the product's). Among applicable books the highest priority SHALL win; ties SHALL be broken by later start time, then code. A walk-in sale without a customer SHALL only match books for all customers.

#### Scenario: Wholesale customer
- **WHEN** a customer in group "Wholesale" buys helmet H1 at HCMC and "Giá sỉ" has H1 at 1,800,000
- **THEN** the line is priced 1,800,000 from "Giá sỉ"

#### Scenario: Higher priority wins
- **WHEN** H1 is 1,800,000 in "Giá sỉ" (priority 10) and 1,700,000 in "Đối tác" (priority 20) and the customer is in both groups
- **THEN** the line is priced 1,700,000 from "Đối tác"

#### Scenario: Branch condition
- **WHEN** "Giá Hà Nội" applies only to the Hanoi branch and the same product is sold at HCMC
- **THEN** the HCMC sale uses the base price

#### Scenario: Book outside its dates
- **WHEN** "Tết 2027" ends on 2027-02-15 and a sale happens on 2027-02-16
- **THEN** the book does not apply

### Requirement: Relative prices
A percent-off entry SHALL price the line at the base price reduced by the percent, rounded to whole đồng; an amount-off entry SHALL reduce the base price by the amount, not below zero; a fixed entry SHALL set the price regardless of the base price.

#### Scenario: Percent off a variant
- **WHEN** gloves G1 have base 500,000, size XL adds 20,000, and "VIP" has G1 at 10 percent off
- **THEN** G1 XL is priced 468,000

### Requirement: Manual price book choice
Staff with `price_books:apply` SHALL be able to choose, for a whole sale, a price book that is active, inside its dates, allowed for manual choice and valid for the branch, regardless of its customer condition. Items without an entry in the chosen book SHALL get the base price. Staff without the permission SHALL be refused.

#### Scenario: Wholesale price for a walk-in partner
- **WHEN** a store manager chooses "Giá sỉ" for a walk-in sale of H1 and gloves G1 not in that book
- **THEN** H1 is priced from "Giá sỉ" and G1 at its base price

#### Scenario: Sales associate cannot choose
- **WHEN** a sales associate sends a checkout naming a price book
- **THEN** the checkout is refused with 403

### Requirement: Same price everywhere
POS checkout, back-office order creation and adding items to an existing order SHALL use this rule. POS checkout SHALL reject a line whose displayed price differs from the resolved price with `PRICE_CHANGED` and the current prices.

#### Scenario: Book started during the sale
- **WHEN** a book starts while a cashier is building a cart priced at the base price
- **THEN** checkout is refused with `PRICE_CHANGED` listing the new prices

#### Scenario: Back-office line added
- **WHEN** finance adds H1 to an existing order of a "Wholesale" customer
- **THEN** the new line is priced from "Giá sỉ", whatever price the request carried

### Requirement: Price source recorded
Each order line SHALL record the price book that priced it (or none), its base price and its price source. The order SHALL record a manually chosen price book.

#### Scenario: Line history
- **WHEN** a price book entry is changed after a sale
- **THEN** the sold line still shows the price and price book it was sold with

### Requirement: Price quote for screens
The system SHALL return, for a branch, an optional customer, an optional chosen price book and a list of items, each item's unit price, base price and price book, and SHALL list the price books that apply automatically and those the user may choose. The POS cart and the sales-order form SHALL show each line's price source.

#### Scenario: Cart shows the source
- **WHEN** a cashier attaches a "Wholesale" customer to a cart containing H1
- **THEN** H1's line shows 1,800,000 and "Giá sỉ"
