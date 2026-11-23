# reporting/inventory-reports Specification

## Purpose

Gives managers and warehouse staff accurate stock figures: value on hand, movements, low stock and turnover, per location.

## Requirements

### Requirement: Stock valuation
The system SHALL report the quantity on hand and its value at cost per product or variant, per location and in total. Variants SHALL be valued at their own cost when they have one, otherwise at the product's cost.

#### Scenario: Variant with its own cost
- **WHEN** a variant with cost 400,000 has 3 units at HCMC
- **THEN** its stock value at HCMC is 1,200,000

#### Scenario: Location filter
- **WHEN** valuation is requested for the Hanoi location
- **THEN** only Hanoi stock is included

### Requirement: Stock movement
The system SHALL list stock movements for a period with date, product or variant, location, movement type, quantity, unit cost and source document, filterable by product, location and type, and SHALL return them in pages.

#### Scenario: Paged movements
- **WHEN** a period has 5,000 movements and page 1 of size 50 is requested
- **THEN** 50 movements and the total count of 5,000 are returned

### Requirement: Low stock
The system SHALL list products and variants whose quantity on hand at a location is at or below their reorder point, with the reorder point and the shortfall.

#### Scenario: At reorder point
- **WHEN** a product's reorder point is 5 and HCMC has 5 on hand
- **THEN** it is listed for HCMC

### Requirement: Inventory turnover
The system SHALL report, per product, units sold in the period, cost of goods sold, average stock on hand across locations and the turnover ratio. Units sold SHALL be counted once regardless of how many locations hold the product.

#### Scenario: Product stocked in two locations
- **WHEN** a product stocked in HCMC and Hanoi sold 10 units in the period
- **THEN** units sold is 10, not 20

### Requirement: Inventory report access
Inventory reports SHALL be available only to users with the inventory-report permission.

#### Scenario: Sales associate denied
- **WHEN** a sales associate without the inventory-report permission requests stock valuation
- **THEN** the request is refused
