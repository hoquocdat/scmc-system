# Authentication Setup for Local Development

## Overview

Your application uses **Supabase Auth** with role-based access control (RBAC). Users are authenticated through Supabase and their roles determine what actions they can perform.

## User Roles

The system supports 4 roles defined in `user_role` enum:
- **manager**: Full access to all features
- **sales**: Can create service orders, manage customers and bikes
- **technician**: Can view and update assigned service orders, record parts usage
- **finance**: Can process payments, generate invoices

## Local Development Setup

### Step 1: Access Supabase Studio

Open Supabase Studio in your browser:
```
http://127.0.0.1:54323
```

### Step 2: Create Test Users

Navigate to **Authentication > Users** and click **"Add user"** to create test users with these details:

#### Manager Account
- **Email**: `manager@saigonclassic.local`
- **Password**: `manager123`
- **Auto Confirm User**: ✓ (checked)

#### Sales Account
- **Email**: `sales@saigonclassic.local`
- **Password**: `sales123`
- **Auto Confirm User**: ✓ (checked)

#### Technician Account 1
- **Email**: `tech1@saigonclassic.local`
- **Password**: `tech123`
- **Auto Confirm User**: ✓ (checked)

#### Technician Account 2
- **Email**: `tech2@saigonclassic.local`
- **Password**: `tech123`
- **Auto Confirm User**: ✓ (checked)

#### Finance Account
- **Email**: `finance@saigonclassic.local`
- **Password**: `finance123`
- **Auto Confirm User**: ✓ (checked)

### Step 3: Create User Profiles

After creating auth users, you need to create corresponding `user_profiles` records.

1. Go to **Table Editor > user_profiles**
2. Click **"Insert row"** for each user
3. Fill in the details:

| ID (copy from auth.users) | Full Name | Role | Phone | Email | is_active |
|---|---|---|---|---|---|
| (copy UUID from auth user) | Manager User | manager | +84901234567 | manager@saigonclassic.local | true |
| (copy UUID from auth user) | Sales User | sales | +84901234568 | sales@saigonclassic.local | true |
| (copy UUID from auth user) | Technician One | technician | +84901234569 | tech1@saigonclassic.local | true |
| (copy UUID from auth user) | Technician Two | technician | +84901234570 | tech2@saigonclassic.local | true |
| (copy UUID from auth user) | Finance User | finance | +84901234571 | finance@saigonclassic.local | true |

**Important**: The `id` in `user_profiles` MUST match the `id` from `auth.users` (this is enforced by a foreign key).

### Step 4: SQL Script (Alternative Method)

Alternatively, after creating users in Supabase Studio, you can run this SQL in **SQL Editor**:

```sql
-- Get the user IDs first
SELECT id, email FROM auth.users;

-- Then insert user profiles (replace the UUIDs with actual values from above)
INSERT INTO user_profiles (id, full_name, role, phone, email, is_active)
VALUES
  ('REPLACE-WITH-MANAGER-UUID', 'Manager User', 'manager', '+84901234567', 'manager@saigonclassic.local', true),
  ('REPLACE-WITH-SALES-UUID', 'Sales User', 'sales', '+84901234568', 'sales@saigonclassic.local', true),
  ('REPLACE-WITH-TECH1-UUID', 'Technician One', 'technician', '+84901234569', 'tech1@saigonclassic.local', true),
  ('REPLACE-WITH-TECH2-UUID', 'Technician Two', 'technician', '+84901234570', 'tech2@saigonclassic.local', true),
  ('REPLACE-WITH-FINANCE-UUID', 'Finance User', 'finance', '+84901234571', 'finance@saigonclassic.local', true);
```

## Frontend Authentication (✅ IMPLEMENTED)

The frontend authentication is **fully implemented**! Here's what you have:

### ✅ 1. Login Page
Located at `/frontend/src/pages/LoginPage.tsx`:
- Clean UI with email/password form
- Uses Supabase Auth for sign in
- Error handling and loading states
- Redirects to dashboard after successful login

### ✅ 2. Protected Routes
All routes are wrapped with `<ProtectedRoute>` component:
- Automatically fetches user profile on mount
- Redirects to `/login` if not authenticated
- Shows loading screen while checking auth status

### ✅ 3. Authentication State Management
Using Zustand store at `/frontend/src/store/authStore.ts`:
- `signIn(email, password)` - Sign in with credentials
- `signOut()` - Sign out current user
- `fetchUserProfile()` - Get current user and profile
- Stores user profile with role information

### ✅ 4. Role-Based UI
Implemented in `/frontend/src/components/layout/AppLayout.tsx`:
- Navigation items filter based on user role
- Each nav item has `roles` array specifying who can see it
- Example: Only managers see "Reports" and "Employees" links

## Backend Authentication (✅ FULLY IMPLEMENTED)

The backend has complete JWT authentication:
- ✅ Supabase client configured
- ✅ Row Level Security (RLS) policies in place
- ✅ Role-based access control in database
- ✅ JWT authentication guards enabled
- ✅ Passport JWT strategy for Supabase tokens
- ✅ All controllers protected with JWT guards

### JWT Implementation Details

**Location**: `/backend/src/auth/`

**Files**:
- `jwt.strategy.ts` - Validates Supabase JWT tokens and fetches user profile
- `jwt-auth.guard.ts` - NestJS guard using Passport JWT strategy
- `current-user.decorator.ts` - Decorator to extract current user from request
- `auth.module.ts` - Auth module exporting guards and strategies

**Protected Controllers**:
- ✅ `/backend/src/comments/comments.controller.ts`
- ✅ `/backend/src/service-orders/service-orders.controller.ts`
- ✅ `/backend/src/customers/customers.controller.ts`
- ✅ `/backend/src/bikes/bikes.controller.ts`
- ✅ `/backend/src/payments/payments.controller.ts`
- ✅ `/backend/src/parts/parts.controller.ts`
- ✅ `/backend/src/users/users.controller.ts`

**Usage in Controllers**:
```typescript
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetCurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.decorator';

@Controller('example')
@UseGuards(JwtAuthGuard) // Protect entire controller
export class ExampleController {
  @Post()
  create(
    @Body() dto: CreateDto,
    @GetCurrentUser() user: CurrentUser, // Get authenticated user
  ) {
    // user.id, user.email, user.role, user.fullName are available
    return this.service.create(dto, user.id);
  }
}
```

## Row Level Security (RLS)

Your database already has RLS policies that enforce role-based access:

- **Managers**: Full access to everything
- **Sales**: Can create/manage customers, bikes, and service orders
- **Technicians**: Can view all, update assigned service orders
- **Finance**: Can manage payments

These policies automatically apply when users are authenticated through Supabase Auth.

## Testing Authentication

1. Create test users as described above
2. Implement login page in frontend
3. Test logging in with different roles
4. Verify that RLS policies work correctly (users can only access what they're allowed to)

## Production Considerations

For production:
1. Use strong passwords
2. Enable email confirmation (disable "Auto Confirm User")
3. Set up proper email templates
4. Configure password requirements
5. Implement password reset flow
6. Enable 2FA for admin accounts
