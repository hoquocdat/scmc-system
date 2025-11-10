# SCMC Workshop Management System - Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Production Checklist](#production-checklist)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Git**: Latest version
- **Supabase Account**: Free tier is sufficient for testing

### Required Services
- Supabase project (database + auth)
- Domain name (for production)
- Hosting service (Vercel, Netlify, or similar)

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd saigonclassic
```

### 2. Install Dependencies

```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Or install separately
cd frontend && npm install
cd ../backend && npm install
```

### 3. Environment Variables

#### Backend (.env)
Create `/backend/.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
SUPABASE_DB_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres

# Application
NODE_ENV=development
PORT=3001

# CORS (update for production)
FRONTEND_URL=http://localhost:5173
```

#### Frontend (.env)
Create `/frontend/.env` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend API (update for production)
VITE_API_URL=http://localhost:3001
```

### 4. Get Supabase Credentials

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Create a new project (or use existing)
3. Navigate to **Settings > API**
4. Copy:
   - **Project URL** → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
5. Navigate to **Settings > Database**
6. Copy **Connection string** → `SUPABASE_DB_URL`

---

## Database Setup

### 1. Execute Schema Migration

1. Open Supabase SQL Editor
2. Navigate to your project
3. Click **SQL Editor** in left sidebar
4. Click **New query**
5. Copy contents of `/database/migrations/001_initial_schema.sql`
6. Paste into SQL editor
7. Click **Run** or press `Ctrl+Enter`
8. Verify success (should see "Success. No rows returned")

### 2. Verify Tables Created

Run this query to verify all tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- activity_logs
- bike_owners
- customers
- motorcycles
- parts
- payments
- service_items
- service_orders
- service_parts
- user_profiles

### 3. Create First User

Run this query to create an admin user:

```sql
-- First, sign up through Supabase Auth UI or API
-- Then, update the user profile:

INSERT INTO user_profiles (id, role, full_name, phone, email, is_active)
VALUES (
  'your-auth-user-id',  -- Get this from Supabase Auth Users table
  'manager',            -- Role: 'sales', 'technician', 'manager', or 'finance'
  'Admin User',
  '+1234567890',
  'admin@example.com',
  true
);
```

### 4. Seed Sample Data (Optional)

For testing, you can add sample data:

```sql
-- Sample bike owner
INSERT INTO bike_owners (owner_type, full_name, phone, email)
VALUES ('individual', 'John Doe', '+1234567890', 'john@example.com');

-- Sample customer
INSERT INTO customers (full_name, phone, email)
VALUES ('Jane Smith', '+0987654321', 'jane@example.com');

-- Sample parts
INSERT INTO parts (name, part_number, quantity_in_stock, minimum_stock_level, unit_cost)
VALUES
  ('Engine Oil Filter', 'EOF-001', 50, 10, 12.50),
  ('Brake Pads Front', 'BPF-002', 30, 5, 45.00),
  ('Spark Plug', 'SP-003', 100, 20, 8.00);
```

---

## Backend Deployment

### Development Mode

```bash
cd backend
npm run start:dev
```

Backend will run on `http://localhost:3001`

### Production Build

```bash
cd backend
npm run build
npm run start
```

### Deploy to Cloud Platform

#### Option 1: Heroku

```bash
# Install Heroku CLI
heroku create scmc-backend

# Set environment variables
heroku config:set SUPABASE_URL=your-url
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your-key
heroku config:set NODE_ENV=production

# Deploy
git subtree push --prefix backend heroku main
```

#### Option 2: Railway

1. Connect GitHub repository
2. Select backend folder as root
3. Add environment variables in Railway dashboard
4. Deploy automatically on push

#### Option 3: DigitalOcean App Platform

1. Connect repository
2. Select backend folder
3. Configure environment variables
4. Set build command: `npm install && npm run build`
5. Set run command: `npm run start`

### Update CORS Settings

In `/backend/src/main.ts`, update allowed origins:

```typescript
app.enableCors({
  origin: [
    'https://your-frontend-domain.com',
    'http://localhost:5173', // Keep for local development
  ],
  credentials: true,
});
```

---

## Frontend Deployment

### Development Mode

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:5173`

### Production Build

```bash
cd frontend
npm run build
```

Build output will be in `/frontend/dist`

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# Add environment variables in Vercel dashboard:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_API_URL (your backend URL)
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd frontend
netlify deploy --prod

# Add environment variables in Netlify dashboard
```

### Deploy to GitHub Pages

```bash
# Update vite.config.ts with base URL
# Add to package.json scripts:
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"

# Install gh-pages
npm install -D gh-pages

# Deploy
npm run deploy
```

---

## Production Checklist

### Security

- [ ] Update all environment variables to production values
- [ ] Change default passwords
- [ ] Enable HTTPS on all endpoints
- [ ] Configure proper CORS origins
- [ ] Review and test RLS policies
- [ ] Enable rate limiting (if needed)
- [ ] Set up Supabase Auth email templates
- [ ] Configure secure session timeout

### Performance

- [ ] Enable gzip compression
- [ ] Set up CDN for static assets
- [ ] Configure caching headers
- [ ] Optimize images
- [ ] Test with production data volumes
- [ ] Monitor query performance

### Database

- [ ] Verify all indexes are created
- [ ] Test RLS policies with all roles
- [ ] Set up database backups
- [ ] Configure connection pooling
- [ ] Review and optimize slow queries

### Frontend

- [ ] Build production bundle
- [ ] Test all pages and features
- [ ] Verify real-time subscriptions work
- [ ] Test on different browsers
- [ ] Test on mobile devices
- [ ] Check accessibility
- [ ] Test with slow network

