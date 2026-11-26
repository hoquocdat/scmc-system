# reporting/report-export Specification

## Purpose

Lets users download any report they can view as an Excel or CSV file containing exactly the data shown for the same filters.

## Requirements

### Requirement: Export any report
Every report SHALL be downloadable as an Excel (.xlsx) file and as a CSV file, using the same filters as the on-screen report.

#### Scenario: Export filtered report
- **WHEN** a manager exports the March sales-by-category report for Hanoi as Excel
- **THEN** an .xlsx file downloads with the same rows and totals shown on screen for March and Hanoi

### Requirement: Export respects permissions
An export SHALL be allowed only when the user may view that report, and SHALL contain only the data that user may see.

#### Scenario: Export of a forbidden report
- **WHEN** a sales associate without the financial-report permission requests a gross profit export
- **THEN** the request is refused and no file is produced

### Requirement: Readable export files
Excel exports SHALL contain a header with the report name, branch, period and the time it was generated; column headers in the user's language; numbers and dates stored as numbers and dates (not text); and a totals row where the report has totals. CSV exports SHALL be UTF-8 so Vietnamese text opens correctly in Excel.

#### Scenario: Vietnamese names in CSV
- **WHEN** a CSV with customer names such as "Nguyễn Văn Ánh" is opened in Excel
- **THEN** the names display correctly

#### Scenario: Amounts are numbers
- **WHEN** an Excel export is opened
- **THEN** amount columns can be summed without conversion

### Requirement: Large exports
Exports SHALL include all rows matching the filters, not only the current page, up to a stated maximum. When the maximum is exceeded the export SHALL be refused with a message asking the user to narrow the filters.

#### Scenario: Paged report exported
- **WHEN** a stock movement report shows page 1 of 100 and the user exports it
- **THEN** the file contains all matching movements

#### Scenario: Too many rows
- **WHEN** the filters match more rows than the export maximum
- **THEN** no file is produced and the message states the maximum

### Requirement: Exports are logged
Each export SHALL be recorded in the activity log with the user, report, filters and format.

#### Scenario: Audit of an export
- **WHEN** a finance user exports the VAT report
- **THEN** the activity log shows who exported it, when, and with which filters
