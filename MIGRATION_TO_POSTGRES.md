# Migration from Supabase to PostgreSQL with Prisma

## Overview

The backend has been migrated to use:
- **PostgreSQL** (hosted) for database operations
- **Supabase Auth** only for authentication and user management
- **Prisma ORM** instead of Supabase client for database queries

## What Changed

### Before
- Supabase SDK for both database and authentication
- Database hosted on Supabase
- `supabase` client used throughout services

### After
- **PostgreSQL** hosted separately (you choose your provider)
- **Prisma ORM** for type-safe database operations
- **Supabase Auth** SDK only for authentication
- Prisma Client generated from your database schema

## Environment Variables

Update your `.env` file:

```env
# PostgreSQL Database (Required)
DATABASE_URL="postgresql://username:password@host:port/database?schema=public"

# Supabase Auth Only (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret

# Server
PORT=3001
```

### For Production PostgreSQL Providers

**Supabase Postgres** (if you still want to use Supabase for database):
```
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

**Railway**:
```
DATABASE_URL="postgresql://postgres:password@containers-us-west-xx.railway.app:5432/railway"
```

**Render**:
```
DATABASE_URL="postgresql://user:password@dpg-xxxxx-a.oregon-postgres.render.com/dbname"
```

**Neon**:
```
DATABASE_URL="postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb"
```

**AWS RDS**:
```
DATABASE_URL="postgresql://postgres:password@database.xxxxx.us-east-1.rds.amazonaws.com:5432/mydb"
```

## Setup Steps

### 1. Install Dependencies (Already Done)

```bash
cd backend
npm install @prisma/client
npm install --save-dev prisma
```

### 2. Setup Your PostgreSQL Database

Choose one of the following options:

#### Option A: Use Supabase Postgres (Keep Supabase database)
1. Go to https://app.supabase.com/project/_/settings/database
2. Copy the "Connection string" with `postgres://` format
3. Add to `.env` as `DATABASE_URL`

#### Option B: Use a Different Provider
1. Create a PostgreSQL database on your chosen provider
2. Get the connection string
3. Add to `.env` as `DATABASE_URL`

### 3. Run Migrations

Apply the existing migrations to your new database:

```bash
# If using Supabase local migrations
cd ../supabase
npx supabase db push

# OR manually run migration SQL files on your PostgreSQL database
psql $DATABASE_URL < supabase/migrations/*.sql
```

### 4. Generate Prisma Client

```bash
cd backend
npx prisma generate
```

### 5. Verify Connection

```bash
npx prisma db pull  # This will verify your connection works
npm run start:dev   # Start the backend
```

## Updating Services to Use Prisma

The brands service has been updated as an example. Follow this pattern for other services:

### Before (Supabase):
```typescript
import { supabase } from '../config/supabase.config';

async findAll() {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('name');

  if (error) throw new Error(error.message);
  return data;
}
```

### After (Prisma):
```typescript
import { PrismaService } from '../prisma/prisma.service';

constructor(private prisma: PrismaService) {}

async findAll() {
  return this.prisma.brands.findMany({
    orderBy: { name: 'asc' },
    where: { is_active: true },
  });
}
```

## Prisma Benefits

1. **Type Safety**: Full TypeScript support with auto-generated types
2. **Auto-completion**: IntelliSense for all database operations
3. **Migrations**: Built-in migration system
4. **Performance**: Efficient query generation
5. **Relations**: Easy to work with related data
6. **Database Agnostic**: Easy to switch databases if needed

## Common Prisma Operations

### Find Many
```typescript
const brands = await this.prisma.brands.findMany({
  where: { is_active: true },
  orderBy: { name: 'asc' },
  include: { models: true }, // Include relations
});
```

### Find Unique
```typescript
const brand = await this.prisma.brands.findUnique({
  where: { id: brandId },
});
```

### Create
```typescript
const brand = await this.prisma.brands.create({
  data: {
    name: 'Honda',
    country_of_origin: 'Japan',
  },
});
```

### Update
```typescript
const brand = await this.prisma.brands.update({
  where: { id: brandId },
  data: { name: 'Updated Name' },
});
```

### Delete
```typescript
await this.prisma.brands.delete({
  where: { id: brandId },
});
```

### Transactions
```typescript
await this.prisma.$transaction([
  this.prisma.brands.create({ data: brand1 }),
  this.prisma.brands.create({ data: brand2 }),
]);
```

## Supabase Auth (Still Used)

Authentication continues to use Supabase Auth:

```typescript
// This stays the same
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Use for auth only
const { data, error } = await supabase.auth.getUser(token);
```

## Migration Checklist

- [ ] Set up PostgreSQL database
- [ ] Update `DATABASE_URL` in `.env`
- [ ] Run migrations on new database
- [ ] Generate Prisma Client
- [ ] Test connection
- [ ] Update all services to use Prisma (brands service is done as example)
- [ ] Remove `supabase.config.ts` once all services are migrated
- [ ] Update auth guards to work with Prisma for user lookups

## Troubleshooting

### Connection Issues
```bash
# Test connection
npx prisma db pull
```

### Schema Changes
```bash
# Pull latest schema from database
npx prisma db pull

# Generate new client
npx prisma generate
```

### Type Errors
Make sure to regenerate Prisma Client after any schema changes:
```bash
npx prisma generate
```

## Next Steps

1. Update remaining services (customers, bikes, service-orders, etc.) to use Prisma
2. Remove Supabase client imports from all services except auth
3. Test all endpoints
4. Deploy to production with your PostgreSQL provider

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma with NestJS](https://docs.nestjs.com/recipes/prisma)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
