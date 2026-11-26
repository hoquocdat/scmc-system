# reporting/supplier-reports Specification

## Purpose

Shows purchasing per supplier and what SCMC owes them by age.

## Requirements

### Requirement: Purchases by supplier
The system SHALL report per supplier: purchase orders, value ordered, value paid and supplier returns in the period.

#### Scenario: Supplier totals
- **WHEN** two orders of 20,000,000 and 5,000,000 were approved for "Momotaro" and 1,000,000 returned
- **THEN** Momotaro shows 25,000,000 purchased and 1,000,000 returned

### Requirement: Payables aging
The system SHALL show unpaid purchase order balances per supplier split into 0–30, 31–60, 61–90 and over 90 days.

#### Scenario: Unpaid order
- **WHEN** an approved order of 10,000,000 from 40 days ago has 4,000,000 paid
- **THEN** 6,000,000 appears in the 31–60 column for that supplier
