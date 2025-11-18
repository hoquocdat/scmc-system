# Backend Scripts

This directory contains utility scripts for managing the SCMC Workshop Management System.

## Create Superadmin User

Create a new superadmin (manager) user with full system access.

### Usage

```bash
npm run create:superadmin
```

Or using npx directly:

```bash
npx ts-node scripts/create-superadmin.ts
```

### Interactive Prompts

The script will prompt you for:

1. **Full Name** (required)
2. **Email** (required) - Must be valid email format, used for login
3. **Phone** (optional) - Vietnamese format: `+84901234567` or `0901234567`
4. **Role** (default: manager)
   - `manager` - Full system access
   - `store_manager` - POS and inventory management
   - `sales` - Service order creation and management
   - `sales_associate` - POS sales operations
   - `technician` - Service execution and updates
   - `warehouse_staff` - Inventory management
   - `finance` - Payment processing
5. **Password** (required, min 6 characters)
6. **Confirmation** - Review all details before creating

### Example Output

```
✨ Success! Superadmin user created:

┌──────────────────────────────────────────────────────┐
│ Name:  John Doe                                      │
│ Email: john@example.com                              │
│ Phone: +84901234567                                  │
│ Role:  manager                                       │
│ ID:    xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx          │
└──────────────────────────────────────────────────────┘

💡 User can now log in with their email and password.
```

---

# Seed Scripts

Scripts to populate the database with test data for development.

## Prerequisites

1. Supabase local development environment running (`supabase start`)
2. Database migrations applied
3. Environment variables configured in `.env` file

## Available Scripts

### 1. Seed Employees

Creates test user accounts with different roles:

```bash
npm run seed:employees
```

This creates:
- **5 Technicians**: technician1@scmc.vn through technician5@scmc.vn
- **2 Sales Staff**: sales1@scmc.vn, sales2@scmc.vn
- **1 Manager**: manager2@scmc.vn
- **1 Finance**: finance@scmc.vn

**Default password for all users**: `[role]123` (e.g., `technician123`, `sales123`, `manager123`, `finance123`)

### 2. Seed Service Data

Creates test data for customers, bikes, and service orders:

```bash
npm run seed:data
```

This creates:
- **15 Customers**: Individual bike owners with Vietnamese names
- **15 Bikes**: Mix of Triumph, BMW, Ducati, and Harley-Davidson motorcycles
- **12 Service Orders**: Orders in various statuses (pending, in_progress, completed, etc.)

### 3. Seed Everything

Run both seed scripts in sequence:

```bash
npm run seed:all
```

This is equivalent to running:
```bash
npm run seed:employees && npm run seed:data
```

## Seed Data Details

### Customers
- 15 individual customers with realistic Vietnamese names
- Contact information (phone, email, address)
- ID numbers
- Some have notes (VIP customer, preferences, etc.)

### Bikes
- Mix of premium motorcycle brands:
  - Triumph (Bonneville, Street Triple, Thruxton, etc.)
  - BMW (R1250GS, S1000RR, R nineT, etc.)
  - Ducati (Panigale V4, Monster, Streetfighter, etc.)
  - Harley-Davidson (Street Bob, Fat Bob)
- Realistic VINs, engine numbers, and license plates
- Years ranging from 2021-2023

### Service Orders
Orders with various statuses to test all workflows:
- **Delivered** (3 orders): Completed work, bikes picked up
- **In Progress** (3 orders): Currently being worked on
- **Quality Check** (1 order): Work done, awaiting final inspection
- **Ready for Pickup** (1 order): Completed, waiting for customer
- **Confirmed** (2 orders): Scheduled appointments (some in future)
- **Waiting Parts** (1 order): Work paused, waiting for parts
- **Pending** (1 order): New order, not started yet

Service types include:
- Regular maintenance
- Major services
- Custom modifications
- Tire replacements
- Exhaust installations
- Pre-track day inspections
- Cosmetic repairs

### Bikes in Service Count
The seed data creates approximately **9 bikes currently in service** (all statuses except "delivered" and "cancelled").

## Environment Variables

The scripts use the following environment variables:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

If not set, defaults to local Supabase development values.

## Running in Production

**WARNING**: These scripts are for development only!

Do NOT run seed scripts in production as they:
- Use weak default passwords
- Create test data
- May conflict with real data

## Troubleshooting

### Error: "No technicians found"
Run `npm run seed:employees` first before running `npm run seed:data`.

### Error: "duplicate key value violates unique constraint"
The seed data may already exist. To re-seed:

1. Clear existing data from tables (in Supabase SQL Editor):
   ```sql
   DELETE FROM service_orders;
   DELETE FROM bikes;
   DELETE FROM customers;
   DELETE FROM user_profiles WHERE email LIKE '%@scmc.vn';
   -- Also delete auth users in Supabase Studio
   ```

2. Run seed scripts again

### Error: "relation does not exist"
Make sure all database migrations are applied:
```bash
# In Supabase SQL Editor, run all migration files from:
# supabase/migrations/*.sql
```

## Verifying Seed Data

After running seed scripts, verify the data:

1. **Check counts in Supabase Studio**:
   - Table Editor → customers (should show 15 rows)
   - Table Editor → bikes (should show 15 rows)
   - Table Editor → service_orders (should show 12 rows)
   - Authentication → Users (should show 9 users)

2. **Check dashboard**:
   - Start the frontend: `cd frontend && npm run dev`
   - Login as manager: `manager2@scmc.vn` / `manager123`
   - Dashboard should show ~9 bikes in service

3. **Query database**:
   ```sql
   -- Check customers
   SELECT COUNT(*) FROM customers;

   -- Check bikes by brand
   SELECT brand, COUNT(*) FROM bikes GROUP BY brand;

   -- Check service orders by status
   SELECT status, COUNT(*) FROM service_orders GROUP BY status;

   -- Check bikes in service
   SELECT COUNT(*) FROM service_orders
   WHERE status NOT IN ('delivered', 'cancelled');
   ```

## Testing Login Credentials

After seeding employees, you can test login with these accounts:

| Role | Email | Password |
|------|-------|----------|
| Manager | manager2@scmc.vn | manager123 |
| Sales | sales1@scmc.vn | sales123 |
| Sales | sales2@scmc.vn | sales123 |
| Technician | technician1@scmc.vn | technician123 |
| Finance | finance@scmc.vn | finance123 |

## Script Files

- `seed-employees.ts`: Creates user accounts and profiles
- `seed-service-data.ts`: Creates customers, bikes, and service orders
- `seed-data.ts`: Legacy seed script (may be outdated)
- `verify-seed-data.ts`: Verification script
