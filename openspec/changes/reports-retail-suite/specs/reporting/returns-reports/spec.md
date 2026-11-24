# Spec Delta

## Purpose

Shows how much is returned, which products come back and why.

## ADDED Requirements

### Requirement: Returns by product
The system SHALL report per product: quantity sold, quantity returned, return rate and returned value in the period.

#### Scenario: Return rate
- **WHEN** 20 pairs of jeans were sold and 2 returned in the month
- **THEN** jeans show a return rate of 10%

### Requirement: Return reasons and staff
The system SHALL report returns grouped by reason, and by the staff who processed them, with counts, quantities and value.

#### Scenario: Wrong size
- **WHEN** 5 of 8 returns in the month were "Sai kích cỡ"
- **THEN** the reasons report shows that reason with 5 returns first
