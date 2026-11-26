# Spec Delta

## Purpose

Lets staff count the stock of a location (kiểm kho), compare it with the system and correct the system with traceable adjustments.

## ADDED Requirements

### Requirement: Starting a count
A count SHALL cover one location and either all its products or a category, a brand or a list of products, and SHALL have a number `KK-YYMM-#####`. A location SHALL have at most one open count.

#### Scenario: Count gloves at HCMC
- **WHEN** a store manager starts a count of category Gloves at HCMC
- **THEN** the count lists every active glove product with its system quantity

### Requirement: Entering counted quantities
Staff SHALL set or increase counted quantities, including by scanning a barcode, and each entry SHALL record the system quantity at that moment.

#### Scenario: Scan
- **WHEN** a staff member scans a helmet's barcode three times
- **THEN** the helmet's counted quantity is 3

### Requirement: Movements during the count
The adjustment for an item SHALL be its counted quantity minus the system quantity when it was counted, so sales and receipts during the count are not double counted. Items not counted SHALL not be adjusted.

#### Scenario: Sale after counting
- **WHEN** a helmet is counted at 5 with system 5, then one is sold before the count is completed
- **THEN** completing the count adjusts the helmet by 0 and stock stays at 4

#### Scenario: Shortage found
- **WHEN** gloves are counted at 7 with system 9
- **THEN** completing posts an adjustment of −2

### Requirement: Completing a count
Completing a count SHALL need `inventory:approve_count`, SHALL post one adjustment per item with a difference, linked to the count, and SHALL show the differences in quantity and in value at cost.

#### Scenario: Staff cannot approve
- **WHEN** a warehouse staff member completes a count
- **THEN** it is refused with 403
