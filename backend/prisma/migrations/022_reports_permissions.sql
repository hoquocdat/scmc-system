-- Migration: Report permissions
-- Description: Aligns report permission grants with the reporting design
--   (openspec/changes/reports-fix-and-migrate/design.md, D9).
--   The permission rows reports:sales|inventory|financial|service|export already
--   exist from 008_permissions_system.sql; this migration only adds grants.
--
--   manager, finance   -> all report actions
--   store_manager      -> sales, inventory, service, export
--   warehouse_staff    -> inventory

-- Make sure the permission rows exist (no-op on databases seeded by 008)
INSERT INTO permissions (name, resource, action, description) VALUES
  ('reports:sales', 'reports', 'sales', 'View sales reports'),
  ('reports:inventory', 'reports', 'inventory', 'View inventory reports'),
  ('reports:financial', 'reports', 'financial', 'View financial reports'),
  ('reports:service', 'reports', 'service', 'View service reports'),
  ('reports:export', 'reports', 'export', 'Export reports')
ON CONFLICT (name) DO NOTHING;

-- Manager and Finance: every report action
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('manager', 'finance')
  AND p.resource = 'reports'
ON CONFLICT DO NOTHING;

-- Store Manager: sales, inventory, service, export
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'store_manager'
  AND p.name IN ('reports:sales', 'reports:inventory', 'reports:service', 'reports:export')
ON CONFLICT DO NOTHING;

-- Warehouse Staff: inventory
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'warehouse_staff'
  AND p.name = 'reports:inventory'
ON CONFLICT DO NOTHING;

-- Superadmin keeps everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'superadmin'
  AND p.resource = 'reports'
ON CONFLICT DO NOTHING;
