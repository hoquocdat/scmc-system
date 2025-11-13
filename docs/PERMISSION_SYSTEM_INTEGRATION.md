# Permission System Integration Guide

## Overview

This document provides guidance on integrating the newly implemented CASL-based permission system into the SCMC Workshop Management System.

## What's Been Implemented

### Backend (Completed ✅)

1. **Database Schema** - [backend/prisma/migrations/006_permissions_system.sql](../backend/prisma/migrations/006_permissions_system.sql)
   - `permissions` table: 77 granular permissions across 24 modules
   - `roles` table: 8 system roles (superadmin, manager, sales, technician, finance, store_manager, sales_associate, warehouse_staff)
   - `role_permissions` table: Junction table for many-to-many role-permission relationships
   - `user_roles` table: Junction table for multi-role user assignments
   - `permission_audit_log` table: Tracks all permission changes

2. **CASL Integration** - [backend/src/casl/](../backend/src/casl/)
   - `CaslAbilityFactory`: Dynamically builds user permissions based on assigned roles
   - `PoliciesGuard`: Authorization guard that replaces the old RolesGuard
   - `@CheckPolicies()` decorator: Easy-to-use decorator for protecting endpoints

3. **Permissions API** - [backend/src/permissions/](../backend/src/permissions/)
   - 15+ REST endpoints for managing permissions, roles, and user assignments
   - Full CRUD operations for roles
   - Permission assignment to roles
   - User-role assignment (multi-role support)
   - Audit log retrieval with filtering

### Frontend (Completed ✅)

1. **API Client** - [frontend/src/lib/api/permissions.ts](../frontend/src/lib/api/permissions.ts)
   - TypeScript types for all permission entities
   - API functions for all backend endpoints
   - Proper error handling and type safety

2. **Admin UI Pages**
   - **Roles Management** - [frontend/src/pages/settings/RolesPage.tsx](../frontend/src/pages/settings/RolesPage.tsx)
     - Beautiful card-based UI for viewing all roles
     - Create, edit, delete roles
     - Manage permissions per role
     - View role statistics (user count, permission count)

   - **Audit Log** - [frontend/src/pages/settings/PermissionAuditPage.tsx](../frontend/src/pages/settings/PermissionAuditPage.tsx)
     - View all permission changes with filtering
     - Filter by action type, resource type, date range, user
     - Paginated results
     - Shows who performed changes and who was affected

3. **Reusable Components** - [frontend/src/components/permissions/](../frontend/src/components/permissions/)
   - `RoleFormDialog`: Create/edit role dialog
   - `RolePermissionsDialog`: Assign permissions to roles (searchable, grouped by resource)
   - `UserRolesDialog`: Assign multiple roles to users

## Accessing the Admin UI

The permission management pages are now available in the navigation menu under **"Cài Đặt" (Settings)**:

- **Vai Trò** (Roles): `/settings/roles`
- **Nhật Ký Quyền Hạn** (Audit Log): `/settings/audit`

These pages are only visible to users with `superadmin` or `manager` roles.

## How to Integrate UserRolesDialog into Your Existing User Management Page

Since you mentioned that User Management already exists, here's how to add the role assignment functionality:

### Step 1: Import the Component

In your existing User Management page (e.g., [frontend/src/pages/EmployeesPage.tsx](../frontend/src/pages/EmployeesPage.tsx)):

```typescript
import { UserRolesDialog } from '@/components/permissions/UserRolesDialog';
import { useState } from 'react';
```

### Step 2: Add State for Dialog

```typescript
const [selectedUser, setSelectedUser] = useState<UserWithRoles | { id: string; name: string; email: string } | null>(null);
```

### Step 3: Add a "Manage Roles" Button

In your user table or user card, add a button:

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => setSelectedUser(user)}
>
  <Shield className="mr-2 h-4 w-4" />
  Quản lý vai trò
</Button>
```

### Step 4: Render the Dialog

At the bottom of your component:

```typescript
{selectedUser && (
  <UserRolesDialog
    open={!!selectedUser}
    onOpenChange={(open) => {
      if (!open) setSelectedUser(null);
    }}
    user={selectedUser}
  />
)}
```

### Complete Example

```typescript
import { useState } from 'react';
import { UserRolesDialog } from '@/components/permissions/UserRolesDialog';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmployeesPage() {
  const [selectedUser, setSelectedUser] = useState(null);

  // Your existing code...

  return (
    <div>
      {/* Your existing employee list */}
      <Table>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell>{employee.name}</TableCell>
              <TableCell>{employee.email}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedUser(employee)}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Quản lý vai trò
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Role Assignment Dialog */}
      {selectedUser && (
        <UserRolesDialog
          open={!!selectedUser}
          onOpenChange={(open) => {
            if (!open) setSelectedUser(null);
          }}
          user={selectedUser}
        />
      )}
    </div>
  );
}
```

## Next Steps: Applying CASL Guards to Controllers

To complete the integration, you need to replace the old `@Roles()` decorator with the new `@CheckPolicies()` decorator across all controllers.

### Example Migration

**Before (Old RolesGuard):**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'sales')
@Get('products')
async getProducts() {
  // ...
}
```

