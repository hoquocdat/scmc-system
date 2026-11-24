# Spec Delta

## ADDED Requirements

### Requirement: Stock card
The system SHALL list every stock movement of one product (or variant) at a location in the period with type, reference and running balance, starting from the balance before the period.

#### Scenario: Helmet card
- **WHEN** a manager opens the stock card of a helmet at HCMC for a month
- **THEN** the opening balance, each sale, receipt, transfer, return, count adjustment and write-off, and the closing balance are shown

### Requirement: Transfers in transit and count variances
The system SHALL list transfer lines shipped but not fully received, and the differences posted by completed stock counts in the period with their value.

#### Scenario: In transit
- **WHEN** 10 exhausts were shipped HCMC → Hanoi and 8 received so far
- **THEN** 2 are listed in transit

### Requirement: Days of stock and dead stock
The system SHALL show, per product and location, stock on hand, average daily sales in the period and days of stock, and SHALL list as dead stock the items with stock and no sale in the period.

#### Scenario: Days of stock
- **WHEN** gloves have 30 on hand and sold 60 in the last 30 days
- **THEN** days of stock is 15
