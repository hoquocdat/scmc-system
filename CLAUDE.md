# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 CRITICAL DEVELOPMENT STANDARDS (READ FIRST)

**These rules MUST be followed for ALL code changes:**

### 1. Data Fetching Pattern (MANDATORY)
- **ALWAYS use TanStack Query (React Query)** for ALL data fetching operations
- **useQuery**: For fetching/reading data from the server
- **useMutation**: For create, update, delete operations
- **NEVER use useEffect + useState** for data fetching
- **NEVER use direct API calls** without wrapping in useQuery/useMutation

```tsx
// ✅ CORRECT - Use useQuery
const { data, isLoading, refetch } = useQuery({
  queryKey: ['resource', id],
  queryFn: async () => await apiClient.resource.get(id),
});

// ❌ WRONG - Don't use useEffect for data fetching
useEffect(() => {
  fetch('/api/resource').then(setData);
}, []);
```

### 2. UI Components (MANDATORY)
- **ALWAYS use Shadcn UI components** for all UI elements
- **NEVER create custom UI components** when Shadcn equivalent exists
- Available Shadcn components: Button, Input, Select, Dialog, Sheet, Card, Table, Badge, etc.
- Reference: [Shadcn UI Documentation](https://ui.shadcn.com/)

### 3. Component Architecture (MANDATORY)
- **ALWAYS maintain clean structure**: `pages/` → `components/` → `ui/`
- **ALWAYS break down large pages** (>200 lines) into smaller, reusable components
- **ALWAYS extract reusable logic** into separate components
- **ALWAYS create generic, reusable components** when possible

```
pages/
  ├── EmployeesPage.tsx (main page, <150 lines)
components/
  ├── employees/
  │   ├── EmployeeFormDialog.tsx (specific component)
  │   └── EmployeeTableColumns.tsx (specific logic)
  └── ui/
      ├── data-table/
      │   └── DataTable.tsx (generic, reusable)
      └── ... (shadcn components)
```

**Component Breakdown Guidelines:**
- Main page file should be < 200 lines
- Extract forms into separate Dialog/Sheet components
- Extract table columns into factory functions
- Create generic components (like DataTable) for app-wide reuse
- Each component should have a single responsibility

---

## Project Overview

SCMC Workshop Management System - A comprehensive motorcycle workshop management system built to digitize and streamline service operations. The system tracks bikes in service, manages service orders, handles customer/owner relationships, and provides real-time monitoring of workshop operations.

## Technology Stack

**Frontend:**
- React 18 with Vite
- Shadcn UI components
- Tailwind CSS
- TanStack Query (React Query) for data fetching and caching
- React Router v6
- Real-time updates via polling or WebSocket

**Backend:**
- NestJS
- REST API
- JWT-based authentication
- Prisma ORM
- Custom Guards + Decorators for authorization

**Database:**
- PostgreSQL (Local development via Docker/Supabase CLI)
- Prisma for database schema and migrations
- PostgreSQL native features for data integrity

## Key Architecture Concepts

### User Roles & Access Control
The system has strict role-based access control (RBAC):
- **Sales Staff**: Create service orders, register customers/owners, schedule appointments
- **Technician**: View assigned work, update progress, record parts usage
- **Manager**: Monitor all operations, assign technicians, approve work, view analytics
- **Finance**: Process payments, generate invoices, track receivables

All endpoints must enforce role-based permissions using custom guards.

### Critical Data Distinction: Owner vs Customer
**This is a key business requirement that must be maintained throughout the codebase:**
- **Bike Owner** = Legal registered owner of the motorcycle (may be individual or company)
- **Customer** = Person physically bringing the bike for service (may or may not be the owner)
- A service order must track BOTH entities separately
- Invoices are addressed to the owner, not necessarily the customer
- The system must handle authorization for non-owners to bring bikes

### Data Fetching with TanStack Query
The frontend uses TanStack Query (React Query) for all server state management:
- **useQuery**: For fetching data (service orders, customers, motorcycles, etc.)
- **useMutation**: For mutations (create, update, delete operations)
- **queryClient.invalidateQueries**: To refresh data after mutations
- **Query Keys**: Always include relevant filters in query keys for proper cache management
  - Example: `['serviceOrders', searchQuery, statusFilter, priorityFilter, employeeFilter]`
- **URL State Management**: Derive filter state from URL params using `useSearchParams` and `useMemo` to ensure filters persist on page refresh

### Real-time Updates
The dashboard must show live counts of bikes in service. When a technician updates a service status, all connected users (especially managers) should see updates promptly. This can be implemented using polling with TanStack Query's refetch intervals or WebSocket connections.

### Service Order Lifecycle
Service orders progress through multiple states:
- Pending → Confirmed → In Progress → Waiting Parts → Waiting Approval → Quality Check → Completed → Ready for Pickup → Delivered → Cancelled

The "Bikes in Service" count includes all orders EXCEPT "Delivered" and "Cancelled".

## Data Model Key Relationships

- Bike Owner → has many → Motorcycles
- Customer → can bring → many Motorcycles (with authorization)
- Motorcycle → has many → Service Orders
- Service Order → references → one Bike Owner (legal owner)
- Service Order → references → one Customer (person who brought it)
- Service Order → has many → Service Items (tasks)
- Service Order → has many → Payments
- User (Technician) → assigned to → many Service Orders

## Development Commands

### Frontend (React + Vite)
```bash
cd frontend
npm install           # Install dependencies
npm run dev          # Start dev server at http://localhost:5173
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Backend (NestJS)
```bash
cd backend
npm install           # Install dependencies
npm run start        # Start in production mode
npm run start:dev    # Start in development mode (watch mode)
npm run start:debug  # Start in debug mode
npm run build        # Build for production
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
npm run test:cov     # Run tests with coverage

# CLI Commands (using Nest Commander)
npm run cli -- --help            # Show all available CLI commands
npm run cli -- create:user       # Create a new user interactively
```

**Note**: The project uses **Nest Commander** for CLI commands. See [CLI_USAGE.md](backend/CLI_USAGE.md) for details.

### Database Setup

**IMPORTANT: We are NO LONGER using Supabase for this project.**

The project uses a standalone PostgreSQL database running in Docker:
- Container name: `backbone_postgres`
- Port: `5432`
- Database: `scmc_sms`
- User: `backbone_user`
- Password: `backbone_password`

1. Ensure PostgreSQL Docker container is running:
   ```bash
   docker ps | grep backbone_postgres
   ```

2. Copy `.env.example` to `.env` in both frontend and backend directories

3. Configure database connection in backend `.env`:
   ```
   DATABASE_URL="postgresql://backbone_user:backbone_password@127.0.0.1:5432/scmc_sms"
   ```

4. Apply database migrations (raw SQL files in prisma/migrations/):
   ```bash
   cd backend
   # Apply base migration
   cat prisma/migrations/20251107045751_init_public_schema_only/migration.sql | \
     docker exec -i backbone_postgres psql -U backbone_user -d scmc_sms

   # Apply POS foundation
   cat prisma/migrations/005_pos_foundation.sql | \
     docker exec -i backbone_postgres psql -U backbone_user -d scmc_sms

   # Pull latest schema and regenerate client
   npx prisma db pull
   npx prisma generate
   ```

5. Seed the database (optional):
   ```bash
   npm run seed                  # Run seed scripts
   ```

### Database Migrations
When making schema changes:
1. Create a raw SQL migration file in `prisma/migrations/` (e.g., `006_add_new_feature.sql`)
2. Apply the migration to the PostgreSQL database:
   ```bash
   cat prisma/migrations/006_add_new_feature.sql | \
     docker exec -i backbone_postgres psql -U backbone_user -d scmc_sms
   ```
3. Pull the updated schema and regenerate Prisma client:
   ```bash
   npx prisma db pull      # Updates prisma/schema.prisma from database
   npx prisma generate     # Generates TypeScript types
   ```

**Note**: We use raw SQL migrations and `prisma db pull` instead of `prisma migrate` to maintain full control over the database schema.

## Critical Business Rules to Enforce

1. **Owner-Customer Separation**: Never conflate bike owner with customer. Both must be captured in service orders.

2. **Dashboard Updates**: The bikes-in-service counter is a critical feature. All status changes should be reflected in the dashboard. Use TanStack Query's automatic refetching or implement polling for near real-time updates.

3. **Service Status Calculation**: Only count bikes with status other than "Delivered" or "Cancelled" as "in service".

4. **Role-based Access**: All API endpoints must verify user roles. Technicians cannot access finance functions, sales cannot approve work, etc.

5. **Audit Trail**: The system must log all critical operations via Activity Log for compliance and debugging.

6. **Payment Authorization**: Only Finance role can process payments and mark invoices as paid.

7. **Service Order Numbers**: Must be unique and auto-incrementing. Never reuse cancelled order numbers.

## Project Phases

The project follows an 8-phase development plan (13 weeks total):
1. Setup & Foundation (2 weeks)
2. Core Data Management (2 weeks)
3. Service Order System (2 weeks)
4. **Service Monitoring - KEY FEATURE** (2 weeks)
5. Parts & Inventory (1.5 weeks)
6. Payments & Finance (1.5 weeks)
7. Reports & Analytics (1 week)
8. Testing & Deployment (1 week)

## MVP Requirements

The minimum viable product must include:
- User authentication with JWT and role-based access
- Register bike owners and customers (with distinction)
- Add motorcycles linked to owners
- Create service orders tracking both owner and customer
- Dashboard showing current count of bikes in service
- View detailed service information for each bike
- Update service status with automatic data refresh
- Assign technicians to service orders
- Basic payment tracking

## Performance Requirements

- Dashboard must load within 2 seconds
- Data updates should reflect within a few seconds via polling/refetch
- System must handle 100 concurrent users
- Database must support 10,000+ service orders
- Use TanStack Query for efficient caching and background data synchronization

## Database Schema Considerations

Core entities to implement:
- user_profiles (staff with roles)
- bike_owners (individuals or companies)
- customers (people bringing bikes)
- motorcycles (linked to owners)
- service_orders (tracks owner + customer + bike)
- service_items (tasks within orders)
- parts (inventory)
- service_parts (parts used per service)
- payments (payment transactions)
- activity_logs (audit trail)

## UI/UX Patterns & Standards

### Filter Pattern
When implementing filtering functionality in list/table pages:
- **Use a "Lọc" (Filter) button** that opens a Sheet/Modal with the filter form
- **DO NOT** embed filter controls directly in the toolbar or use popovers for filters
- **Filter Sheet should contain:**
  - Multi-select dropdowns for each filter criteria (Status, Priority, Employee, etc.)
  - "Xóa Bộ Lọc" (Clear Filters) button
  - "Áp Dụng" (Apply) button to close the sheet
- **Below the toolbar:**
  - Show active filter badges with individual remove buttons
  - Display count of active filters
  - Provide "Xóa tất cả" (Clear All) button when filters are active
- **This pattern provides:**
  - Clean, uncluttered UI
  - Standard user experience across all pages
  - Easy-to-use filter management
  - Mobile-friendly interface

### Sheet Component Standards
When using Sheet components for forms, filters, or any side panels:
- **Sheet should slide from the right side**
- **Always add proper padding:**
  - SheetHeader: `className="px-6"` for horizontal padding
  - Content area: `className="px-6 py-6"` for all-around padding
  - SheetFooter: `className="px-6 pb-6"` for horizontal and bottom padding
- **SheetContent should have:**
  - `className="overflow-y-auto"` for scrollable content
  - Appropriate max-width (e.g., `sm:max-w-lg` for filters, `sm:max-w-2xl` for forms)
- **Include clear title in SheetHeader**
- **Include footer with action buttons** (Cancel and Submit/Apply)

Example structure:
```tsx
<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent className="overflow-y-auto sm:max-w-lg">
    <SheetHeader className="px-6">
      <SheetTitle>Title</SheetTitle>
    </SheetHeader>
    <div className="px-6 py-6">
      {/* Content */}
    </div>
    <SheetFooter className="px-6 pb-6">
      {/* Buttons */}
    </SheetFooter>
  </SheetContent>
</Sheet>
```
