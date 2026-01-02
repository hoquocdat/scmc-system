# Epic: Employee Payroll Management

## Epic Description
As a business, we want to manage employee payroll based on imported attendance data, so that salary calculation is accurate, transparent, and confirmed by employees before payment.

This feature supports monthly payroll generation, employee review and confirmation, and admin finalization and payment tracking.

---

## High-Level Payroll Flow
Attendance Report Imported
↓
Payroll Period Generated
↓
Payroll Calculated
↓
Employee Reviews Payroll
↓
Employee Confirms
↓
Admin Finalizes
↓
Payroll Paid

---

## Core Concepts

- **Payroll Period**: Monthly (e.g. January 2026)
- **Attendance Report**: Imported file (CSV / XLS)
- **Payroll Slip**: One per employee per payroll period
- **Payroll Status**:
  - Draft
  - Published
  - Employee Confirmed
  - Disputed
  - Finalized
  - Paid

---

## User Stories

---

### 1. Import Attendance Report

**As an** admin  
**I want** to import an attendance report for a payroll period  
**So that** payroll is calculated from actual working data.

#### Acceptance Criteria
- Admin can upload attendance report (CSV / XLS)
- System validates:
  - Employee identifier exists
  - Dates fall within selected payroll period
  - No duplicate attendance entries
- System shows import summary (success, warnings, errors)
- Admin can re-import attendance while payroll is in Draft
- Attendance data is locked after payroll is finalized

---

### 2. Generate Payroll for a Period

**As an** admin  
**I want** to generate payroll for the previous month  
**So that** employees can review their salary.

#### Acceptance Criteria
- Admin selects payroll month
- System generates payroll slips for all active employees
- Payroll status defaults to **Draft**
- Employees with missing attendance data are flagged
- Payroll can be regenerated while in Draft

---

### 3. Calculate Payroll Automatically

**As a** system  
**I want** to calculate payroll based on configured rules  
**So that** salary components are consistent and accurate.

#### Acceptance Criteria
- Payroll calculation supports:
  - Base salary (monthly / daily / hourly)
  - Attendance-based pay
  - Overtime (optional)
  - Deductions (absence, lateness, advances)
  - Bonuses (optional)
- Calculation rules are configurable
- Admin adjustments require reason and are audit logged
- Employees cannot edit payroll values

---

### 4. Publish Payroll to Employees

**As an** admin  
**I want** to publish payroll slips  
**So that** employees can review their payroll.

#### Acceptance Criteria
- Admin can publish payroll for a period
- Payroll status changes from **Draft → Published**
- Employees are notified
- Payroll becomes read-only except for admin adjustments

---

### 5. Employee Views Payroll

**As an** employee  
**I want** to view my payroll for last month  
**So that** I understand my salary details.

#### Acceptance Criteria
- Employee can view payroll history
- Payroll slip shows:
  - Attendance summary
  - Earnings breakdown
  - Deductions breakdown
  - Net pay
- Payroll is visible only to the owning employee
- Payroll values are read-only

---

### 6. Employee Confirms Payroll

**As an** employee  
**I want** to confirm my payroll before a deadline  
**So that** I acknowledge its accuracy.

#### Acceptance Criteria
- Employee can confirm payroll only when status is **Published**
- Confirmation records employee and timestamp
- Employee may add optional comment
- Payroll status changes to **Employee Confirmed**
- Late confirmation is flagged

---

### 7. Raise Payroll Dispute (Optional)

**As an** employee  
**I want** to raise a payroll dispute  
**So that** issues can be resolved before payment.

#### Acceptance Criteria
- Employee can raise dispute before confirming payroll
- Dispute includes reason and optional notes
- Payroll status changes to **Disputed**
- Admin can resolve dispute and republish payroll
- Dispute history is retained

---

### 8. Finalize Payroll

**As an** admin  
**I want** to finalize payroll  
**So that** salary can be paid.

#### Acceptance Criteria
- Payroll can be finalized when:
  - All employees have confirmed, or
  - Admin overrides with reason
- Finalized payroll is locked
- Payroll status changes to **Finalized**

---

### 9. Mark Payroll as Paid

**As an** admin  
**I want** to mark payroll as paid  
**So that** payment completion is tracked.

#### Acceptance Criteria
- Admin records payment date and method
- Payroll status changes to **Paid**
- Paid payroll cannot be edited
- Payment record is auditable

---

## Payroll Status Flow

Draft
↓
Published
↓
Employee Confirmed
↓
Finalized
↓
Paid

**Alternate Flows**
- Published → Disputed → Published
- Published → Finalized (Admin override)

---

## Key Business Rules

- Payroll is generated per calendar month
- Attendance data is the source of truth
- Employees can only see their own payroll
- Payroll confirmation deadline is configurable
- All payroll changes are audit logged

---

## Important Edge Cases

- Employee joins or leaves mid-month
- Missing or incomplete attendance data
- Re-import attendance after payroll generation
- Employee does not confirm before deadline
- Retroactive payroll adjustments
- Admin reopens payroll after dispute

---

## Future Enhancements

- Sales commission integration
- Payslip PDF export
- Tax and insurance deductions
- Bank transfer file export
- Payroll analytics dashboard