# Spec Delta

## ADDED Requirements

### Requirement: Sales by time, staff, branch and brand
The system SHALL report net sales by hour of day, by staff, by branch and channel, and by brand.

#### Scenario: Busy hours
- **WHEN** a manager opens sales by hour for a month
- **THEN** each hour 0–23 shows its orders and net sales

### Requirement: Slow movers
The system SHALL list active products with stock that sold little or nothing in the period, sorted by quantity sold then stock value.

#### Scenario: Nothing sold
- **WHEN** a helmet with 8 in stock sold nothing in 90 days
- **THEN** it appears at the top of slow movers

### Requirement: Discount analysis
The system SHALL split discounts per period into line, order, promotion, voucher and loyalty discounts, and net sales SHALL subtract all of them.

#### Scenario: Sources
- **WHEN** a month had 200,000 line, 300,000 order, 500,000 promotion, 100,000 voucher and 50,000 loyalty discounts
- **THEN** the analysis shows each and a total of 1,150,000
