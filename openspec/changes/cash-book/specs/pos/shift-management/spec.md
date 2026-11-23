# Spec Delta

## MODIFIED Requirements

### Requirement: Cash in and cash out
During an open shift, the cashier SHALL be able to record cash put into the drawer and cash taken out, each with an amount and a reason. Amounts SHALL be greater than zero. Each movement SHALL be recorded as a cash book entry on the branch's POS drawer account, linked to the shift; when another account of the branch is named (for example the safe), the movement SHALL be recorded as a transfer between the drawer and that account.

#### Scenario: Cash drop
- **WHEN** the cashier records a cash out of 5,000,000 VND with reason "move to safe"
- **THEN** the movement is recorded on the shift and the expected cash drops by 5,000,000

#### Scenario: Movement on a closed shift
- **WHEN** a cash movement is submitted for a closed shift
- **THEN** it is refused

#### Scenario: Cash drop into the safe
- **WHEN** the cashier records a cash out of 5,000,000 to the HCMC safe
- **THEN** a transfer from the HCMC POS drawer to the HCMC safe is recorded in the cash book, linked to the shift, and the safe balance increases by 5,000,000

### Requirement: Expected cash
The system SHALL compute a shift's expected cash as the opening cash plus all cash book receipts minus all cash book payments on the POS drawer account that are linked to the shift and not cancelled. Cash sale receipts SHALL be counted net of change given.

#### Scenario: Expected cash calculation
- **WHEN** a shift opened with 2,000,000, received 3,000,000 cash in sales with 200,000 change given, and had 1,000,000 cash out
- **THEN** expected cash is 3,800,000

#### Scenario: Workshop cash taken during the shift
- **WHEN** during the shift the cashier also records a 500,000 cash deposit on a service order of the same branch
- **THEN** expected cash includes the 500,000

### Requirement: Close a shift
A cashier SHALL close their open shift by entering the counted cash. The system SHALL record counted cash, expected cash and the difference, and the closed shift SHALL accept no more sales or movements. A non-zero difference SHALL be recorded as a cash book entry on the POS drawer with category "Chênh lệch kiểm quỹ" so the drawer balance matches the counted cash. Closing someone else's shift SHALL require manager permission.

#### Scenario: Close with shortage
- **WHEN** a shift with expected cash 3,800,000 is closed with 3,750,000 counted
- **THEN** the shift is closed with a difference of -50,000 and the close time

#### Scenario: Manager closes a forgotten shift
- **WHEN** a manager closes a cashier's shift left open from the previous day
- **THEN** the shift is closed and the manager is recorded as the one who closed it

#### Scenario: Shortage booked in the cash book
- **WHEN** a shift is closed 50,000 short
- **THEN** a 50,000 payment entry with category "Chênh lệch kiểm quỹ", linked to the shift, is recorded on the POS drawer

#### Scenario: Exact count
- **WHEN** a shift is closed with counted cash equal to expected cash
- **THEN** no difference entry is recorded
