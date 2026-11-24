# Spec Delta

## Purpose

Gives each branch a one-page summary of the day and the close of each shift, as store managers check every evening.

## ADDED Requirements

### Requirement: Daily summary per branch
The system SHALL report, per branch and day: orders, gross sales, discounts by source, net sales, returns, net after returns, money received by method, refunds paid, cash moved in and out of the drawer, new receivables, and sales by staff.

#### Scenario: A day at HCMC
- **WHEN** HCMC sold 3,700,000 gross with 470,000 discounts, paid 872,973 back for a return and took 3,230,000 in cash
- **THEN** the daily summary shows net 3,230,000, returns 872,973, net after returns 2,357,027 and cash received 3,230,000

### Requirement: Shift close report
The system SHALL list shifts with cashier, open and close times, opening float, cash sales, cash refunds, cash in and out, expected cash, counted cash and the difference.

#### Scenario: Short by 50,000
- **WHEN** a shift expected 2,150,000 and 2,100,000 was counted
- **THEN** the report shows −50,000 for that shift
