# Spec Delta

## Purpose

Gives owners and finance correct revenue, gross profit and VAT figures for retail and workshop, separately and combined.

## ADDED Requirements

### Requirement: Revenue by business line
The revenue report SHALL show retail net sales (from revenue-bearing sales orders) and workshop revenue (from delivered service orders) separately and their combined total, for the period and optional branch.

#### Scenario: Combined revenue
- **WHEN** a month has 40,000,000 retail net sales and 25,000,000 workshop revenue
- **THEN** the report shows 40,000,000, 25,000,000 and a combined 65,000,000

### Requirement: Money received
The revenue report SHALL show money received in the period per payment method, separately for retail payments and workshop payments, and combined.

#### Scenario: Received differs from sales
- **WHEN** a retail sale of 3,000,000 in the period was paid only 1,000,000 so far
- **THEN** retail net sales includes 3,000,000 and money received includes 1,000,000

### Requirement: Cost of goods sold at time of sale
Gross profit SHALL be net sales minus cost of goods sold, where the cost of each sold item is the cost recorded on its stock movement when it was sold. Changing a product's cost later SHALL NOT change past gross profit. Sales recorded before cost was captured SHALL use the product's current cost and SHALL be flagged as estimated.

#### Scenario: Cost changed after the sale
- **WHEN** an item sold at cost 200,000 later has its cost changed to 250,000
- **THEN** the gross profit of the earlier sale still uses 200,000

#### Scenario: Historical sale without recorded cost
- **WHEN** a period includes sales recorded before cost capture existed
- **THEN** their cost uses the current product cost and the report marks COGS as partly estimated

### Requirement: VAT from recorded tax
The VAT report SHALL total the tax amounts recorded on revenue-bearing sales orders, per day and for the period. It SHALL NOT assume a fixed rate.

#### Scenario: Mixed tax
- **WHEN** one order recorded 80,000 tax and another recorded none
- **THEN** VAT for the period is 80,000

### Requirement: Dashboard KPIs
The dashboard SHALL show today's and month-to-date retail net sales, order count and average order value, workshop revenue, stock value and low-stock count, using the same rules as the detailed reports and Vietnam time.

#### Scenario: KPIs match reports
- **WHEN** the dashboard shows month-to-date retail net sales
- **THEN** it equals the sales summary's net sales for the same month and branch

### Requirement: Financial report access
Financial reports (revenue, gross profit, VAT) SHALL be available only to users with the financial-report permission.

#### Scenario: Store staff denied profit
- **WHEN** a sales associate requests the gross profit report
- **THEN** the request is refused
