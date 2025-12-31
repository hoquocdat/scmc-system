# Purchase Order Filtering Guide

## How to Access Purchase Orders for a Specific Supplier

There are **three ways** to view purchase orders for a specific supplier:

---

## ✅ Method 1: Supplier Details Page (Recommended)

**Best for**: Viewing all purchase orders and financial history for a single supplier

### Navigation:
```
/suppliers/:id
```

### What You Get:
The Supplier Details Page has **three tabs** with complete purchase order information:

#### Tab 1: "Đơn hàng chưa thanh toán" (Outstanding Purchase Orders)
- Shows purchase orders that are **not fully paid**
- Displays:
  - Order number
  - Order date
  - Total amount
  - Paid amount
  - Balance due (highlighted in red)
  - Payment status badge
  - "Chi tiết" button → Links to full PO details

#### Tab 2: "Lịch sử giao dịch" (Transaction History)
- Shows all financial transactions with this supplier:
  - Purchases (blue badge)
  - Returns (orange badge)
  - Payments (green badge)
- Each transaction shows:
  - Reference number
  - Date & time
  - Amount
  - Notes

#### Tab 3: "Lịch sử mua hàng" (Purchase History)
- Shows **ALL approved purchase orders** for this supplier
- Displays:
  - Order number
  - Order date
  - Status badge
  - Total amount
  - Paid amount
  - Payment status badge
  - "Chi tiết" button → Links to full PO details

### How to Navigate:
1. Go to Suppliers page (`/suppliers`)
2. Find your supplier in the list
3. Click on the supplier name or "Chi tiết" button
4. View purchase orders in any of the three tabs

---

## ✅ Method 2: Filter on Purchase Orders Page (NEW!)

**Best for**: Filtering purchase orders by supplier along with other criteria

### Navigation:
```
/inventory/purchase-orders
```

### How to Filter by Supplier:

1. **Click "Lọc" button** (Filter button with filter count badge)
2. **Filter Sheet opens** on the right side
3. **Select Supplier** from the "Nhà cung cấp" dropdown
   - Shows all suppliers in the system
   - Searchable dropdown
4. **Optional**: Combine with other filters:
   - Search (order number, supplier name)
   - Status (draft, pending approval, approved, rejected, cancelled)
   - Payment Status (unpaid, partially paid, paid)
   - Order Date Range (from/to)
5. **Click "Áp dụng"** (Apply) to filter

### Active Filter Badges:
After applying filters, you'll see active filter badges below the toolbar:
- **NCC: [Supplier Name]** - Supplier filter badge
- Each badge has an **X button** to remove that specific filter
- **"Xóa tất cả"** button to clear all filters at once

### Example Usage:
**Find all unpaid purchase orders for "ABC Supplies":**
1. Click "Lọc"
2. Select "ABC Supplies" from "Nhà cung cấp" dropdown
3. Select "Chưa thanh toán" (Unpaid) from "Trạng thái thanh toán"
4. Click "Áp dụng"
5. Results show all unpaid POs from ABC Supplies

---

## ✅ Method 3: Direct URL with Query Parameters

**Best for**: Bookmarking, sharing links, or programmatic access

### URL Format:
```
/inventory/purchase-orders?supplier_id={supplierId}
```

### Example:
```
/inventory/purchase-orders?supplier_id=550e8400-e29b-41d4-a716-446655440000
```

### Combine Multiple Filters:
```
/inventory/purchase-orders?supplier_id={id}&status=approved&payment_status=unpaid
```

### All Available Query Parameters:
- `search` - Search by order number or supplier name
- `supplier_id` - Filter by specific supplier (UUID)
- `status` - Filter by status (draft, pending_approval, approved, rejected, cancelled)
- `payment_status` - Filter by payment status (unpaid, partially_paid, paid)
- `order_date_from` - Filter by order date from (YYYY-MM-DD)
- `order_date_to` - Filter by order date to (YYYY-MM-DD)

