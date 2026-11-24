# Spec Delta

## Purpose

Measures what each promotion and voucher campaign gave away and the sales it was part of.

## ADDED Requirements

### Requirement: Promotion and voucher performance
The system SHALL report per promotion and per voucher campaign in the period: orders using it, discount given, and net sales of those orders.

#### Scenario: Buy 2 get 1
- **WHEN** "Mua 2 tặng 1" was used in 12 orders giving 600,000 off on 4,200,000 of sales
- **THEN** it is listed with 12 orders, 600,000 discount and 4,200,000 sales
