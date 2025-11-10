-- Migration: Add assigned_employee_id to service_items
-- Description: Allows tasks/service items to be assigned to specific employees

-- Add assigned_employee_id column to service_items table
ALTER TABLE service_items
ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_service_items_assigned_employee
ON service_items(assigned_employee_id);

-- Add comment
COMMENT ON COLUMN service_items.assigned_employee_id IS 'ID of the employee assigned to this specific task';
