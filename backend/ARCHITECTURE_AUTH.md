# Authentication Architecture

## System Overview

This project uses a **hybrid architecture** combining **Supabase Auth** with **standalone PostgreSQL**:

- **Supabase Auth**: Handles user authentication, password management, JWT tokens
- **PostgreSQL Database**: Stores user profiles and application data

## Why This Architecture?

| Component | Provider | Purpose |
|-----------|----------|---------|
| **Authentication** | Supabase Auth | Secure password storage, JWT generation, session management |
| **User Profiles** | PostgreSQL | Application-specific user data (role, phone, etc.) |
| **Application Data** | PostgreSQL | Service orders, customers, motorcycles, etc. |

## Authentication Flow

### 1. User Creation

```
CLI Command (create:user)
    ↓
Step 1: Create user in Supabase Auth
    ├─ Email + Password
    ├─ User metadata (role, phone, full_name)
    └─ Returns user ID (UUID)
    ↓
Step 2: Create profile in PostgreSQL
    ├─ Use same UUID as Supabase Auth
    ├─ Store role, phone, email, full_name
    └─ Link via user_profiles.id = auth.users.id
```

### 2. User Login

```
Frontend Login Request
    ↓
Supabase Auth validates email/password
    ├─ If valid: Returns JWT token
    └─ JWT contains user ID
    ↓
Backend API validates JWT
    ↓
Fetch user profile from PostgreSQL
    ├─ Query: user_profiles WHERE id = jwt.sub
    └─ Returns role, permissions, etc.
```

## Database Schema

### Supabase Auth (auth.users)
```sql
-- Managed by Supabase
-- Stores authentication credentials
id UUID PRIMARY KEY
email VARCHAR UNIQUE
encrypted_password VARCHAR  -- Bcrypt hashed by Supabase
user_metadata JSONB         -- { role, phone, full_name }
created_at TIMESTAMP
```

### PostgreSQL (public.user_profiles)
```sql
-- Managed by us
-- Stores application profile data
id UUID PRIMARY KEY         -- Same as auth.users.id
full_name VARCHAR(255)
email VARCHAR(255) UNIQUE
phone VARCHAR(20)
role user_role              -- ENUM (manager, sales, technician, etc.)
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

## Key Points

1. **No Password Storage in PostgreSQL**
   - Passwords are ONLY stored in Supabase Auth
   - PostgreSQL `user_profiles` has NO `password_hash` column

2. **UUID Synchronization**
   - When creating a user, Supabase Auth generates the UUID
   - We use the SAME UUID in PostgreSQL `user_profiles`
   - This links the auth record to the profile record

3. **Role-Based Access Control**
   - User role is stored in PostgreSQL `user_profiles.role`
   - Also duplicated in Supabase user_metadata for convenience
   - Backend reads role from PostgreSQL for authorization

4. **Error Handling**
   - If Supabase Auth creation fails → Stop, no profile created
   - If PostgreSQL profile creation fails → Clean up Supabase Auth user

## Environment Variables

```env
# Supabase Auth Configuration
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# PostgreSQL Database
DATABASE_URL=postgresql://backbone_user:backbone_password@127.0.0.1:5432/scmc_sms
```

## CLI Commands

### Create User

```bash
npm run cli -- create:user
```

This command:
1. ✅ Prompts for user details (name, email, phone, role, password)
2. ✅ Creates user in Supabase Auth
3. ✅ Creates profile in PostgreSQL
4. ✅ Handles errors and cleanup

## API Authentication Flow

```typescript
// 1. User logs in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// 2. Get JWT token
const token = data.session.access_token;

// 3. Send token to backend API
fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

// 4. Backend validates JWT and fetches profile
@UseGuards(JwtAuthGuard)
async getProfile(@Request() req) {
  const userId = req.user.sub;  // From JWT
  const profile = await this.prisma.user_profiles.findUnique({
    where: { id: userId },
  });
  return profile;
}
```

## Security Considerations

1. **Password Security**
   - Passwords never stored in our PostgreSQL database
   - Supabase handles bcrypt hashing (10+ rounds)
   - Password reset handled by Supabase

2. **JWT Validation**
   - All API requests must include valid JWT
   - JWT verified against Supabase public key
   - Expired tokens automatically rejected

3. **Role Verification**
   - Never trust role from JWT metadata alone
   - Always fetch role from PostgreSQL `user_profiles`
   - Use Guards/Decorators for role-based access

## Advantages of This Architecture

✅ **Secure**: Supabase handles password security best practices
✅ **Flexible**: Full control over user profile schema in PostgreSQL
✅ **Scalable**: Supabase Auth can handle millions of users
✅ **Simple**: No need to implement password hashing, JWT generation, etc.
✅ **Features**: Get email verification, password reset, MFA for free

## Migration Notes

Previously, we attempted to store passwords directly in PostgreSQL (`password_hash` column). This has been removed in favor of using Supabase Auth exclusively for authentication.

**Migration 011**: Added `password_hash` (REMOVED - incorrect approach)
**Migration 012**: Removed `password_hash` (correct approach - use Supabase Auth)

## Troubleshooting

**Error: "User already exists in Supabase Auth"**
- Solution: Use different email or delete user from Supabase dashboard

**Error: "Cannot create profile - user ID already exists"**
- Solution: User profile already created, check if user exists in database

**Error: "Supabase Auth connection failed"**
- Solution: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Check if Supabase is running (`npx supabase status`)
