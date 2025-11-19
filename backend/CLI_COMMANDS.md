# CLI Commands Reference

All scripts have been converted to **Nest Commander** commands for better maintainability and consistency with the NestJS architecture.

## Quick Reference

```bash
# User Management
npm run cli:create-user          # Create a new user interactively

# Database Seeding
npm run cli:seed-employees       # Seed employee accounts
npm run cli:seed-brands          # Seed motorcycle brands and models
npm run cli:seed-data            # Seed customers, bikes, and service orders
npm run cli:seed-verify          # Verify seed data
npm run cli:seed-assign          # Assign technicians to service orders
npm run cli:seed-all             # Run all seed commands in order

# Show available commands
npm run cli -- --help
```

## Commands

### User Management

#### `create:user` - Create New User

Create a new user with interactive prompts.

**Usage:**
```bash
npm run cli -- create:user
# or
npm run cli:create-user
```

**Features:**
- Interactive prompts for all user details
- Email and phone validation
- Password confirmation
- Supports all 7 user roles:
  1. Manager (Full access)
  2. Store Manager (POS + Inventory)
  3. Sales (Service orders)
  4. Sales Associate (POS sales)
  5. Technician (Service execution)
  6. Warehouse Staff (Inventory)
  7. Finance (Payments)
- Creates user in Supabase Auth + PostgreSQL profile

**Output:**
```
🔐 Create User

? Full Name: John Doe
? Email: john@example.com
? Phone: 0901234567
? Select role: Manager (Full access)
? Password: ******
? Confirm Password: ******

✅ Created user successfully
```

---

### Database Seeding

#### `seed:employees` - Seed Employee Data

Seeds predefined employee accounts (9 employees: 5 technicians, 2 sales, 2 managers).

**Usage:**
```bash
npm run cli -- seed:employees
# or
npm run cli:seed-employees
```

**What it creates:**
- **5 Technicians**: Khánh Gara, Đen, Lê Hoàng Cường, Phạm Đức Dũng, Võ Thành Đạt
- **2 Sales**: Hoàng Thị Lan, Luân
- **2 Managers**: Tom Hoàng, doanh

**Default Password:** `123456` (except Hoàng Thị Lan: `sales123`)

**Output:**
```
🌱 Seeding employees...

✅ Created Khánh Gara (technician) - khanhgara@saigonclassic.com:123456
✅ Created Đen (technician) - den@saigonclassic.com:123456
...

📋 All Employees:
┌─────┬──────────────┬─────────────────────────┬────────────┬───────────┐
│ id  │ full_name    │ email                   │ role       │ is_active │
├─────┼──────────────┼─────────────────────────┼────────────┼───────────┤
│ ... │ ...          │ ...                     │ ...        │ true      │
└─────┴──────────────┴─────────────────────────┴────────────┴───────────┘

✨ Done!
```

---

#### `seed:brands` - Seed Motorcycle Brands and Models

Seeds 6 major motorcycle brands with 115+ models.

**Usage:**
```bash
npm run cli -- seed:brands
# or
npm run cli:seed-brands
```

**What it creates:**
- **Honda**: 25 models (CBR series, CB series, CRF, Africa Twin, etc.)
- **Kawasaki**: 20 models (Ninja series, Z series, Versys, etc.)
- **BMW**: 18 models (S1000RR, R1250GS, F750GS, etc.)
- **Ducati**: 22 models (Panigale, Monster, Multistrada, etc.)
- **Triumph**: 15 models (Street Triple, Tiger, Bonneville, etc.)
- **Harley-Davidson**: 15 models (Sportster, Softail, Road King, etc.)

**Output:**
```
🏍️  Seeding motorcycle brands and models...

✅ Honda: Created/Updated 25 models
✅ Kawasaki: Created/Updated 20 models
✅ BMW: Created/Updated 18 models
✅ Ducati: Created/Updated 22 models
✅ Triumph: Created/Updated 15 models
✅ Harley-Davidson: Created/Updated 15 models

✨ Seeding complete!
📊 Total: 6 brands, 115 models
```

---

#### `seed:data` - Seed Service Data

Seeds complete service workflow data (customers, motorcycles, service orders).

**Usage:**
```bash
npm run cli -- seed:data
# or
npm run cli:seed-data
```

**What it creates:**
- **15 Customers**: Vietnamese names with realistic data
- **15 Motorcycles**: Linked to customers with various brands/models
- **12 Service Orders**: Various statuses, priorities, and dates
  - Past orders (completed/delivered)
  - Current orders (in progress, waiting parts, etc.)
  - Future appointments (pending/confirmed)

**Output:**
```
🌱 Seeding service data...

✅ Created 15 customers
✅ Created 15 motorcycles
✅ Created 12 service orders

📊 Summary:
  Customers: 15
  Motorcycles: 15
  Service Orders: 12

📈 Service Orders by Status:
  - Pending: 2
  - In Progress: 4
  - Completed: 3
  - Delivered: 3

🏍️  Bikes currently in service: 6

✨ Done!
```