### Example: Find all approved unpaid POs from a supplier in December 2024
```
/inventory/purchase-orders?supplier_id=550e8400-e29b-41d4-a716-446655440000&status=approved&payment_status=unpaid&order_date_from=2024-12-01&order_date_to=2024-12-31
```

---

## 🎯 Comparison of Methods

| Method | Best For | Pros | Cons |
|--------|----------|------|------|
| **Supplier Details Page** | Single supplier deep dive | Complete financial view, A/P balance, transaction history | Only one supplier at a time |
| **Filter on PO Page** | Multi-criteria filtering | Combine multiple filters, compare across suppliers | Requires manual filter selection |
| **Direct URL** | Bookmarking, sharing | Shareable links, persistent filters | Need to know supplier ID |

---

## 💡 Pro Tips

### 1. Quick Access from PO List to Supplier Details
On the Purchase Orders page (`/inventory/purchase-orders`), each row shows the supplier name. You can:
- Click on the supplier name to navigate to supplier details
- Or click "Chi tiết" to view the specific PO

### 2. Persistent Filters
Filters are stored in the URL query parameters, so:
- **Bookmarking** the filtered URL saves your filter settings
- **Refreshing** the page preserves your filters
- **Sharing** the URL shares your filter settings

### 3. Combining Filters for Power Queries
Example combinations:
- **All draft POs from Supplier X** → supplier_id + status=draft
- **Unpaid approved POs this month** → payment_status=unpaid + status=approved + date range
- **Pending approvals from top 3 suppliers** → status=pending_approval + filter by each supplier

### 4. Clearing Individual Filters
Instead of clearing all filters, you can:
- Click the **X** on specific filter badges
- Keep other filters active
- Refine your search incrementally

---

## 🔧 Technical Details

### Backend API Endpoint:
```
GET /purchase-orders?supplier_id={uuid}
```

### Frontend Implementation:
- **File**: `frontend/src/pages/inventory/PurchaseOrdersPage.tsx`
- **API Client**: `frontend/src/lib/api/purchase-orders.ts`
- **Filter State**: Managed via URL search params using `useSearchParams`
- **Data Fetching**: TanStack Query with automatic refetching

### Filter Query Key:
```typescript
queryKey: ['purchaseOrders', {
  search,
  supplier_id,
  status,
  payment_status,
  order_date_from,
  order_date_to,
}]
```

---

## 📊 Example Workflows

### Workflow 1: Check Outstanding POs for a Supplier Before Payment
1. Navigate to `/suppliers/:id`
2. Go to "Đơn hàng chưa thanh toán" tab
3. Review unpaid/partially paid POs
4. Note the balance due amounts
5. Click "Ghi nhận thanh toán" to record payment
6. Select POs to allocate payment (manual mode)

### Workflow 2: Monthly Reconciliation for Multiple Suppliers
1. Navigate to `/inventory/purchase-orders`
2. Click "Lọc"
3. Set date range (e.g., 2024-12-01 to 2024-12-31)
4. Set status = "approved"
5. Set payment_status = "unpaid"
6. Apply filter
7. Review all unpaid approved POs for the month
8. For each supplier, navigate to supplier details to process payment

### Workflow 3: Approve Pending POs from Specific Supplier
1. Navigate to `/inventory/purchase-orders`
2. Click "Lọc"
3. Select supplier from dropdown
4. Set status = "pending_approval"
5. Apply filter
6. Review each PO
7. Click "Chi tiết" → "Duyệt đơn" to approve

---

## ✅ Feature Complete

The supplier filter has been added to the Purchase Orders page with:
- ✅ Supplier dropdown in filter sheet
- ✅ Active filter badge display
- ✅ URL query parameter support
- ✅ Badge removal functionality
- ✅ TypeScript type safety
- ✅ TanStack Query integration

All three methods are now fully functional!
