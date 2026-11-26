# inventory/barcodes Specification

## Purpose

Lets every product, variant and selling unit carry a barcode that scanners can read at the POS, in counts, transfers and receiving, and prints labels.

## Requirements

### Requirement: Barcodes
Products, variants and selling units SHALL be able to have a barcode, entered or generated (EAN-13), unique across all of them.

#### Scenario: Duplicate refused
- **WHEN** a manager gives a variant the barcode of another product
- **THEN** it is refused

#### Scenario: Generate
- **WHEN** a manager generates a barcode for a product without one
- **THEN** it gets a valid 13-digit EAN starting with 20

### Requirement: Scanning
Looking up a code SHALL find the product, variant or unit by barcode or SKU, and product search at the POS SHALL add the scanned item.

#### Scenario: Scan at POS
- **WHEN** a cashier scans the barcode of jeans size 32
- **THEN** that variant is added to the cart

### Requirement: Labels
Staff with `inventory:labels` SHALL print barcode labels showing name, price and barcode for selected products, a purchase order or a transfer, with a number of labels per item, on a roll or an A4 sheet.

#### Scenario: Labels for a delivery
- **WHEN** a purchase order of 12 helmets and 30 gloves is received
- **THEN** staff can print 12 helmet labels and 30 glove labels in one go