---

#### `seed:verify` - Verify Seed Data

Verifies that seed data was created successfully by displaying sample records and counts.

**Usage:**
```bash
npm run cli -- seed:verify
# or
npm run cli:seed-verify
```

**Output:**
```
🔍 Verifying seed data...

📋 Sample Customers (first 5):
┌────┬────────────────┬──────────────────────┬─────────────┐
│ id │ full_name      │ email                │ phone       │
├────┼────────────────┼──────────────────────┼─────────────┤
│ .. │ Nguyễn Văn An  │ nguyenvanan@...      │ 0901234567  │
└────┴────────────────┴──────────────────────┴─────────────┘

📋 Sample Motorcycles (first 5):
...

📋 Sample Service Orders (first 5):
...

📊 Total Counts:
  Customers: 15
  Motorcycles: 15
  Service Orders: 12
  Brands: 6
  Models: 115

✨ Verification complete!
```

---

#### `seed:assign-employees` - Assign Employees to Service Orders

Assigns technicians to service orders using round-robin distribution.

**Usage:**
```bash
npm run cli -- seed:assign-employees
# or
npm run cli:seed-assign
```

**Features:**
- Round-robin assignment for balanced workload
- Updates both `service_orders.assigned_employee_id` and `service_order_employees` table
- Shows detailed assignment log

**Output:**
```
👷 Assigning employees to service orders...

✅ Assigned Khánh Gara to Service Order #SO-001
✅ Assigned Đen to Service Order #SO-002
✅ Assigned Lê Hoàng Cường to Service Order #SO-003
...

📋 Recent Assignments:
┌─────────────┬────────────────┬──────────────┐
│ Order #     │ Technician     │ Status       │
├─────────────┼────────────────┼──────────────┤
│ SO-001      │ Khánh Gara     │ In Progress  │
└─────────────┴────────────────┴──────────────┘

✨ Done!
```

---

#### `seed:all` - Run All Seed Commands

Runs all seed commands in the correct order.

**Usage:**
```bash
npm run cli:seed-all
```

**Execution Order:**
1. `seed:employees` - Create employee accounts
2. `seed:brands` - Create brands and models
3. `seed:data` - Create customers, bikes, and service orders

**Note:** Does NOT include `seed:assign-employees` or `seed:verify`. Run those separately if needed.

---

## Complete Seeding Workflow

For a fresh database, run commands in this order:

```bash
# 1. Create employee accounts
npm run cli:seed-employees

# 2. Create motorcycle brands and models
npm run cli:seed-brands

# 3. Create service data
npm run cli:seed-data

# 4. (Optional) Assign technicians
npm run cli:seed-assign

# 5. (Optional) Verify everything
npm run cli:seed-verify
```

**Or use the shortcut:**
```bash
npm run cli:seed-all
npm run cli:seed-assign  # Optional
npm run cli:seed-verify  # Optional
```

---

## Environment Variables

All commands use these environment variables:

```env
# Supabase Auth (for user authentication)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# PostgreSQL Database
DATABASE_URL=postgresql://backbone_user:backbone_password@127.0.0.1:5432/scmc_sms
```

---

## Architecture

All commands follow these patterns:

1. **Use Nest Commander** - Professional CLI framework
2. **Inject Services** - PrismaService, ConfigService
3. **Supabase Auth** - For user authentication (where needed)
4. **PostgreSQL** - For application data
5. **Error Handling** - Try-catch with detailed error messages
6. **Progress Indicators** - Emoji-based status updates
7. **Summary Tables** - console.table for easy-to-read output

---

## Migration from Old Scripts

**Old scripts** (in `scripts/` directory) are now **deprecated**:
- ❌ `scripts/create-superadmin.ts` → ✅ `npm run cli:create-user`
- ❌ `scripts/seed-employees.ts` → ✅ `npm run cli:seed-employees`
- ❌ `scripts/seed-brands-models.ts` → ✅ `npm run cli:seed-brands`
- ❌ `scripts/seed-service-data.ts` → ✅ `npm run cli:seed-data`
- ❌ `scripts/verify-seed-data.ts` → ✅ `npm run cli:seed-verify`
- ❌ `scripts/assign-employees.ts` → ✅ `npm run cli:seed-assign`

**Benefits of new CLI:**
- ✅ Consistent with NestJS architecture
- ✅ Reuses existing services (no code duplication)
- ✅ Better error handling
- ✅ Professional interactive UI
- ✅ Auto-generated help text
- ✅ Easy to extend with new commands

---

## Troubleshooting

**Error: "Supabase connection failed"**
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Verify Supabase is running: `npx supabase status`

**Error: "Database connection failed"**
- Check `DATABASE_URL` in `.env`
- Verify PostgreSQL container is running: `docker ps | grep backbone_postgres`

**Error: "User already exists"**
- User with that email already exists in Supabase Auth
- Use different email or delete user from Supabase dashboard

**Command not found**
- Make sure you're in the `backend` directory
- Run `npm install` to ensure all dependencies are installed
