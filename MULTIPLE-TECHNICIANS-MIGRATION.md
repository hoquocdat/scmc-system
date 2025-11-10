# Multiple Technicians Support Migration

## Overview
This update adds support for assigning multiple technicians to a single service order.

## Database Changes

### New Table: `service_order_technicians`
A junction table that enables many-to-many relationship between service orders and technicians.

**Columns:**
- `id` (UUID, Primary Key)
- `service_order_id` (UUID, Foreign Key to service_orders)
- `technician_id` (UUID, Foreign Key to user_profiles)
- `assigned_at` (Timestamp)
- `is_primary` (Boolean) - Marks the lead/primary technician
- `created_at` (Timestamp)

## Migration Steps

### 1. Run the Database Migration

Execute the SQL migration in your Supabase SQL Editor:

```bash
# Location: /database/migrations/003_service_order_multiple_technicians.sql
```

Or copy and paste this SQL directly:

```sql
-- Create the junction table
CREATE TABLE IF NOT EXISTS service_order_technicians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(service_order_id, technician_id)
);

CREATE INDEX idx_service_order_technicians_order ON service_order_technicians(service_order_id);
CREATE INDEX idx_service_order_technicians_technician ON service_order_technicians(technician_id);
CREATE INDEX idx_service_order_technicians_primary ON service_order_technicians(service_order_id, is_primary);

-- Migrate existing data
INSERT INTO service_order_technicians (service_order_id, technician_id, is_primary)
SELECT id, assigned_technician_id, true
FROM service_orders
WHERE assigned_technician_id IS NOT NULL;
```

## Backend Changes

### 1. Updated DTOs
- `CreateServiceOrderDto` now accepts `technician_ids: string[]` (array of technician IDs)
- Backward compatible: still accepts `assigned_technician_id` (single technician)

### 2. New Service Method
- `getTechnicians(serviceOrderId)` - Retrieves all assigned technicians for a service order

### 3. New API Endpoint
- `GET /api/service-orders/:id/technicians` - Returns list of assigned technicians

### 4. Updated create() Method
- When `technician_ids` array is provided, automatically creates records in the junction table
- First technician in array is marked as primary (`is_primary = true`)

## Frontend Changes (To Be Implemented)

### Update ServiceOrdersPage Form
- Change from single-select dropdown to multi-select for technicians
- Allow selecting multiple technicians when creating a service order
- Display all assigned technicians in the service order list

### Update ServiceOrderDetailPage
- Show all assigned technicians (not just primary)
- Indicate which technician is primary
- Add UI to add/remove technicians from an existing order

## Usage

### Creating a Service Order with Multiple Technicians

**Frontend:**
```typescript
const payload = {
  motorcycle_id: '...',
  customer_id: '...',
  technician_ids: ['tech-id-1', 'tech-id-2', 'tech-id-3'], // Multiple technicians
  priority: 'normal',
  // ... other fields
};

await apiClient.serviceOrders.create(payload);
```

**Backend will:**
1. Create the service order
2. Assign all technicians in the array
3. Mark the first technician as primary

### Retrieving Assigned Technicians

```typescript
const technicians = await apiClient.serviceOrders.getTechnicians(orderId);
// Returns: [{ technician: { id, full_name, email }, is_primary: true }, ...]
```

## Backward Compatibility

- The old `assigned_technician_id` field is preserved for backward compatibility
- Existing service orders with a single technician have been migrated to the junction table
- The system supports both single and multiple technician assignment methods

## Testing Checklist

- [ ] Run the database migration in Supabase
- [ ] Verify `service_order_technicians` table is created
- [ ] Verify existing single-technician assignments are migrated
- [ ] Test creating a service order with multiple technicians via API
- [ ] Test retrieving technicians for a service order
- [ ] Update frontend forms to support multiple technician selection
- [ ] Test the complete workflow end-to-end

## Notes

- The `assigned_technician_id` column in `service_orders` table can be removed in a future migration after confirming everything works correctly
- Consider adding UI to mark/change the primary technician after creation
- Consider adding permissions to restrict who can assign/remove technicians