### Backend

- [ ] Test all API endpoints
- [ ] Verify error handling
- [ ] Check logging is working
- [ ] Test with production database
- [ ] Verify authentication works
- [ ] Test role-based access

### Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Configure uptime monitoring
- [ ] Set up performance monitoring
- [ ] Configure log aggregation
- [ ] Set up alerts for critical errors
- [ ] Create status page

---

## Monitoring & Maintenance

### Supabase Dashboard

Monitor in Supabase Dashboard:
- Database usage and performance
- API request logs
- Auth metrics
- Storage usage
- Real-time connections

### Application Metrics

Key metrics to monitor:
- **Uptime**: Should be >99%
- **Response time**: Should be <2s
- **Error rate**: Should be <1%
- **Active users**: Track daily/monthly
- **Bikes in service**: Track trends
- **Revenue**: Track daily/weekly

### Regular Maintenance Tasks

**Daily:**
- Check error logs
- Monitor system uptime
- Review critical alerts

**Weekly:**
- Review performance metrics
- Check database size
- Review slow queries
- Update parts inventory

**Monthly:**
- Review user feedback
- Update dependencies
- Database performance review
- Backup verification
- Security audit

### Backup Strategy

**Supabase Backups:**
- Automatic daily backups (built-in)
- Point-in-time recovery available
- Export critical data weekly

**Database Export:**
```bash
# Export full database
pg_dump -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  --file=backup_$(date +%Y%m%d).sql

# Export specific tables
pg_dump -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  -t service_orders \
  -t payments \
  --file=critical_data_$(date +%Y%m%d).sql
```

---

## Troubleshooting

### Common Issues

#### 1. "Failed to fetch" or CORS errors

**Cause**: Backend URL not configured or CORS not allowing frontend origin

**Fix:**
```typescript
// backend/src/main.ts
app.enableCors({
  origin: ['https://your-frontend.com'],
  credentials: true,
});
```

#### 2. "Supabase client not initialized"

**Cause**: Missing or incorrect environment variables

**Fix:**
- Check `.env` file exists
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server

#### 3. Real-time subscriptions not working

**Cause**: Supabase Realtime not enabled or RLS blocking

**Fix:**
1. Enable Realtime in Supabase Dashboard
2. Check RLS policies allow SELECT
3. Verify subscription code:
```typescript
supabase
  .channel('channel-name')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'table_name' })
  .subscribe()
```

#### 4. Authentication not working

**Cause**: Incorrect Supabase keys or Auth settings

**Fix:**
1. Verify keys in Supabase Dashboard
2. Check Auth providers enabled
3. Test with Supabase Auth UI first
4. Review error messages in console

#### 5. Database connection failed

**Cause**: Incorrect connection string or IP restrictions

**Fix:**
1. Verify `SUPABASE_DB_URL` is correct
2. Check IP allowlist in Supabase
3. Ensure SSL mode is enabled

#### 6. Parts inventory not deducting

**Cause**: Database trigger not created

**Fix:**
```sql
-- Verify trigger exists
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'service_parts';

-- Recreate if needed (see schema migration)
```

### Debug Mode

Enable debug logging:

**Frontend:**
```typescript
// Add to src/lib/supabase.ts
export const supabase = createClient(url, key, {
  auth: {
    debug: true,
  },
})
```

**Backend:**
```typescript
// Add to main.ts
app.useLogger(['error', 'warn', 'debug', 'log']);
```

### Getting Help

**Resources:**
- [Supabase Documentation](https://supabase.com/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

**Support Channels:**
- Supabase Discord
- Stack Overflow
- GitHub Issues

---

## Post-Deployment Verification

### Verify All Features

1. **Authentication**
   - [ ] Sign in works
   - [ ] Sign out works
   - [ ] Role-based access working

2. **Dashboard**
   - [ ] Bikes in service counter shows
   - [ ] Real-time updates work
   - [ ] Stats are accurate

3. **Data Management**
   - [ ] Create bike owners
   - [ ] Create customers
   - [ ] Register motorcycles

4. **Service Orders**
   - [ ] Create service order
   - [ ] Update status
   - [ ] Add tasks
   - [ ] Record parts usage

5. **Technician View**
   - [ ] See assigned work
   - [ ] Update task status
   - [ ] Mark orders complete

6. **Parts Inventory**
   - [ ] Add parts
   - [ ] Adjust stock
   - [ ] View alerts

7. **Payments**
   - [ ] Record payment
   - [ ] View outstanding
   - [ ] Payment history

8. **Reports**
   - [ ] Revenue report
   - [ ] Technician performance
   - [ ] Parts usage
   - [ ] CSV export

---

## Scaling Considerations

### When to Scale

Consider scaling when:
- Response time >3 seconds consistently
- Database CPU >70% regularly
- Concurrent users >100
- Real-time connections >1000

### Scaling Options

**Database:**
- Upgrade Supabase plan
- Add read replicas
- Implement caching (Redis)

**Backend:**
- Horizontal scaling (multiple instances)
- Load balancer
- Container orchestration (Kubernetes)

**Frontend:**
- CDN for static assets
- Image optimization
- Code splitting

---

## Success Metrics

After deployment, track:
- ✅ System uptime >99%
- ✅ Page load time <2s
- ✅ User satisfaction >90%
- ✅ Zero critical bugs in production
- ✅ All features working as expected

---

## Conclusion

Your SCMC Workshop Management System is now deployed! 🎉

Regular monitoring and maintenance will ensure smooth operations. Keep this guide handy for troubleshooting and future deployments.

For questions or issues, refer to the troubleshooting section or reach out to the development team.

**Happy workshop managing!** 🏍️🔧
