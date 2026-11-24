# Spec Delta

## Purpose

Lets a product be sold and bought in more than one unit (piece, box of 10) while stock is kept in its base unit.

## ADDED Requirements

### Requirement: Units
A product SHALL have a base unit and MAY have conversion units with a factor, an optional barcode and an optional price.

#### Scenario: Box of 10
- **WHEN** a manager adds unit "hộp" with factor 10 and price 450,000 to stickers (base unit "cái", 50,000)
- **THEN** stickers can be sold by piece at 50,000 or by box at 450,000

### Requirement: Selling and buying in units
A sales or purchase line in a unit SHALL move stock by quantity × factor base units; its unit price SHALL be the unit's own price or the base price × factor. Returns SHALL restock quantity × factor.

#### Scenario: Sell 2 boxes
- **WHEN** a cashier sells 2 boxes of stickers
- **THEN** the line is 2 × 450,000 and sticker stock falls by 20

#### Scenario: Receive boxes
- **WHEN** a purchase order of 5 boxes is approved
- **THEN** sticker stock rises by 50
