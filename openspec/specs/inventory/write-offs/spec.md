# inventory/write-offs Specification

## Purpose

Removes stock that will not be sold (damaged, lost, used internally, expired) with a reason, separately from count corrections.

## Requirements

### Requirement: Write-off
A write-off SHALL have a number `XH-YYMM-#####`, a location, a reason (damaged, lost, internal use, expired, other), a note and lines; it SHALL remove the quantities from stock at their current cost and record the total cost. Quantities SHALL NOT exceed available stock. It SHALL need `inventory:write_off`.

#### Scenario: Damaged helmets
- **WHEN** a store manager writes off 2 helmets at cost 800,000 as damaged
- **THEN** stock falls by 2 and the write-off shows a cost of 1,600,000

#### Scenario: Sales associate
- **WHEN** a sales associate tries to write off stock
- **THEN** it is refused with 403
