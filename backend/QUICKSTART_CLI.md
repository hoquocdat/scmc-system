# CLI Quick Start Guide

## Create Your First User

```bash
cd backend
npm run cli -- create:user
```

Follow the prompts:

```
🔐 Create User

This command will create a new user with the specified role.

? Full Name: Admin User
? Email: admin@scmc.vn
? Phone (optional, press Enter to skip): 0901234567
? Select role: Manager (Full access)
? Password (min 6 characters): ******
? Confirm Password: ******

📋 Review user details:

  Name:  Admin User
  Email: admin@scmc.vn
  Phone: 0901234567
  Role:  manager

? Create this user? (Y/n) Y
```

## Available Roles

1. **Manager** - Full access to all features
2. **Store Manager** - POS + Inventory management
3. **Sales** - Create and manage service orders
4. **Sales Associate** - POS sales operations
5. **Technician** - Service execution and updates
6. **Warehouse Staff** - Inventory management
7. **Finance** - Payments and financial operations

## View All Commands

```bash
npm run cli -- --help
```

## Get Help for a Command

```bash
npm run cli -- create:user --help
```

## Technical Details

- **Framework**: Nest Commander (NestJS-based CLI)
- **Database**: PostgreSQL (pure SQL, no Supabase)
- **Password Hashing**: bcrypt with 10 rounds
- **Validation**: Email format, phone format (Vietnamese), password strength

## What Happens When You Create a User?

1. ✅ Validates all input (email format, phone format, password strength)
2. ✅ Checks for duplicate email addresses
3. ✅ Hashes password with bcrypt (10 rounds)
4. ✅ Generates UUID for user ID
5. ✅ Inserts record into `user_profiles` table
6. ✅ User can immediately log in with email + password

## Database Schema

The `user_profiles` table includes:
- `id` (UUID) - Primary key
- `email` (VARCHAR, UNIQUE, NOT NULL) - Login identifier
- `password_hash` (VARCHAR) - Bcrypt hashed password
- `full_name` (VARCHAR) - Display name
- `phone` (VARCHAR, optional) - Contact number
- `role` (ENUM) - User role
- `is_active` (BOOLEAN) - Account status

## Security

- 🔐 Passwords never stored in plaintext
- 🔐 Email addresses are unique and indexed
- 🔐 Password minimum 6 characters (can be increased)
- 🔐 bcrypt salt rounds: 10 (adjustable in code)

## Troubleshooting

**Error: "A user with this email already exists!"**
- Solution: Use a different email address

**Error: "Invalid email format!"**
- Solution: Use format like `user@domain.com`

**Error: "Invalid phone format!"**
- Solution: Use Vietnamese format: `0901234567` or `+84901234567`

**Error: "Passwords do not match!"**
- Solution: Ensure both password entries are identical

## Next Steps

After creating your first user:

1. Start the backend server:
   ```bash
   npm run start:dev
   ```

2. Test login via API:
   ```bash
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@scmc.vn","password":"yourpassword"}'
   ```

3. Use the JWT token to access protected endpoints

## More Information

- Full documentation: [CLI_USAGE.md](CLI_USAGE.md)
- Migration details: [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)
- Project overview: [../CLAUDE.md](../CLAUDE.md)
