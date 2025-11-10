-- Seed Employees for Testing
-- This script creates dummy employees with various roles

-- Insert dummy technicians
INSERT INTO user_profiles (id, full_name, email, phone, role, is_active, created_at, updated_at)
VALUES
  -- Technicians
  ('11111111-1111-1111-1111-111111111111', 'Nguyễn Văn An', 'technician1@scmc.vn', '0901234567', 'technician', true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'Trần Minh Bảo', 'technician2@scmc.vn', '0901234568', 'technician', true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'Lê Hoàng Cường', 'technician3@scmc.vn', '0901234569', 'technician', true, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', 'Phạm Đức Dũng', 'technician4@scmc.vn', '0901234570', 'technician', true, NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', 'Võ Thành Đạt', 'technician5@scmc.vn', '0901234571', 'technician', true, NOW(), NOW()),

  -- Sales Staff
  ('66666666-6666-6666-6666-666666666666', 'Hoàng Thị Lan', 'sales1@scmc.vn', '0902345678', 'sales', true, NOW(), NOW()),
  ('77777777-7777-7777-7777-777777777777', 'Đỗ Văn Hùng', 'sales2@scmc.vn', '0902345679', 'sales', true, NOW(), NOW()),

  -- Manager
  ('88888888-8888-8888-8888-888888888888', 'Ngô Quang Minh', 'manager@scmc.vn', '0903456789', 'manager', true, NOW(), NOW()),

  -- Finance
  ('99999999-9999-9999-9999-999999999999', 'Bùi Thị Nga', 'finance@scmc.vn', '0904567890', 'finance', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Display created employees
SELECT id, full_name, email, role, is_active
FROM user_profiles
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666',
  '77777777-7777-7777-7777-777777777777',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999'
)
ORDER BY role, full_name;
