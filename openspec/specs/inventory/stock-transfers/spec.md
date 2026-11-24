# inventory/stock-transfers Specification

## Purpose

Moves stock between SCMC locations (HCMC, Hanoi, workshop, warehouse) with a shipping step and a receiving step, so stock in transit and losses are visible.

## Requirements

### Requirement: Transfer lifecycle
A transfer SHALL have a number `CK-YYMM-#####`, a source and a different destination, lines with requested quantities, and the states pending, in transit, partially received, received and cancelled. Shipping SHALL remove the shipped quantities from the source; receiving SHALL add the received quantities at the destination.

#### Scenario: Ship and receive
- **WHEN** 10 helmets are shipped from HCMC to Hanoi and all 10 are received
- **THEN** HCMC stock falls by 10 at shipping, Hanoi stock rises by 10 at receiving, and the transfer is received

#### Scenario: Not enough at the source
- **WHEN** staff ship 10 helmets and HCMC has 6 available
- **THEN** shipping is refused naming the helmet and the 6 available

### Requirement: Partial receiving and discrepancies
Receiving SHALL accept quantities up to what was shipped, in one or several steps. Closing a transfer with units not received SHALL record them as a discrepancy.

#### Scenario: Two missing
- **WHEN** 10 were shipped, 8 are received and the transfer is closed
- **THEN** Hanoi rises by 8, the line shows a discrepancy of 2 and the transfer is received

### Requirement: Cancelling a transfer
A pending transfer SHALL be cancellable without stock effect. Cancelling a transfer in transit SHALL return the shipped but unreceived units to the source.

#### Scenario: Cancel in transit
- **WHEN** a transfer of 5 in transit with nothing received is cancelled
- **THEN** the 5 return to the source
