# Phase 4: Service Monitoring - Implementation Plan

## Overview
Phase 4 is the **KEY FEATURE** of the SCMC Workshop Management System. It transforms the basic service order system into a comprehensive monitoring and task management platform with real-time visibility into workshop operations.

**Duration**: 2 weeks
**Status**: 🚧 In Progress
**Dependencies**: Phases 1-3 (100% Complete)

## Objectives

1. **Service Task Management**: Break down service orders into individual tasks/items
2. **Technician Workflow**: Dedicated view for technicians to manage their assigned work
3. **Enhanced Service Detail**: Comprehensive view showing tasks, parts, timeline, and activity
4. **Parts Usage Tracking**: Record parts used in each service with inventory deduction
5. **Activity Audit Trail**: Complete history of all actions on a service order
6. **Dashboard Enhancements**: Filters, quick views, and better navigation
7. **Real-time Progress**: Live updates of task completion and service progress

## Core Features to Implement

### 1. Service Items (Tasks) Management

**Database**: Already exists - `service_items` table

**Features**:
- Add multiple tasks/items to a service order
- Each task has: name, description, labor cost, parts cost, hours worked
- Task-level status tracking (independent of order status)
- Edit/delete tasks
- Calculate total cost from all tasks

**UI Components**:
- `ServiceItemsManager` - Component within service order detail
- Add task form (dialog/modal)
- Task list with inline editing
- Cost calculation summary

**Business Rules**:
- Only technicians and managers can add/edit tasks
- Task costs contribute to total service cost
- Deleting tasks doesn't affect completed payments
- Tasks can have different statuses than the parent order

### 2. Technician Work View

**New Page**: `TechnicianWorkPage.tsx`

**Features**:
- Shows only orders assigned to logged-in technician
- Quick status update buttons
- Task checklist for each order
- Add notes and update hours worked
- Mark tasks complete
- Request manager approval

**Filters**:
- By status (my pending, in progress, waiting approval)
- By priority
- By due date

**Layout**:
- Card-based view for each assigned order
- Motorcycle info + owner + customer
- Task progress bar (3 of 5 tasks complete)
- Quick actions: Update status, Add task, View details

### 3. Enhanced Service Detail View

**Enhance**: `ServiceOrderDetailPage.tsx`

**New Sections**:
- **Tasks/Items Section**: List of service items with progress
- **Parts Used Section**: List of parts with quantities and costs
- **Activity Timeline**: Complete audit log of all changes
- **Cost Breakdown**: Labor + parts = total
- **Progress Indicator**: Visual progress bar

**Features**:
- Tabbed interface for better organization:
  - Tab 1: Overview (existing info)
  - Tab 2: Tasks & Progress (new)
  - Tab 3: Parts Used (new)
  - Tab 4: Activity History (new)
  - Tab 5: Photos & Documents (placeholder for Phase 4+)

### 4. Parts Usage Recording

**Database**: `service_parts` table (already exists)

**Features**:
- Search/select part from inventory
- Specify quantity used
- Unit cost auto-filled from parts table
- Total cost calculated automatically
- Parts deducted from inventory on save
- Link parts to specific service items (optional)

**UI Component**: `PartsUsageManager`

**Business Rules**:
- Only technicians and managers can record parts usage
- Cannot use more parts than available in stock
- Parts cost added to service order total
- Inventory updated in real-time via trigger

### 5. Activity Log Viewer

**Database**: `activity_logs` table (already exists)

**Features**:
- Timeline view of all activities on service order
- Shows: who, what, when for every change
- Filter by action type (status change, task added, parts used, etc.)
- Icons for different action types
- Relative timestamps ("2 hours ago")

**UI Component**: `ActivityTimeline`

**Log Events**:
- Service order created
- Status changed (with before/after)
- Task added/updated/completed
- Part used
- Payment received
- Technician assigned/reassigned
- Notes added

### 6. Dashboard Enhancements

**Enhance**: `DashboardPage.tsx`

