-- Create user profile for manager@saigonclassic.local
-- Run this in Supabase Studio SQL Editor

INSERT INTO user_profiles (id, full_name, role, phone, email, is_active)
VALUES (
  'ccf8bd00-40e3-4469-826b-65b554e5e1e6',
  'Manager User',
  'manager',
  '+84901234567',
  'manager@saigonclassic.local',
  true
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active;
