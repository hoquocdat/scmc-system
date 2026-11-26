# reporting/customer-reports Specification

## Purpose

Shows the best customers, money customers owe by age, and the loyalty points liability.

## Requirements

### Requirement: Top customers
The system SHALL rank customers by net purchases in the period with orders, purchase frequency and last purchase date.

#### Scenario: Top ten
- **WHEN** a manager opens top customers for the year with a limit of 10
- **THEN** the ten customers with the highest net purchases are listed

### Requirement: Receivables aging
The system SHALL show each customer's open receivables split into 0–30, 31–60, 61–90 and over 90 days from the order date.

#### Scenario: Old debt
- **WHEN** a customer owes 1,500,000 from an order 75 days ago
- **THEN** it appears in the 61–90 column

### Requirement: Loyalty points
The system SHALL report points earned, redeemed, reversed and adjusted in the period, and the points outstanding with their value.

#### Scenario: Liability
- **WHEN** customers hold 12,000 points worth 1,000 each
- **THEN** the report shows 12,000,000 outstanding
