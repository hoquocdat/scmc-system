# Spec Delta

## ADDED Requirements

### Requirement: Cash book balances
The system SHALL report per cash book account: balance at the start of the period, receipts, payments and balance at the end.

#### Scenario: Drawer
- **WHEN** the HCMC drawer started the day at 2,000,000, received 1,650,000 and paid 2,350,000
- **THEN** it ends at 1,300,000

### Requirement: Profit and loss
The system SHALL report retail and workshop revenue, discounts, returns, cost of goods sold (net of restocked returns), gross profit, operating expenses from the cash book by category, and net profit, for retail, workshop and combined. Supplier payments, transfers, refunds and shift movements SHALL NOT count as expenses.

#### Scenario: Net profit
- **WHEN** retail net revenue is 100,000,000, COGS 60,000,000, workshop revenue 30,000,000 with parts 10,000,000, and expenses 25,000,000
- **THEN** net profit is 35,000,000
