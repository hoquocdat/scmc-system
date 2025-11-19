# Roles and Permissions Seed Command

## Overview

The `seed:roles-permissions` command seeds the database with predefined roles and permissions for the SCMC Workshop Management System.

## Usage

```bash
# Run the seed command
npm run cli:seed-roles-permissions

# Or run with all seeds
npm run cli:seed-all
```

## What Gets Seeded

### Permissions (100+ permissions)

The command creates permissions for the following resources:

- **Service Orders**: create, read, update, delete, assign, approve
- **Customers**: create, read, update, delete
- **Bikes**: create, read, update, delete
- **Parts/Inventory**: create, read, update, delete, adjust
- **Payments**: create, read, update, void, refund
- **POS**: sessions and transactions management
- **Sales Orders**: create, read, update, delete
- **Reports**: read, export
- **Users/Roles**: manage users, permissions, and roles

### Roles (5 system roles)

#### 1. Sales Staff (`sales`)
**Description**: Can create service orders, register customers, and schedule appointments

**Permissions**:
- Service Orders: create, read, update
- Customers: create, read, update
- Bikes: create, read, update
- Parts: read

#### 2. Technician (`technician`)
**Description**: Can view assigned work, update progress, and record parts usage

**Permissions**:
- Service Orders: read, update
- Customers: read
- Bikes: read
- Parts: read, update

#### 3. Manager (`manager`)
**Description**: Can monitor all operations, assign technicians, approve work, and view analytics

**Permissions**:
- Service Orders: create, read, update, delete, assign, approve
- Customers: create, read, update, delete
- Bikes: create, read, update, delete
- Parts: create, read, update, delete, adjust
- Payments: read
- POS: read sessions and transactions
- Sales Orders: read
- Reports: read, export
- Users: read
- Permissions/Roles: read

#### 4. Finance (`finance`)
**Description**: Can process payments, generate invoices, and track receivables

**Permissions**:
- Service Orders: read
- Customers: read
- Bikes: read
- Payments: create, read, update, void, refund
- POS: full access to sessions and transactions
- Sales Orders: create, read, update
- Reports: read, export

#### 5. Admin (`admin`)
**Description**: Full system access

**Permissions**: All permissions

## Permission Naming Convention

Permissions follow the format: `resource:action`

Examples:
- `service_orders:create`
- `customers:read`
- `payments:refund`

## Database Schema

### Permissions Table
```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  conditions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Roles Table
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Role Permissions Junction Table
```sql
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id),
  permission_id UUID REFERENCES permissions(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);
```

## Features

### Idempotent Seeding
The command is idempotent - you can run it multiple times safely:
- Existing permissions/roles are not duplicated
- Permission assignments are synchronized (adds missing, removes extra)
- Role descriptions are updated if changed

### Auto-sync Permissions
When you run the seed:
1. Checks if permission exists
2. Creates if missing
3. Updates role-permission mappings
4. Removes permissions no longer assigned to a role

## Adding New Permissions

To add new permissions, edit the `permissions` array in `seed-roles-permissions.command.ts`:

```typescript
{
  name: 'invoices:create',
  resource: 'invoices',
  action: 'create',
  description: 'Create invoices'
}
```

Then update the relevant role's permissions array:

```typescript
{
  name: 'finance',
  permissions: [
    // ... existing permissions
    'invoices:create',
  ]
}
```

## Verification

After running the seed, verify with:

```bash
# Check roles
npm run cli -- seed:verify

# Or query the database directly
psql -U backbone_user -d scmc_sms -c "SELECT COUNT(*) FROM roles;"
psql -U backbone_user -d scmc_sms -c "SELECT COUNT(*) FROM permissions;"
psql -U backbone_user -d scmc_sms -c "SELECT COUNT(*) FROM role_permissions;"
```

## Integration with CASL

The seeded permissions integrate with the CASL authorization system:

```typescript
// In controllers
@CheckPolicies({ action: Action.Create, subject: 'service_orders' })
async create(@Body() dto: CreateServiceOrderDto) {
  // Only users with 'service_orders:create' permission can access
}
```

## Troubleshooting

### Issue: "Permission already exists" error
**Solution**: This is expected behavior. The command handles existing data gracefully.

### Issue: Out of memory when running seed
**Solution**: The CLI is configured with `--max-old-space-size=2048`. If you still encounter issues, increase this value in `package.json`:

```json
"cli": "node --max-old-space-size=4096 -r ts-node/register -r tsconfig-paths/register src/cli/main.ts"
```

### Issue: Cannot find module error
**Solution**: Ensure you've built the project first:
```bash
npm run build
```

## Related Commands

- `npm run cli:create-user` - Create a new user
- `npm run cli:seed-employees` - Seed employee accounts
- `npm run cli:seed-brands` - Seed motorcycle brands
- `npm run cli:seed-data` - Seed service data
- `npm run cli:seed-all` - Run all seed commands

## Next Steps

After seeding roles and permissions:

1. **Seed employees**: Run `npm run cli:seed-employees` to create user accounts
2. **Assign roles**: Users need to be assigned roles via `user_roles` table
3. **Test permissions**: Use the API endpoints to verify permission checks work correctly