**New Features**:
- **Filter Panel**: Filter bikes in service by:
  - Status (dropdown multi-select)
  - Assigned technician (dropdown)
  - Priority (chips)
  - Overdue (toggle)
- **Quick View Cards**: Click to expand inline details
- **Technician Performance**: Tasks completed today per technician
- **Overdue Orders**: Orders past estimated completion date
- **Parts Alerts**: Low stock warnings

**Layout Improvements**:
- Grid layout for stats cards
- Filterable list of bikes in service
- Charts (optional): Status distribution, daily completions

### 7. Real-time Notifications

**Features**:
- Toast notifications for real-time updates
- Bell icon with notification count
- Notification types:
  - Order assigned to you
  - Order status changed
  - Approval required
  - Part usage recorded
- Notification preferences (future)

**Implementation**:
- Supabase Realtime subscriptions
- Zustand store for notifications
- Toast component (shadcn)
- Notification center (dropdown)

## Technical Architecture

### Frontend Structure

```
frontend/src/
├── components/
│   ├── service-items/
│   │   ├── ServiceItemsManager.tsx    (NEW)
│   │   ├── ServiceItemForm.tsx        (NEW)
│   │   └── ServiceItemCard.tsx        (NEW)
│   ├── parts/
│   │   ├── PartsUsageManager.tsx      (NEW)
│   │   └── PartsSelector.tsx          (NEW)
│   ├── activity/
│   │   ├── ActivityTimeline.tsx       (NEW)
│   │   └── ActivityItem.tsx           (NEW)
│   ├── notifications/
│   │   ├── NotificationBell.tsx       (NEW)
│   │   └── NotificationCenter.tsx     (NEW)
│   └── ui/
│       ├── tabs.tsx                   (NEW - Shadcn)
│       ├── toast.tsx                  (NEW - Shadcn)
│       ├── progress.tsx               (NEW - Shadcn)
│       └── separator.tsx              (NEW - Shadcn)
├── pages/
│   ├── TechnicianWorkPage.tsx         (NEW)
│   ├── ServiceOrderDetailPage.tsx     (ENHANCE)
│   └── DashboardPage.tsx              (ENHANCE)
├── store/
│   └── notificationStore.ts           (NEW)
└── types/
    └── index.ts                       (ADD service_items, parts, activity_logs)
```

### Database Queries

**Service Items**:
```sql
-- Get all tasks for a service order
SELECT * FROM service_items WHERE service_order_id = $1 ORDER BY created_at;

-- Add task
INSERT INTO service_items (service_order_id, name, description, labor_cost, hours_worked)
VALUES ($1, $2, $3, $4, $5);

-- Update task status
UPDATE service_items SET status = $1, hours_worked = $2 WHERE id = $3;
```

**Parts Usage**:
```sql
-- Get parts used in service
SELECT sp.*, p.name, p.part_number
FROM service_parts sp
JOIN parts p ON sp.part_id = p.id
WHERE sp.service_order_id = $1;

-- Record part usage (inventory trigger fires automatically)
INSERT INTO service_parts (service_order_id, part_id, quantity_used, unit_cost)
VALUES ($1, $2, $3, $4);
```

**Activity Log**:
```sql
-- Get activity for service order
SELECT al.*, up.full_name as user_name
FROM activity_logs al
LEFT JOIN user_profiles up ON al.user_id = up.id
WHERE al.entity_type = 'service_order' AND al.entity_id = $1
ORDER BY al.created_at DESC;

-- Log activity
INSERT INTO activity_logs (entity_type, entity_id, user_id, action, details)
VALUES ('service_order', $1, $2, 'status_changed', $3);
```

**Technician Work**:
```sql
-- Get orders assigned to technician
SELECT so.*, m.license_plate, m.brand, m.model,
  COUNT(si.id) as total_tasks,
  COUNT(si.id) FILTER (WHERE si.status = 'completed') as completed_tasks
FROM service_orders so
JOIN motorcycles m ON so.motorcycle_id = m.id
LEFT JOIN service_items si ON so.id = si.service_order_id
WHERE so.assigned_technician_id = $1
  AND so.status NOT IN ('delivered', 'cancelled')
GROUP BY so.id, m.id;
```

