-- Migration: Employee Payroll Management System
-- Description: Adds employee salary configs, attendance records, payroll periods, and payroll slips
-- Created: 2026-01-01

-- ====================
-- 1. ADD EMPLOYEE CODE TO USER_PROFILES
-- ====================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS employee_code VARCHAR(20) UNIQUE;

COMMENT ON COLUMN user_profiles.employee_code IS 'Employee code for attendance import matching (e.g., NV000003)';

-- ====================
-- 2. EMPLOYEE SALARY CONFIGURATION
-- ====================
CREATE TABLE IF NOT EXISTS employee_salary_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Salary type and base
  salary_type VARCHAR(20) NOT NULL DEFAULT 'monthly',  -- 'monthly', 'daily', 'hourly'
  base_salary DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Standard work configuration
  standard_work_days_per_month INT DEFAULT 26,
  standard_hours_per_day DECIMAL(4,2) DEFAULT 8.00,

  -- Overtime rates (multipliers)
  overtime_rate_weekday DECIMAL(4,2) DEFAULT 1.50,     -- 150% of hourly rate
  overtime_rate_weekend DECIMAL(4,2) DEFAULT 2.00,     -- 200% of hourly rate
  overtime_rate_holiday DECIMAL(4,2) DEFAULT 3.00,     -- 300% of hourly rate

  -- Allowances
  lunch_allowance DECIMAL(12,2) DEFAULT 0,
  transport_allowance DECIMAL(12,2) DEFAULT 0,
  phone_allowance DECIMAL(12,2) DEFAULT 0,
  other_allowances JSONB DEFAULT '{}',

  -- Insurance rates (employee contribution)
  social_insurance_rate DECIMAL(5,4) DEFAULT 0.080,    -- 8%
  health_insurance_rate DECIMAL(5,4) DEFAULT 0.015,    -- 1.5%
  unemployment_insurance_rate DECIMAL(5,4) DEFAULT 0.010, -- 1%

  -- Effective dates
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,

  -- Metadata
  notes TEXT,
  created_by_id UUID REFERENCES user_profiles(id),
  updated_by_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_salary_type CHECK (salary_type IN ('monthly', 'daily', 'hourly')),
  CONSTRAINT chk_base_salary_positive CHECK (base_salary >= 0)
);

