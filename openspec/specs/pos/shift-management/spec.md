# pos/shift-management Specification

## Purpose

Tracks each cashier's shift at a branch, from opening cash to closing count, so every POS sale and drawer movement belongs to a shift and cash differences are visible.

## Requirements

### Requirement: Open a shift
A cashier SHALL open a shift by choosing a branch and declaring the opening cash. A user SHALL have at most one open shift at a time.

#### Scenario: Open shift
- **WHEN** a cashier with no open shift opens one at the HCMC branch with 2,000,000 VND
- **THEN** an open shift is recorded with a shift number, the cashier, the branch, the opening cash and the start time

#### Scenario: Second open shift refused
- **WHEN** a cashier who already has an open shift tries to open another
- **THEN** the request is refused and the existing open shift is shown

### Requirement: Sales belong to an open shift
Checkout SHALL require the cashier to have an open shift, and every POS sale and its payments SHALL be linked to that shift and its branch.

#### Scenario: No open shift
- **WHEN** a cashier without an open shift tries to check out
- **THEN** checkout is blocked and the POS offers to open a shift

#### Scenario: Sale linked to shift
- **WHEN** a sale is checked out during a shift
- **THEN** the sale's order records that shift and the shift's branch

### Requirement: Resume an open shift
When a cashier with an open shift opens the POS, on any device, the POS SHALL continue that shift instead of asking to open a new one.

#### Scenario: Resume after reload
- **WHEN** a cashier with an open shift reloads the POS
- **THEN** the POS shows the same shift as current

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

### Requirement: Shift summary
The system SHALL show, for an open or closed shift, the number of sales, total sales, amounts received per payment method, credit given, cash movements, expected cash and, when closed, counted cash and difference. The summary SHALL be printable.

#### Scenario: Summary by method
- **WHEN** a shift had sales paid by cash 3,000,000, card 2,000,000 and bank transfer 1,000,000
- **THEN** the summary shows those three amounts and a sales total of 6,000,000

### Requirement: Shift history
Users with permission SHALL be able to list shifts filtered by branch, cashier, status and date, and open any shift's summary and its sales.

#### Scenario: Find shifts with differences
- **WHEN** a manager lists closed shifts for the Hanoi branch last week
- **THEN** each shift shows its cashier, times, expected cash, counted cash and difference

### Requirement: Shift access control
Opening, closing and recording movements on one's own shift SHALL require POS permission; viewing other users' shifts and closing them SHALL require manager permission. Opening, cash movements and closing SHALL be recorded in the activity log.

#### Scenario: Cashier views another cashier's shift
- **WHEN** a sales associate without manager permission requests another cashier's shift summary
- **THEN** the request is refused