**After (New PoliciesGuard):**
```typescript
import { CheckPolicies } from '@/casl/check-policies.decorator';
import { PoliciesGuard } from '@/casl/policies.guard';
import { Action } from '@/casl/action.enum';

@UseGuards(JwtAuthGuard, PoliciesGuard)
@CheckPolicies({ action: Action.Read, subject: 'products' })
@Get('products')
async getProducts() {
  // ...
}
```

### Controllers to Update

You need to apply `@CheckPolicies()` to all 24 module controllers:

1. ✅ **Permissions Module** (already protected)
2. ⏳ Products
3. ⏳ POS
4. ⏳ Sales Orders
5. ⏳ Service Orders
6. ⏳ Customers
7. ⏳ Bikes
8. ⏳ Employees
9. ⏳ Payments
10. ⏳ Reports
11. ⏳ Inventory
12. ⏳ Stock Adjustments
13. ⏳ Brands
14. ⏳ Categories
15. ⏳ Suppliers
16. ⏳ Parts
17. ... (and 7 more modules)

### Available Permissions

The system includes 77 permissions across these resources:

- `products`: read, create, update, delete
- `pos`: read, create, update, delete
- `sales_orders`: read, create, update, delete, approve
- `service_orders`: read, create, update, delete, assign
- `customers`: read, create, update, delete
- `bikes`: read, create, update, delete
- `employees`: read, create, update, delete
- `payments`: read, create, update, delete, process
- `reports`: read, generate, export
- ... and more

Full list available in [backend/prisma/migrations/006_permissions_system.sql](../backend/prisma/migrations/006_permissions_system.sql#L50-L126)

## Testing the System

### 1. Create Test Roles

1. Navigate to `/settings/roles`
2. Create a new role (e.g., "Warehouse Manager")
3. Click "Quản lý quyền" to assign permissions
4. Select relevant permissions (e.g., products:read, inventory:read, stock_adjustments:create)

### 2. Assign Roles to Users

1. Go to your User Management page
2. Click "Quản lý vai trò" on a user
3. Select multiple roles (e.g., "Warehouse Manager" + "Sales Associate")
4. Save changes

### 3. Test Access Control

1. Log in as the test user
2. Try accessing different features
3. Verify that only permitted actions are available
4. Check audit log at `/settings/audit` to see the role assignments

### 4. View Audit Trail

1. Navigate to `/settings/audit`
2. Filter by action type, date range, or user
3. Verify all permission changes are logged

## Database Migration

The permission system has already been applied to your database via migration `006_permissions_system.sql`. This migration includes:

- Schema creation for all permission tables
- 77 default permissions for all modules
- 8 system roles with appropriate permissions pre-assigned
- Data migration from old single-role system to new multi-role system

**No additional database work is required.**

## Security Considerations

1. **System Roles**: Roles marked as `is_system = true` cannot be deleted
2. **Superadmin Protection**: Superadmin role has all permissions and should be carefully assigned
3. **Audit Logging**: All permission changes are automatically logged with performer and timestamp
4. **Multi-Role Support**: Users can have multiple roles, and permissions are combined (union)
5. **Condition-Based Permissions**: The system supports JSONB conditions for advanced rules (e.g., "own resources only")

## Troubleshooting

### Issue: Cannot see Settings menu

**Solution**: Ensure your user has `superadmin` or `manager` role in the database:

```sql
-- Check user roles
SELECT u.name, u.email, r.name as role_name
FROM user_profiles u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'your-email@example.com';
```

### Issue: Permissions API returns 403

**Solution**: Verify that:
1. You're authenticated (JWT token is valid)
2. Your user has appropriate roles assigned
3. The backend PermissionsModule is properly registered in AppModule

### Issue: UserRolesDialog shows empty role list

**Solution**:
1. Check that the backend is running and accessible
2. Verify the database migration was applied successfully
3. Check browser console for API errors

## Support and Resources

- **Backend API Docs**: http://localhost:3000/api (Swagger docs)
- **CASL Documentation**: https://casl.js.org/
- **Prisma Schema**: [backend/prisma/schema.prisma](../backend/prisma/schema.prisma)

## Summary

The permission system is now fully operational with:

✅ **77 permissions** across 24 modules
✅ **8 system roles** with pre-configured permissions
✅ **Multi-role support** for flexible user assignments
✅ **Admin UI** for role and permission management
✅ **Audit logging** for compliance and debugging
✅ **CASL integration** for powerful, declarative access control

**Next Action**: Apply `@CheckPolicies()` decorators to your existing controllers to enforce the permission system.