CREATE INDEX IF NOT EXISTS idx_salary_configs_employee ON employee_salary_configs(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_configs_effective ON employee_salary_configs(effective_from, effective_to);

COMMENT ON TABLE employee_salary_configs IS 'Employee salary configurations and rates';

-- ====================
-- 3. PAYROLL PERIOD STATUS ENUM
-- ====================
DO $$ BEGIN
  CREATE TYPE payroll_period_status AS ENUM (
    'draft',              -- Initial state, attendance can be imported/re-imported
    'published',          -- Published to employees for review
    'finalized',          -- All confirmed, ready for payment
    'paid'                -- Payment completed
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ====================
-- 4. PAYROLL PERIODS
-- ====================
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Period identification
  period_code VARCHAR(20) NOT NULL UNIQUE,  -- e.g., 'PP2026-01' for January 2026
  period_name VARCHAR(100) NOT NULL,        -- e.g., 'Lương Tháng 1/2026'
  period_year INT NOT NULL,
  period_month INT NOT NULL,

  -- Period dates
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,

  -- Deadlines
  confirmation_deadline TIMESTAMPTZ,        -- Deadline for employees to confirm

  -- Status
  status payroll_period_status NOT NULL DEFAULT 'draft',

  -- Workflow timestamps
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES user_profiles(id),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES user_profiles(id),
  finalize_reason TEXT,                     -- Required if override
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES user_profiles(id),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),

  -- Statistics (calculated)
  total_employees INT DEFAULT 0,
  total_confirmed INT DEFAULT 0,
  total_disputed INT DEFAULT 0,
  total_gross_pay DECIMAL(18,2) DEFAULT 0,
  total_net_pay DECIMAL(18,2) DEFAULT 0,

  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  created_by_id UUID REFERENCES user_profiles(id),
  updated_by_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_period_month CHECK (period_month >= 1 AND period_month <= 12),
  CONSTRAINT chk_period_dates CHECK (period_end_date >= period_start_date),
  CONSTRAINT unique_period_year_month UNIQUE (period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_year_month ON payroll_periods(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_code ON payroll_periods(period_code);

COMMENT ON TABLE payroll_periods IS 'Monthly payroll periods with workflow status';

-- ====================
-- 5. ATTENDANCE TYPE ENUM
-- ====================
DO $$ BEGIN
  CREATE TYPE attendance_type AS ENUM (
    'regular',            -- Normal work day (X mark)
    'check_in_only',      -- Checked in only (CV mark)
    'check_out_only',     -- Checked out only (CR mark)
    'leave_paid',         -- Paid leave (P mark)
    'leave_unpaid',       -- Unpaid leave/absence (O mark)
    'holiday',            -- Public holiday
    'absent',             -- Unexcused absence
    'day_off'             -- Scheduled day off
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ====================
-- 6. ATTENDANCE RECORDS
-- ====================
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Date and type
  work_date DATE NOT NULL,
  attendance_type attendance_type NOT NULL DEFAULT 'regular',

  -- Hours worked
  regular_hours DECIMAL(5,2) DEFAULT 0,
  overtime_hours DECIMAL(5,2) DEFAULT 0,

  -- Time tracking (optional)
  check_in_time TIME,
  check_out_time TIME,

  -- Late/Early metrics (in minutes)
  late_minutes INT DEFAULT 0,
  early_leave_minutes INT DEFAULT 0,

  -- Import metadata
  import_batch_id UUID,                     -- Links records from same import
  source_row_number INT,                    -- Row number in source file
  source_employee_code VARCHAR(50),         -- Employee code from source
  raw_data JSONB,                           -- Original row data

  -- Validation
  validation_status VARCHAR(20) DEFAULT 'valid',  -- 'valid', 'warning', 'error'
  validation_notes TEXT,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_attendance_per_day UNIQUE (payroll_period_id, employee_id, work_date),
  CONSTRAINT chk_hours_non_negative CHECK (regular_hours >= 0 AND overtime_hours >= 0)
);

CREATE INDEX IF NOT EXISTS idx_attendance_period ON attendance_records(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_import_batch ON attendance_records(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_period_employee ON attendance_records(payroll_period_id, employee_id);

COMMENT ON TABLE attendance_records IS 'Daily attendance records imported from external systems';

-- ====================
-- 7. ATTENDANCE IMPORT LOGS
-- ====================
CREATE TABLE IF NOT EXISTS attendance_import_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,

  -- Import details
  file_name VARCHAR(255) NOT NULL,
  file_size INT,
  file_type VARCHAR(50),                    -- 'csv', 'xlsx', 'xls'

  -- Statistics
  total_rows INT DEFAULT 0,
  successful_rows INT DEFAULT 0,
  warning_rows INT DEFAULT 0,
  error_rows INT DEFAULT 0,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'processing',  -- 'processing', 'completed', 'failed'
  error_message TEXT,

  -- Result data
  import_summary JSONB,                     -- Detailed import statistics
  error_details JSONB,                      -- List of row errors

  -- Metadata
  imported_by UUID NOT NULL REFERENCES user_profiles(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_period ON attendance_import_logs(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_status ON attendance_import_logs(status);

COMMENT ON TABLE attendance_import_logs IS 'Log of attendance file imports with status and errors';

-- ====================
-- 8. PAYROLL SLIP STATUS ENUM
-- ====================
DO $$ BEGIN
  CREATE TYPE payroll_slip_status AS ENUM (
    'draft',              -- Generated but not published
    'published',          -- Published for employee review
    'disputed',           -- Employee raised dispute
    'confirmed',          -- Employee confirmed
    'finalized',          -- Admin finalized
    'paid'                -- Payment completed
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ====================
-- 9. PAYROLL SLIPS
-- ====================
CREATE TABLE IF NOT EXISTS payroll_slips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  salary_config_id UUID REFERENCES employee_salary_configs(id),

  -- Status
  status payroll_slip_status NOT NULL DEFAULT 'draft',

  -- Attendance Summary
  total_work_days DECIMAL(5,2) DEFAULT 0,
  total_regular_hours DECIMAL(6,2) DEFAULT 0,
  total_overtime_hours DECIMAL(6,2) DEFAULT 0,
  total_leave_days DECIMAL(5,2) DEFAULT 0,
  total_absent_days DECIMAL(5,2) DEFAULT 0,
  total_late_minutes INT DEFAULT 0,

  -- Earnings breakdown
  base_salary_amount DECIMAL(15,2) DEFAULT 0,
  attendance_earnings DECIMAL(15,2) DEFAULT 0,      -- Prorated based on attendance
  overtime_earnings DECIMAL(15,2) DEFAULT 0,
  bonus_amount DECIMAL(15,2) DEFAULT 0,
  allowances_amount DECIMAL(15,2) DEFAULT 0,
  other_earnings DECIMAL(15,2) DEFAULT 0,
  gross_pay DECIMAL(15,2) DEFAULT 0,

  -- Deductions breakdown
  social_insurance_deduction DECIMAL(15,2) DEFAULT 0,
  health_insurance_deduction DECIMAL(15,2) DEFAULT 0,
  unemployment_insurance_deduction DECIMAL(15,2) DEFAULT 0,
  tax_deduction DECIMAL(15,2) DEFAULT 0,
  advance_deduction DECIMAL(15,2) DEFAULT 0,        -- Salary advance already paid
  absence_deduction DECIMAL(15,2) DEFAULT 0,
  late_deduction DECIMAL(15,2) DEFAULT 0,
  other_deductions DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,

  -- Net pay
  net_pay DECIMAL(15,2) DEFAULT 0,

  -- Detailed breakdown (JSONB for flexibility)
  earnings_details JSONB DEFAULT '{}',
  deductions_details JSONB DEFAULT '{}',
  allowances_details JSONB DEFAULT '{}',

  -- Calculation metadata
  calculation_notes TEXT,
  calculated_at TIMESTAMPTZ,

  -- Employee confirmation
  confirmed_at TIMESTAMPTZ,
  confirmation_comment TEXT,
  is_late_confirmation BOOLEAN DEFAULT FALSE,

  -- Dispute handling
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMPTZ,
  dispute_resolution TEXT,
  dispute_resolved_by UUID REFERENCES user_profiles(id),

  -- Admin adjustments
  adjustment_amount DECIMAL(15,2) DEFAULT 0,
  adjustment_reason TEXT,
  adjusted_by UUID REFERENCES user_profiles(id),
  adjusted_at TIMESTAMPTZ,

  -- Finalization
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES user_profiles(id),

  -- Payment
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES user_profiles(id),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_slip_per_period UNIQUE (payroll_period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_slips_period ON payroll_slips(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_slips_employee ON payroll_slips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_slips_status ON payroll_slips(status);
CREATE INDEX IF NOT EXISTS idx_payroll_slips_period_status ON payroll_slips(payroll_period_id, status);

COMMENT ON TABLE payroll_slips IS 'Individual employee payroll slips with earnings and deductions';

-- ====================
-- 10. PAYROLL ADJUSTMENTS LOG
-- ====================
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_slip_id UUID NOT NULL REFERENCES payroll_slips(id) ON DELETE CASCADE,

  -- Adjustment details
  adjustment_type VARCHAR(50) NOT NULL,     -- 'bonus', 'deduction', 'correction', 'allowance'
  amount DECIMAL(15,2) NOT NULL,
  reason TEXT NOT NULL,

  -- Before/After for audit
  previous_net_pay DECIMAL(15,2),
  new_net_pay DECIMAL(15,2),

  -- Metadata
  adjusted_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_slip ON payroll_adjustments(payroll_slip_id);

COMMENT ON TABLE payroll_adjustments IS 'Audit log of all payroll slip adjustments';

-- ====================
-- 11. UPDATE TRIGGERS
-- ====================

-- Update timestamp trigger for all tables
CREATE OR REPLACE FUNCTION update_payroll_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_salary_configs_updated ON employee_salary_configs;
CREATE TRIGGER trg_salary_configs_updated
BEFORE UPDATE ON employee_salary_configs
FOR EACH ROW EXECUTE FUNCTION update_payroll_timestamp();

DROP TRIGGER IF EXISTS trg_payroll_periods_updated ON payroll_periods;
CREATE TRIGGER trg_payroll_periods_updated
BEFORE UPDATE ON payroll_periods
FOR EACH ROW EXECUTE FUNCTION update_payroll_timestamp();

DROP TRIGGER IF EXISTS trg_attendance_records_updated ON attendance_records;
CREATE TRIGGER trg_attendance_records_updated
BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION update_payroll_timestamp();

DROP TRIGGER IF EXISTS trg_payroll_slips_updated ON payroll_slips;
CREATE TRIGGER trg_payroll_slips_updated
BEFORE UPDATE ON payroll_slips
FOR EACH ROW EXECUTE FUNCTION update_payroll_timestamp();

-- ====================
-- 12. PERIOD STATISTICS UPDATE FUNCTION
-- ====================
CREATE OR REPLACE FUNCTION update_payroll_period_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_period_id UUID;
BEGIN
  target_period_id := COALESCE(NEW.payroll_period_id, OLD.payroll_period_id);

  UPDATE payroll_periods SET
    total_employees = (
      SELECT COUNT(*) FROM payroll_slips WHERE payroll_period_id = target_period_id
    ),
    total_confirmed = (
      SELECT COUNT(*) FROM payroll_slips
      WHERE payroll_period_id = target_period_id
      AND status IN ('confirmed', 'finalized', 'paid')
    ),
    total_disputed = (
      SELECT COUNT(*) FROM payroll_slips
      WHERE payroll_period_id = target_period_id
      AND status = 'disputed'
    ),
    total_gross_pay = (
      SELECT COALESCE(SUM(gross_pay), 0) FROM payroll_slips
      WHERE payroll_period_id = target_period_id
    ),
    total_net_pay = (
      SELECT COALESCE(SUM(net_pay), 0) FROM payroll_slips
      WHERE payroll_period_id = target_period_id
    ),
    updated_at = NOW()
  WHERE id = target_period_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_period_stats ON payroll_slips;
CREATE TRIGGER trg_update_period_stats
AFTER INSERT OR UPDATE OR DELETE ON payroll_slips
FOR EACH ROW EXECUTE FUNCTION update_payroll_period_stats();

-- ====================
-- 13. GRANT PERMISSIONS (if using RLS)
-- ====================
-- Note: Add any necessary RLS policies here if required
