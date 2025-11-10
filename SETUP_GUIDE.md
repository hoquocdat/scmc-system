# Setup Guide - SCMC Workshop Management System

This guide will walk you through setting up the project from scratch.

## Step 1: Install Dependencies

```bash
# From the root directory
npm run install:all

# OR install manually
cd frontend && npm install
cd ../backend && npm install
```

## Step 2: Set Up Supabase Project

1. Go to https://supabase.com and create a new project
2. Wait for the project to finish setting up (2-3 minutes)
3. Note down your project reference ID from the URL

## Step 3: Get Supabase Credentials

1. Go to Project Settings → API
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

## Step 4: Configure Environment Variables

### Frontend Environment (.env)
```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Backend Environment (.env)
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
JWT_SECRET=generate_a_random_string_here
PORT=3001
```

To get the database URL:
- Go to Project Settings → Database
- Copy the Connection String (URI format)

## Step 5: Run Database Migration

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor (left sidebar)
3. Click "New Query"
4. Copy the entire contents of `database/migrations/001_initial_schema.sql`
5. Paste into the editor
6. Click "Run" to execute

This creates:
- All database tables
- Enums for roles, statuses, etc.
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for auto-updating timestamps
- Views for reporting

## Step 6: Create Your First User

### Method 1: Using Supabase Dashboard
1. Go to Authentication → Users
2. Click "Add user"
3. Enter email and password
4. Click "Create user"
5. Copy the user ID

### Method 2: Create via SQL
```sql
-- In Supabase SQL Editor
-- Note: This is automatically handled by Supabase Auth UI
-- Just create the user in the dashboard, then add the profile
```

## Step 7: Add User Profile with Role

In Supabase SQL Editor, run:
```sql
-- Replace 'user-id-here' with the actual UUID from step 6
INSERT INTO user_profiles (id, role, full_name, email, phone)
VALUES (
  'user-id-here',
  'manager',  -- or 'sales', 'technician', 'finance'
  'Your Name',
  'your.email@example.com',
  '1234567890'
);
```

## Step 8: Start Development Servers

### Terminal 1 - Frontend
```bash
cd frontend
npm run dev
```
Frontend will run at: http://localhost:5173

### Terminal 2 - Backend
```bash
cd backend
npm run start:dev
```
Backend will run at: http://localhost:3001

## Step 9: Test the Application

1. Open http://localhost:5173
2. You should be redirected to the login page
3. Enter the email and password you created in Step 6
4. You should be logged in and see the dashboard
5. The dashboard should show "0" bikes in service (since you haven't created any yet)

## Troubleshooting

### Login fails with "Invalid credentials"
- Verify you're using the exact email/password from Supabase Auth
- Check that the user_profile exists with `SELECT * FROM user_profiles;`
- Ensure the user ID in user_profiles matches the auth.users ID

### "Missing Supabase environment variables" error
- Double-check your .env files are in the correct directories
- Make sure variable names match exactly (VITE_ prefix for frontend)
- Restart the dev server after changing .env

### Database migration fails
- Ensure you have a fresh Supabase project (no existing tables)
- Run the entire SQL file at once, not in parts
- Check the error message for specific line numbers

### CORS errors
- Verify backend is running on port 3001
- Check frontend is on port 5173
- Backend CORS is configured for http://localhost:5173

### Real-time updates not working
- Verify Supabase Realtime is enabled (should be by default)
- Check browser console for connection errors
- Ensure RLS policies are correctly set

## Next Steps

Once everything is working:

1. **Test the dashboard** - verify bikes in service counter
2. **Create test data** - add bike owners, customers, motorcycles
3. **Start Phase 2** - implement bike owner management UI
4. **Add more users** - create users with different roles to test RBAC

## Common Development Workflows

### Adding a new database table
1. Write migration SQL in `database/migrations/`
2. Run in Supabase SQL Editor
3. Add TypeScript type in `frontend/src/types/index.ts`
4. Create NestJS entity/DTO in backend

### Adding a new page
1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Implement with proper auth protection

### Testing different user roles
- Create multiple users in Supabase Auth
- Add user_profiles with different roles
- Test that role-based permissions work correctly

## Important Notes

- **Never commit .env files** to git
- **Keep service_role key secret** - it bypasses RLS
- **Test RLS policies** thoroughly - they enforce security
- **Use migrations** for all database changes
- **Follow the owner vs customer distinction** - it's critical to the business logic

## Resources

- Supabase Docs: https://supabase.com/docs
- NestJS Docs: https://docs.nestjs.com
- React Router: https://reactrouter.com
- Tailwind CSS: https://tailwindcss.com
- Shadcn UI: https://ui.shadcn.com

---

Need help? Check:
- `CLAUDE.md` - Development guide
- `requirements.md` - Full project requirements
- `database/README.md` - Database documentation