## Implementation Order

### Week 1: Core Task & Parts Management

**Day 1-2**: Service Items Management
- [ ] Add TypeScript types for service_items
- [ ] Create ServiceItemsManager component
- [ ] Create ServiceItemForm (add/edit dialog)
- [ ] Integrate into ServiceOrderDetailPage
- [ ] Test CRUD operations

**Day 3-4**: Parts Usage Recording
- [ ] Add TypeScript types for parts and service_parts
- [ ] Create PartsUsageManager component
- [ ] Create PartsSelector (search parts inventory)
- [ ] Implement quantity validation (stock check)
- [ ] Test inventory deduction trigger
- [ ] Integrate into ServiceOrderDetailPage

**Day 5**: Activity Log
- [ ] Add TypeScript types for activity_logs
- [ ] Create ActivityTimeline component
- [ ] Create ActivityItem component (with icons)
- [ ] Integrate into ServiceOrderDetailPage
- [ ] Add logging to service order updates

### Week 2: Technician View & Dashboard Enhancements

**Day 1-2**: Technician Work View
- [ ] Create TechnicianWorkPage component
- [ ] Build assigned orders query with task counts
- [ ] Create order card layout
- [ ] Add task checklist per order
- [ ] Implement quick status updates
- [ ] Add filters (status, priority)
- [ ] Add to navigation menu

**Day 3-4**: Enhanced Service Detail
- [ ] Add Tabs component (Shadcn)
- [ ] Refactor ServiceOrderDetailPage with tabs
- [ ] Add progress indicators
- [ ] Add cost breakdown section
- [ ] Polish UI and transitions
- [ ] Mobile responsive adjustments

**Day 5**: Dashboard & Notifications
- [ ] Add filter panel to DashboardPage
- [ ] Implement status/technician/priority filters
- [ ] Add overdue orders indicator
- [ ] Create NotificationBell component
- [ ] Create NotificationCenter
- [ ] Set up Supabase realtime for notifications
- [ ] Add toast notifications
- [ ] Testing and bug fixes

## UI/UX Mockups

### Service Detail with Tabs

```
┌────────────────────────────────────────────────────────────────┐
│ Service Order SO-20251021-0001                          [Back] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [Overview] [Tasks] [Parts] [Activity] [Photos]                │
│ ─────────                                                       │
│                                                                 │
│ TASKS & PROGRESS                                    [Add Task] │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ ✓ Oil Change                                  3.5 hrs    │  │
│ │   Status: Completed | Labor: $50 | Parts: $30           │  │
│ │   [View Details]                                         │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ ⊙ Brake Inspection                            1.0 hrs    │  │
│ │   Status: In Progress | Labor: $40 | Parts: $0          │  │
│ │   [Update] [Complete]                                    │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ ○ Chain Adjustment                            0.5 hrs    │  │
│ │   Status: Pending | Labor: $20 | Parts: $0              │  │
│ │   [Start] [Edit]                                         │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│ Progress: ████████░░░░░░░░ 40% (2 of 5 tasks)                 │
│                                                                 │
│ COST SUMMARY                                                    │
│ Labor Cost:  $110                                               │
│ Parts Cost:   $30                                               │
│ ─────────────────                                               │
│ Total:       $140                                               │
└────────────────────────────────────────────────────────────────┘
```

### Technician Work View

```
┌────────────────────────────────────────────────────────────────┐
│ My Assigned Work                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Filters: [All Status ▾] [High Priority] [Due Today]           │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ SO-20251021-0001           [HIGH]    Due: Today 5:00 PM  │  │
│ │ Honda CBR150 (59A1-12345)                                │  │
│ │ Owner: John Smith | Customer: Jane Doe                   │  │
│ │                                                           │  │
│ │ Tasks: ████████░░ 80% (4 of 5 complete)                  │  │
│ │                                                           │  │
│ │ Status: [In Progress ▾] [View Details] [Complete]       │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ SO-20251021-0002           [NORMAL]  Due: Tomorrow       │  │
│ │ Yamaha Exciter (51F-98765)                               │  │
│ │ Owner: ABC Company | Customer: Mike Johnson              │  │
│ │                                                           │  │
│ │ Tasks: ██░░░░░░░░ 20% (1 of 5 complete)                  │  │
│ │                                                           │  │
│ │ Status: [Confirmed ▾] [View Details] [Start]            │  │
│ └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Supabase Realtime Subscriptions

```typescript
// Subscribe to service items changes
supabase
  .channel('service-items-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'service_items',
    filter: `service_order_id=eq.${orderId}`
  }, (payload) => {
    // Update local state
  })
  .subscribe();

