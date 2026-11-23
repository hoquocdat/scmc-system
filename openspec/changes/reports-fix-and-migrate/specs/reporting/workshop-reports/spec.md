# Spec Delta

## Purpose

Gives managers workshop performance figures (service revenue, technician performance, parts used, bikes in service, turnaround) from the system's own backend.

## ADDED Requirements

### Requirement: Service revenue
The workshop revenue report SHALL count service orders delivered in the period, dated by their delivery date, using the final cost or, when there is none, the estimated cost. It SHALL show revenue, number of delivered orders, average order value and a monthly trend, filterable by branch.

#### Scenario: Delivered orders only
- **WHEN** a month has 3 delivered orders and 2 orders still in progress
- **THEN** revenue and order count include only the 3 delivered orders

#### Scenario: Dated by delivery
- **WHEN** an order received in February is delivered in March
- **THEN** its revenue appears in March

### Requirement: Technician performance
The system SHALL report, per technician, the delivered orders they were assigned to, the revenue of those orders, and their average turnaround in days. An order with several technicians SHALL count as one order for each of them, and its revenue SHALL be attributed to its primary technician only.

#### Scenario: Two technicians on one order
- **WHEN** an order of 4,000,000 had technicians A (primary) and B
- **THEN** both A and B have 1 order counted, A has 4,000,000 revenue and B has 0 from that order

### Requirement: Parts used in service
The system SHALL report the parts used on service orders in the period, with quantity, total cost and number of service orders using each part, ranked by total cost.

#### Scenario: Top parts
- **WHEN** the top 10 parts by cost is requested for March
- **THEN** up to 10 parts are listed with quantity, cost and number of orders

### Requirement: Bikes in service by status
The system SHALL report the current number of bikes in service per status, counting all service orders except delivered and cancelled, filterable by branch.

#### Scenario: Status breakdown
- **WHEN** there are 4 orders in progress, 2 waiting for parts and 5 delivered
- **THEN** the report shows in progress 4, waiting parts 2 and a total in service of 6

### Requirement: Turnaround time
The system SHALL report the average and median time from drop-off to delivery for orders delivered in the period, overall and per branch.

#### Scenario: Average turnaround
- **WHEN** two orders were delivered 2 and 4 days after drop-off
- **THEN** the average turnaround is 3 days

### Requirement: Workshop reports served by the backend
Workshop reports SHALL be served by the system's own reporting API, under the same authentication and permission checks as other reports, and SHALL NOT read the database directly from the browser.

#### Scenario: Unauthenticated request
- **WHEN** a workshop report is requested without a valid login
- **THEN** the request is refused
