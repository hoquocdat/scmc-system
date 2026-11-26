# pricing/price-books Specification

## Purpose

Lets SCMC keep named price lists (bảng giá) for different branches, customer groups and periods, so special prices are set once instead of typed as discounts at every sale.

## Requirements

### Requirement: Price books
The system SHALL keep price books with a unique code, a name, a priority, an active flag, an optional start and end time, branch conditions (all branches or a list), customer conditions (all customers or a list of customer groups), and whether staff may choose the book manually at a sale.

#### Scenario: Wholesale book
- **WHEN** a manager creates "Giá sỉ" with priority 10, all branches, customer group "Wholesale", manual selection allowed
- **THEN** the book is listed with those conditions and 0 entries

#### Scenario: Duplicate code refused
- **WHEN** a manager creates a second book with the code of an existing one
- **THEN** the creation is refused

#### Scenario: End before start refused
- **WHEN** a manager saves a book whose end time is before its start time
- **THEN** the change is refused

### Requirement: Price book entries
A price book SHALL hold at most one entry per product and per variant. An entry SHALL be either a fixed price or a rule relative to the base price: percent off (0–100) or amount off. An entry on a product SHALL apply to all its variants that have no entry of their own.

#### Scenario: Fixed and relative entries
- **WHEN** a manager adds to "Giá sỉ" helmet H1 at fixed 1,800,000 and gloves G1 at 15 percent off
- **THEN** the book lists both, with the resulting price of each computed from the current base price

#### Scenario: Invalid percent refused
- **WHEN** a manager enters 120 percent off
- **THEN** the entry is refused

### Requirement: Bulk add and edit
Managers SHALL be able to add many products to a book at once (selected products, or all products of a category or brand) with one rule, edit an entry's mode and value, and remove entries.

#### Scenario: Whole category
- **WHEN** a manager adds category "Găng tay" (12 products) to "VIP" with 10 percent off
- **THEN** 12 entries are created, and products already in the book keep their existing entries

### Requirement: Import and export
A book's entries SHALL be exportable to xlsx and importable from xlsx with columns SKU, variant SKU (optional), mode and value. An import SHALL either apply all rows or none, and SHALL report each invalid row.

#### Scenario: Import with an unknown SKU
- **WHEN** a manager imports a file of 200 rows where row 17 has an unknown SKU
- **THEN** nothing is written and the result names row 17 and the reason

#### Scenario: Round trip
- **WHEN** a manager exports a book and imports the same file
- **THEN** the entries are unchanged

### Requirement: Price book permissions
Reading price books SHALL require `price_books:read`; creating, updating and deleting books and entries SHALL require `price_books:create`, `price_books:update` and `price_books:delete`.

#### Scenario: Sales associate cannot edit
- **WHEN** a sales associate tries to change an entry
- **THEN** the request is refused with 403