// Subscribe to activity logs
supabase
  .channel('activity-logs')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'activity_logs',
    filter: `entity_id=eq.${orderId}`
  }, (payload) => {
    // Show notification
  })
  .subscribe();
```

## Testing Checklist

### Service Items
- [ ] Add task to service order
- [ ] Edit task details
- [ ] Update task status
- [ ] Record hours worked
- [ ] Delete task
- [ ] Verify costs calculate correctly
- [ ] Check multiple tasks per order

### Parts Usage
- [ ] Search and select part from inventory
- [ ] Record quantity used
- [ ] Verify inventory deduction
- [ ] Check cost calculation
- [ ] Test insufficient stock validation
- [ ] Link part to specific task (optional)

### Technician View
- [ ] Login as technician
- [ ] See only assigned orders
- [ ] Filter by status
- [ ] Update task status
- [ ] Mark task complete
- [ ] Update service order status
- [ ] Request approval

### Activity Log
- [ ] View activity timeline
- [ ] Verify all actions logged
- [ ] Check timestamps
- [ ] Filter by action type
- [ ] Icons display correctly

### Dashboard Filters
- [ ] Filter by status (multiple)
- [ ] Filter by technician
- [ ] Filter by priority
- [ ] Show overdue orders
- [ ] Clear filters
- [ ] Filters persist on refresh (optional)

### Real-time Updates
- [ ] Create task in one window, see in another
- [ ] Update status, dashboard updates
- [ ] Record part usage, inventory updates
- [ ] Notification appears for relevant users

## Success Criteria

Phase 4 is complete when:

1. ✅ Technicians can add/edit/delete tasks within service orders
2. ✅ Technicians have dedicated work view showing assigned orders
3. ✅ Parts can be recorded and inventory auto-deducts
4. ✅ Complete activity log shows all changes
5. ✅ Service detail page has tabbed interface
6. ✅ Dashboard has working filters
7. ✅ Real-time updates work across all components
8. ✅ Progress indicators show task completion
9. ✅ Cost calculations include labor + parts
10. ✅ All features tested and documented

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Realtime subscriptions fail | High | Implement fallback polling |
| Complex state management | Medium | Use Zustand stores per feature |
| Performance with many tasks | Medium | Implement pagination for task lists |
| Inventory deduction errors | High | Test trigger thoroughly, add validation |
| Mobile responsiveness issues | Low | Test on mobile early, use responsive design |

## Phase 4 Deliverables

1. **Service Items Manager** - Full CRUD for tasks
2. **Technician Work Page** - Dedicated view for technicians
3. **Parts Usage Manager** - Record parts with inventory integration
4. **Activity Timeline** - Complete audit trail
5. **Enhanced Service Detail** - Tabbed interface with all info
6. **Dashboard Filters** - Multi-criteria filtering
7. **Real-time Notifications** - Toast + notification center
8. **Progress Indicators** - Visual task completion
9. **Cost Breakdown** - Labor + parts summary
10. **Phase 4 Documentation** - Usage guide and summary

## Next Phase Preview

**Phase 5: Parts & Inventory Management**
- Full parts inventory CRUD
- Stock level monitoring
- Low stock alerts
- Parts catalog with categories
- Supplier management
- Reorder point automation

---

**Phase 4 Status**: 🚧 **IN PROGRESS**
**Estimated Completion**: 2 weeks from start
**Current Progress**: 0% (Planning complete, ready to code)
