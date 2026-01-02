-- Migration: Add employee code sequence and update column
-- Description: Creates a sequence for auto-generating 5-digit numeric employee codes

-- Create sequence for employee codes (starts at 1, max 99999)
CREATE SEQUENCE IF NOT EXISTS employee_code_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 99999
  NO CYCLE;

-- Update existing employee codes to 5-digit format if they exist
-- First, get the max numeric part from existing codes
DO $$
DECLARE
  max_code INTEGER := 0;
  current_code INTEGER;
BEGIN
  -- Find the maximum numeric employee code
  SELECT COALESCE(MAX(
    CASE
      WHEN employee_code ~ '^\d+$' THEN employee_code::INTEGER
      WHEN employee_code ~ 'NV(\d+)' THEN SUBSTRING(employee_code FROM 'NV(\d+)')::INTEGER
      ELSE 0
    END
  ), 0) INTO max_code
  FROM user_profiles
  WHERE employee_code IS NOT NULL;

  -- Set sequence to start after the max existing code
  IF max_code > 0 THEN
    PERFORM setval('employee_code_seq', max_code, true);
  END IF;
END $$;

-- Update column to VARCHAR(5) to enforce 5 characters
ALTER TABLE user_profiles
ALTER COLUMN employee_code TYPE VARCHAR(5);

-- Update comment
COMMENT ON COLUMN user_profiles.employee_code IS 'Employee code - 5 digit numeric string (e.g., 00001)';

-- Create function to generate next employee code
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS VARCHAR(5) AS $$
DECLARE
  next_val INTEGER;
  code VARCHAR(5);
BEGIN
  next_val := nextval('employee_code_seq');
  code := LPAD(next_val::TEXT, 5, '0');
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-generate employee code on insert
CREATE OR REPLACE FUNCTION set_employee_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
    NEW.employee_code := generate_employee_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_set_employee_code ON user_profiles;
CREATE TRIGGER trg_set_employee_code
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_employee_code();

-- Update existing employees without employee_code
UPDATE user_profiles
SET employee_code = generate_employee_code()
WHERE employee_code IS NULL;

-- Add check constraint for 5-digit numeric format
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS chk_employee_code_format;

ALTER TABLE user_profiles
ADD CONSTRAINT chk_employee_code_format
CHECK (employee_code IS NULL OR employee_code ~ '^\d{5}$');
