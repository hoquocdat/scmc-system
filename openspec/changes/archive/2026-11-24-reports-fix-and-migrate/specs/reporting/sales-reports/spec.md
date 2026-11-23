# Spec Delta

## Purpose

Gives managers and finance accurate retail sales figures (summary, category, payment method, top products, trends) based only on sales that actually happened.

## ADDED Requirements

### Requirement: Revenue counts only revenue-bearing orders
Retail sales reports SHALL include only sales orders whose status is confirmed, processing, ready or completed. Draft, pending and cancelled orders SHALL NOT count toward revenue, order counts, items sold or discounts.

#### Scenario: Cancelled and draft orders excluded
- **WHEN** a period has one completed order of 1,000,000, one cancelled order of 500,000 and one draft of 300,000
- **THEN** the sales summary shows revenue 1,000,000 and 1 order

### Requirement: Revenue figures are consistent
The sales summary SHALL report gross sales (sum of line amounts before discounts), total discounts (line, order and loyalty discounts), net sales (gross minus discounts, equal to the sum of order totals excluding tax and shipping), tax, shipping, order count, items sold and average order value (net sales divided by order count). No discount SHALL be subtracted twice.

#### Scenario: Discount counted once
- **WHEN** one order has lines worth 1,000,000 and a 100,000 order discount, so its total is 900,000
- **THEN** gross sales is 1,000,000, discounts 100,000 and net sales 900,000

### Requirement: Reporting periods use Vietnam time
All date ranges, day boundaries and period groupings (day, week, month) SHALL use the Asia/Ho_Chi_Minh time zone. A date range SHALL include the whole of its end date.

#### Scenario: Early-morning sale
- **WHEN** a sale is made at 06:30 on 5 March in Vietnam (23:30 on 4 March UTC)
- **THEN** it appears under 5 March in daily reports

#### Scenario: End date inclusive
- **WHEN** a report is requested from 1 March to 31 March
- **THEN** sales made at 21:00 on 31 March are included

### Requirement: Branch filter
Every retail sales report SHALL accept an optional branch (store) filter and, when given, SHALL include only orders of that branch.

#### Scenario: Filter by Hanoi
- **WHEN** the summary is requested for the Hanoi branch
- **THEN** only Hanoi orders are counted

### Requirement: Sales by category
The system SHALL report, per product category, the number of orders, quantity sold and net sales for the period. Products without a category SHALL be grouped as "Uncategorized".

#### Scenario: Category grouping
- **WHEN** jeans in category "Denim" and an exhaust in category "Exhaust" are sold
- **THEN** the report shows separate rows for "Denim" and "Exhaust"

### Requirement: Sales by payment method
The system SHALL report the amount received and the number of payments per payment method for retail sales, using the payments recorded against sales orders, and SHALL exclude payments that are not completed.

#### Scenario: Retail payments counted
- **WHEN** a POS sale is paid 500,000 by cash and 1,000,000 by card
- **THEN** the report shows cash 500,000 and card 1,000,000 for retail

### Requirement: Top products
The system SHALL list the best-selling products and variants for the period, ranked by quantity sold or by net sales as chosen, with a limit on the number of rows.

#### Scenario: Ranking by net sales
- **WHEN** the top 10 by net sales is requested
- **THEN** up to 10 products are listed in descending order of net sales

### Requirement: Sales trends
The system SHALL report order count, net sales and average order value per day, week or month over the period, including periods with no sales as zero.

#### Scenario: Day with no sales
- **WHEN** a daily trend covers a day with no sales
- **THEN** that day appears with 0 orders and 0 net sales

### Requirement: Sales report access
Retail sales reports SHALL be available only to users with the sales-report permission.

#### Scenario: Technician denied
- **WHEN** a technician without the sales-report permission requests the sales summary
- **THEN** the request is refused
