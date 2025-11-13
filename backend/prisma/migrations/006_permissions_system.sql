-- Migration: Add CASL-based Permission Management System
-- Description: Creates tables for permissions, roles, and user-role assignments
-- Date: 2025-01-12

-- Step 1: Add 'superadmin' to user_profiles role enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'superadmin';

-- Step 2: Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  resource VARCHAR(100) NOT NULL,  -- e.g., 'products', 'service_orders', 'pos'
  action VARCHAR(50) NOT NULL,     -- e.g., 'create', 'read', 'update', 'delete', 'manage'
  conditions JSONB,                -- CASL conditions for resource-level access (e.g., {"ownerId": "${userId}"})
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on resource and action for faster lookups
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);

-- Step 3: Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,  -- system roles (like 'manager', 'technician') can't be deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 4: Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Step 5: Create user_roles junction table (enables multi-role support)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES user_profiles(id),  -- who assigned this role
  PRIMARY KEY (user_id, role_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- Step 6: Create audit log for permission changes
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,  -- 'granted', 'revoked', 'role_assigned', 'role_removed'
  resource_type VARCHAR(100),   -- 'permission', 'role', 'user_role'
  resource_id UUID,
  changes JSONB,                -- stores what changed (before/after)
  performed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for audit log queries
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_user_id ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_performed_by ON permission_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_created_at ON permission_audit_log(created_at DESC);

-- Step 7: Insert default system roles (matching existing UserRole enum)
INSERT INTO roles (name, description, is_system) VALUES
  ('superadmin', 'Super Administrator with full system access', true),
  ('manager', 'Manager with oversight capabilities', true),
  ('sales', 'Sales staff for customer interactions', true),
  ('technician', 'Service technicians', true),
  ('finance', 'Finance and accounting staff', true),
  ('store_manager', 'Store/inventory manager', true),
  ('sales_associate', 'Sales associate for POS', true),
  ('warehouse_staff', 'Warehouse and inventory staff', true)
ON CONFLICT (name) DO NOTHING;

-- Step 8: Insert default permissions for all modules
-- Note: These are comprehensive permissions covering all 24 modules identified in the system

-- Products Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('products:read', 'products', 'read', 'View products'),
  ('products:create', 'products', 'create', 'Create new products'),
  ('products:update', 'products', 'update', 'Update existing products'),
  ('products:delete', 'products', 'delete', 'Delete products'),
  ('products:manage', 'products', 'manage', 'Full product management')
ON CONFLICT (name) DO NOTHING;

-- Product Categories Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('product_categories:read', 'product_categories', 'read', 'View product categories'),
  ('product_categories:create', 'product_categories', 'create', 'Create product categories'),
  ('product_categories:update', 'product_categories', 'update', 'Update product categories'),
  ('product_categories:delete', 'product_categories', 'delete', 'Delete product categories')
ON CONFLICT (name) DO NOTHING;

-- Brands Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('brands:read', 'brands', 'read', 'View brands'),
  ('brands:create', 'brands', 'create', 'Create brands'),
  ('brands:update', 'brands', 'update', 'Update brands'),
  ('brands:delete', 'brands', 'delete', 'Delete brands')
ON CONFLICT (name) DO NOTHING;

-- Suppliers Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('suppliers:read', 'suppliers', 'read', 'View suppliers'),
  ('suppliers:create', 'suppliers', 'create', 'Create suppliers'),
  ('suppliers:update', 'suppliers', 'update', 'Update suppliers'),
  ('suppliers:delete', 'suppliers', 'delete', 'Delete suppliers')
ON CONFLICT (name) DO NOTHING;

-- Inventory Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('inventory:read', 'inventory', 'read', 'View inventory levels'),
  ('inventory:adjust', 'inventory', 'adjust', 'Adjust inventory levels'),
  ('inventory:transfer', 'inventory', 'transfer', 'Transfer inventory between locations')
ON CONFLICT (name) DO NOTHING;

-- Stock Adjustments Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('stock_adjustments:read', 'stock_adjustments', 'read', 'View stock adjustments'),
  ('stock_adjustments:create', 'stock_adjustments', 'create', 'Create stock adjustments'),
  ('stock_adjustments:approve', 'stock_adjustments', 'approve', 'Approve stock adjustments')
ON CONFLICT (name) DO NOTHING;

-- POS (Point of Sale) Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('pos:read', 'pos', 'read', 'View POS transactions'),
  ('pos:create', 'pos', 'create', 'Create POS sales'),
  ('pos:void', 'pos', 'void', 'Void POS transactions'),
  ('pos:refund', 'pos', 'refund', 'Process refunds')
ON CONFLICT (name) DO NOTHING;

-- Sales Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('sales:read', 'sales', 'read', 'View sales data'),
  ('sales:create', 'sales', 'create', 'Create sales orders'),
  ('sales:update', 'sales', 'update', 'Update sales orders'),
  ('sales:delete', 'sales', 'delete', 'Delete sales orders')
ON CONFLICT (name) DO NOTHING;

-- Service Orders Module (CURRENTLY UNPROTECTED - CRITICAL)
INSERT INTO permissions (name, resource, action, description) VALUES
  ('service_orders:read', 'service_orders', 'read', 'View service orders'),
  ('service_orders:create', 'service_orders', 'create', 'Create service orders'),
  ('service_orders:update', 'service_orders', 'update', 'Update service orders'),
  ('service_orders:delete', 'service_orders', 'delete', 'Delete service orders'),
  ('service_orders:assign', 'service_orders', 'assign', 'Assign technicians to service orders'),
  ('service_orders:approve', 'service_orders', 'approve', 'Approve service work')
ON CONFLICT (name) DO NOTHING;

-- Service Items Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('service_items:read', 'service_items', 'read', 'View service items'),
  ('service_items:create', 'service_items', 'create', 'Create service items'),
  ('service_items:update', 'service_items', 'update', 'Update service items'),
  ('service_items:delete', 'service_items', 'delete', 'Delete service items')
ON CONFLICT (name) DO NOTHING;

-- Customers Module (CURRENTLY UNPROTECTED - CRITICAL)
INSERT INTO permissions (name, resource, action, description) VALUES
  ('customers:read', 'customers', 'read', 'View customers'),
  ('customers:create', 'customers', 'create', 'Create customers'),
  ('customers:update', 'customers', 'update', 'Update customers'),
  ('customers:delete', 'customers', 'delete', 'Delete customers')
ON CONFLICT (name) DO NOTHING;

-- Bike Owners Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('bike_owners:read', 'bike_owners', 'read', 'View bike owners'),
  ('bike_owners:create', 'bike_owners', 'create', 'Create bike owners'),
  ('bike_owners:update', 'bike_owners', 'update', 'Update bike owners'),
  ('bike_owners:delete', 'bike_owners', 'delete', 'Delete bike owners')
ON CONFLICT (name) DO NOTHING;

-- Bikes/Motorcycles Module (CURRENTLY UNPROTECTED - CRITICAL)
INSERT INTO permissions (name, resource, action, description) VALUES
  ('bikes:read', 'bikes', 'read', 'View motorcycles'),
  ('bikes:create', 'bikes', 'create', 'Register motorcycles'),
  ('bikes:update', 'bikes', 'update', 'Update motorcycle information'),
  ('bikes:delete', 'bikes', 'delete', 'Delete motorcycles')
ON CONFLICT (name) DO NOTHING;

-- Payments Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('payments:read', 'payments', 'read', 'View payments'),
  ('payments:create', 'payments', 'create', 'Process payments'),
  ('payments:void', 'payments', 'void', 'Void payments'),
  ('payments:refund', 'payments', 'refund', 'Process refunds')
ON CONFLICT (name) DO NOTHING;

-- Reports Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('reports:sales', 'reports', 'sales', 'View sales reports'),
  ('reports:inventory', 'reports', 'inventory', 'View inventory reports'),
  ('reports:financial', 'reports', 'financial', 'View financial reports'),
  ('reports:service', 'reports', 'service', 'View service reports'),
  ('reports:export', 'reports', 'export', 'Export reports')
ON CONFLICT (name) DO NOTHING;

-- Users Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('users:read', 'users', 'read', 'View users'),
  ('users:create', 'users', 'create', 'Create users'),
  ('users:update', 'users', 'update', 'Update users'),
  ('users:delete', 'users', 'delete', 'Delete users')
ON CONFLICT (name) DO NOTHING;

-- Permissions Management (superadmin only)
INSERT INTO permissions (name, resource, action, description) VALUES
  ('permissions:read', 'permissions', 'read', 'View permissions'),
  ('permissions:grant', 'permissions', 'grant', 'Grant permissions to users/roles'),
  ('permissions:revoke', 'permissions', 'revoke', 'Revoke permissions from users/roles'),
  ('permissions:manage', 'permissions', 'manage', 'Full permission management')
ON CONFLICT (name) DO NOTHING;

-- Roles Management (superadmin only)
INSERT INTO permissions (name, resource, action, description) VALUES
  ('roles:read', 'roles', 'read', 'View roles'),
  ('roles:create', 'roles', 'create', 'Create roles'),
  ('roles:update', 'roles', 'update', 'Update roles'),
  ('roles:delete', 'roles', 'delete', 'Delete roles'),
  ('roles:assign', 'roles', 'assign', 'Assign roles to users')
ON CONFLICT (name) DO NOTHING;

-- Settings Module
INSERT INTO permissions (name, resource, action, description) VALUES
  ('settings:read', 'settings', 'read', 'View system settings'),
  ('settings:update', 'settings', 'update', 'Update system settings')
ON CONFLICT (name) DO NOTHING;

-- Step 9: Assign default permissions to system roles
-- Superadmin gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- Manager role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'manager'
AND p.name IN (
  'products:read', 'products:update', 'products:manage',
  'service_orders:read', 'service_orders:create', 'service_orders:update', 'service_orders:assign', 'service_orders:approve',
  'service_items:read', 'service_items:create', 'service_items:update',
  'customers:read', 'customers:create', 'customers:update',
  'bike_owners:read', 'bike_owners:create', 'bike_owners:update',
  'bikes:read', 'bikes:create', 'bikes:update',
  'users:read',
  'reports:sales', 'reports:inventory', 'reports:service', 'reports:export'
)
ON CONFLICT DO NOTHING;

-- Sales role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'sales'
AND p.name IN (
  'pos:read', 'pos:create',
  'sales:read', 'sales:create', 'sales:update',
  'customers:read', 'customers:create', 'customers:update',
  'products:read',
  'inventory:read'
)
ON CONFLICT DO NOTHING;

-- Technician role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'technician'
AND p.name IN (
  'service_orders:read', 'service_orders:update',
  'service_items:read', 'service_items:create', 'service_items:update',
  'bikes:read',
  'products:read',
  'inventory:read'
)
ON CONFLICT DO NOTHING;

-- Finance role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'finance'
AND p.name IN (
  'payments:read', 'payments:create', 'payments:void', 'payments:refund',
  'pos:read',
  'sales:read',
  'reports:sales', 'reports:financial', 'reports:export'
)
ON CONFLICT DO NOTHING;

-- Store Manager role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'store_manager'
AND p.name IN (
  'products:read', 'products:create', 'products:update', 'products:delete',
  'product_categories:read', 'product_categories:create', 'product_categories:update',
  'brands:read', 'brands:create', 'brands:update',
  'suppliers:read', 'suppliers:create', 'suppliers:update',
  'inventory:read', 'inventory:adjust', 'inventory:transfer',
  'stock_adjustments:read', 'stock_adjustments:create', 'stock_adjustments:approve',
  'reports:inventory', 'reports:export'
)
ON CONFLICT DO NOTHING;

-- Sales Associate role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'sales_associate'
AND p.name IN (
  'pos:read', 'pos:create',
  'products:read',
  'customers:read', 'customers:create', 'customers:update',
  'inventory:read'
)
ON CONFLICT DO NOTHING;

-- Warehouse Staff role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'warehouse_staff'
AND p.name IN (
  'inventory:read', 'inventory:adjust', 'inventory:transfer',
  'stock_adjustments:read', 'stock_adjustments:create',
  'products:read',
  'suppliers:read'
)
ON CONFLICT DO NOTHING;

-- Step 10: Migrate existing users to new multi-role system
-- Copy existing single role to user_roles table
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT up.id, r.id, NOW()
FROM user_profiles up
JOIN roles r ON CAST(up.role AS TEXT) = r.name
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = up.id AND ur.role_id = r.id
);

COMMENT ON TABLE permissions IS 'Stores individual permissions that can be granted to roles or users';
COMMENT ON TABLE roles IS 'Stores role definitions with descriptions';
COMMENT ON TABLE role_permissions IS 'Maps permissions to roles for bulk assignment';
COMMENT ON TABLE user_roles IS 'Maps users to roles, enabling multi-role support';
COMMENT ON TABLE permission_audit_log IS 'Audit trail for all permission-related changes';
