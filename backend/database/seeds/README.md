# Employee Seed Data

This directory contains scripts to populate the database with dummy employees for testing.

## Created Employees

### Technicians (5)

| Full Name          | Email                  | Password       | Phone       |
|--------------------|------------------------|----------------|-------------|
| Nguyễn Văn An      | technician1@scmc.vn    | technician123  | 0901234567  |
| Trần Minh Bảo      | technician2@scmc.vn    | technician123  | 0901234568  |
| Lê Hoàng Cường     | technician3@scmc.vn    | technician123  | 0901234569  |
| Phạm Đức Dũng      | technician4@scmc.vn    | technician123  | 0901234570  |
| Võ Thành Đạt       | technician5@scmc.vn    | technician123  | 0901234571  |

### Sales Staff (2)

| Full Name          | Email                  | Password       | Phone       |
|--------------------|------------------------|----------------|-------------|
| Hoàng Thị Lan      | sales1@scmc.vn         | sales123       | 0902345678  |
| Đỗ Văn Hùng        | sales2@scmc.vn         | sales123       | 0902345679  |

### Manager (1)

| Full Name          | Email                  | Password       | Phone       |
|--------------------|------------------------|----------------|-------------|
| Ngô Quang Minh     | manager2@scmc.vn       | manager123     | 0903456789  |

### Finance (1)

| Full Name          | Email                  | Password       | Phone       |
|--------------------|------------------------|----------------|-------------|
| Bùi Thị Nga        | finance@scmc.vn        | finance123     | 0904567890  |

## How to Run

### Create Employees

```bash
cd /Users/saitex/workspace/ts/saigonclassic/backend
npx ts-node scripts/seed-employees.ts
```

This script will:
- Create Supabase Auth users for each employee
- Insert user profiles into the `user_profiles` table
- Display a summary table of all employees

### Assign Employees to Service Orders

```bash
cd /Users/saitex/workspace/ts/saigonclassic/backend
npx ts-node scripts/assign-employees.ts
```

This script will:
- Find all active technicians
- Assign technicians to existing service orders in a round-robin fashion
- Update both `service_orders.assigned_employee_id` and `service_order_employees` table
- Display a summary of assignments

## Service Order Assignments

The assignment script distributes service orders evenly among technicians. Each service order is assigned to one primary technician, and the assignment is recorded in two places:

1. **service_orders.assigned_employee_id**: The primary assigned technician
2. **service_order_employees**: Junction table for tracking all employees (for future multi-technician support)

## Testing Login

You can now log in to the frontend with any of these credentials:

**Example for Technician:**
- Email: `technician1@scmc.vn`
- Password: `technician123`

**Example for Manager:**
- Email: `manager2@scmc.vn`
- Password: `manager123`

## Database Tables Updated

- `auth.users` (Supabase Auth)
- `user_profiles`
- `service_orders` (assigned_employee_id field)
- `service_order_employees` (junction table)

## Notes

- All employees are created with `is_active = true`
- Passwords are simple for testing purposes (not for production!)
- The script uses `upsert` so it's safe to run multiple times
- Technicians are distributed evenly across service orders using round-robin assignment
