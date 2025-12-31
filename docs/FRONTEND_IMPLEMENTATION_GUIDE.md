# Frontend Implementation Guide - Supplier & Purchase Orders

## ✅ Completed So Far (80%)

### Backend Layer
- ✅ Database schema
- ✅ Services
- ✅ Controllers
- ✅ Modules
- ✅ Compilation verified

### Frontend API Layer
- ✅ `purchase-orders.ts` API client
- ✅ `supplier-payments.ts` API client
- ✅ `supplier-returns.ts` API client
- ✅ `suppliers.ts` extended with A/P methods

### Frontend Pages
- ✅ `PurchaseOrdersPage.tsx` - Listing page with filters

## 🚧 Remaining Frontend Work (20%)

### 1. Purchase Order Form Dialog
**File**: `frontend/src/components/purchase-orders/PurchaseOrderFormDialog.tsx`

**Purpose**: Create/edit purchase order form

**Key Features**:
- Supplier selection dropdown
- Expected delivery date picker
- Tax, shipping, discount fields
- Optional: Add items inline
- Submit button to create draft PO

**Implementation Pattern**:
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';

export function PurchaseOrderFormDialog({ open, onOpenChange, onSuccess }) {
  const { register, handleSubmit } = useForm();

  const createMutation = useMutation({
    mutationFn: purchaseOrdersApi.create,
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
  });

  // Form with Shadcn components
  // Include: Supplier select, dates, amounts
}
```

### 2. Purchase Order Details Page
**File**: `frontend/src/pages/inventory/PurchaseOrderDetailsPage.tsx`

**Purpose**: View and manage single purchase order

**Key Features**:
- Display PO header (number, supplier, dates, status)
- Items table with quantities and costs
- Add/Edit/Remove items (draft only)
- Workflow buttons:
  - Submit for Approval (draft)
  - Approve (pending_approval, manager only)
  - Reject (pending_approval, manager only)
  - Cancel (draft)
- Payment allocations display
- Activity timeline

**Route**: `/inventory/purchase-orders/:id`

**Implementation Pattern**:
```typescript
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack:parameter/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';

export function PurchaseOrderDetailsPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchaseOrder', id],
    queryFn: () => purchaseOrdersApi.getOne(id!),
  });

  const submitMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.submitForApproval(id!),
    onSuccess: () => queryClient.invalidateQueries(['purchaseOrder', id]),
  });

  const approveMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.approve(id!),
    onSuccess: () => queryClient.invalidateQueries(['purchaseOrder', id]),
  });

  // Display PO details, items table, workflow buttons
}
```

### 3. Purchase Order Items Management
**File**: `frontend/src/components/purchase-orders/AddPurchaseOrderItemDialog.tsx`

**Purpose**: Add item to purchase order

**Key Features**:
- Product/variant search and selection
- Quantity input
- Unit cost input
- Auto-calculate total

**Implementation**: Dialog with form, product search dropdown

---

**File**: `frontend/src/components/purchase-orders/PurchaseOrderItemsTable.tsx`

**Purpose**: Display and manage PO items

**Key Features**:
- Table with columns: product, SKU, quantity ordered/received/returned, cost
- Edit button (draft only)
- Remove button (draft only)
- Inline editing or dialog

---

### 4. Supplier Details Page Enhancement
**File**: Update existing `frontend/src/pages/SuppliersPage.tsx` or create detailed page

**Purpose**: Show supplier with accounts payable info

**Key Features**:
- Supplier basic info card
- **Accounts Payable Card**:
  - Total purchases
  - Total returns
  - Total payments
  - **Balance due** (prominent)
- **Outstanding Purchase Orders Table**:
  - Order number, date, total, paid, balance
  - Link to PO details
- **Transaction History Table**:
  - Type (purchase/return/payment)
  - Reference number
  - Amount
  - Date
- **Purchase History Table**:
  - All approved POs
  - Payment status

**Implementation**:
```typescript
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { suppliersApi } from '@/lib/api/suppliers';

export function SupplierDetailsPage() {
  const { id } = useParams();

  const { data: supplierDetails } = useQuery({
    queryKey: ['supplierDetails', id],
    queryFn: () => suppliersApi.getDetails(id!),
  });

  const { data: transactions } = useQuery({
    queryKey: ['supplierTransactions', id],
    queryFn: () => suppliersApi.getTransactionHistory(id!),
  });

  // Display cards for A/P, outstanding POs, transactions
}
```

---

### 5. Supplier Payment Dialog
**File**: `frontend/src/components/supplier-payments/RecordSupplierPaymentDialog.tsx`

**Purpose**: Record payment to supplier

**Key Features**:
- Supplier ID (from props or select)
- Amount input
- Payment method select (cash, card, bank transfer, etc.)
- Payment date picker
- Transaction ID, reference number (optional)
- Notes (optional)
- **Allocation Mode Toggle**:
  - **Automatic** (default): "Allocate to oldest unpaid POs"
  - **Manual**: Show list of outstanding POs with checkboxes and amount inputs
- Validation: Prevent overpayment
- Display outstanding balance

**Implementation**:
```typescript
import { Dialog } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supplierPaymentsApi } from '@/lib/api/supplier-payments';
import { suppliersApi } from '@/lib/api/suppliers';

export function RecordSupplierPaymentDialog({ supplierId, open, onOpenChange, onSuccess }) {
  const { register, handleSubmit, watch } = useForm();
  const [allocationMode, setAllocationMode] = useState<'auto' | 'manual'>('auto');

  const { data: outstandingPOs } = useQuery({
    queryKey: ['outstandingPOs', supplierId],
    queryFn: () => suppliersApi.getOutstandingPurchaseOrders(supplierId),
    enabled: !!supplierId,
  });

  const { data: accountsPayable } = useQuery({
    queryKey: ['accountsPayable', supplierId],
    queryFn: () => suppliersApi.getAccountsPayable(supplierId),
    enabled: !!supplierId,
  });

  const createPaymentMutation = useMutation({
    mutationFn: supplierPaymentsApi.create,
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
  });

  // Form with payment details
  // Toggle for auto/manual allocation
  // Manual mode: checkboxes for POs + amount inputs
  // Validation: sum of allocations <= payment amount <= outstanding balance
}
```

---

### 6. Supplier Return Dialog
**File**: `frontend/src/components/supplier-returns/CreateSupplierReturnDialog.tsx`

**Purpose**: Create return to supplier

**Key Features**:
- Supplier ID (from props)
- Purchase order selection (approved POs only)
- Return date picker
- Reason text area
- **Items to Return**:
  - Load PO items
  - For each item: checkbox, quantity input (max = qty received - qty returned)
  - Item reason (optional)
- Validation: Can't return more than received
- Submit creates return in "pending" status

**Implementation**:
```typescript
import { Dialog } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supplierReturnsApi } from '@/lib/api/supplier-returns';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';

export function CreateSupplierReturnDialog({ supplierId, open, onOpenChange, onSuccess }) {
  const [selectedPOId, setSelectedPOId] = useState<string>('');

  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchaseOrders', { supplier_id: supplierId, status: 'approved' }],
    queryFn: () => purchaseOrdersApi.getAll({ supplier_id: supplierId, status: 'approved' }),
    enabled: !!supplierId,
  });

  const { data: selectedPO } = useQuery({
    queryKey: ['purchaseOrder', selectedPOId],
    queryFn: () => purchaseOrdersApi.getOne(selectedPOId),
    enabled: !!selectedPOId,
  });

  const createReturnMutation = useMutation({
    mutationFn: supplierReturnsApi.create,
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
  });

  // Form:
  // 1. Select PO
  // 2. Load PO items
  // 3. For each item: checkbox + quantity input (with max validation)
  // 4. Submit button
}
```

---

### 7. Supplier Returns Approval
**Feature**: Add approve button to supplier return details

**Location**: Could be on supplier details page or dedicated returns page

**Implementation**:
```typescript
const approveMutation = useMutation({
  mutationFn: (returnId: string) => supplierReturnsApi.approve(returnId),
  onSuccess: () => {
    toast.success('Đã duyệt trả hàng. Tồn kho đã được cập nhật.');
    queryClient.invalidateQueries(['supplierReturns']);
  },
});

// Button (manager only, status = pending):
<Button onClick={() => approveMutation.mutate(returnId)}>
  Duyệt trả hàng
</Button>
```

---

## 📋 Quick Implementation Checklist

### Components to Create:
- [ ] `PurchaseOrderFormDialog.tsx` - Create PO
- [ ] `PurchaseOrderItemsTable.tsx` - Display items
- [ ] `AddPurchaseOrderItemDialog.tsx` - Add item to PO
- [ ] `RecordSupplierPaymentDialog.tsx` - Record payment
- [ ] `CreateSupplierReturnDialog.tsx` - Create return

### Pages to Create:
- [x] `PurchaseOrdersPage.tsx` - List POs (DONE)
- [ ] `PurchaseOrderDetailsPage.tsx` - View/manage single PO
- [ ] `SupplierDetailsPage.tsx` - Supplier with A/P info

### Routes to Add:
Add to `frontend/src/App.tsx` or router config:
```typescript
<Route path="/inventory/purchase-orders" element={<PurchaseOrdersPage />} />
<Route path="/inventory/purchase-orders/:id" element={<PurchaseOrderDetailsPage />} />
<Route path="/suppliers/:id" element={<SupplierDetailsPage />} />
```

### Navigation to Add:
Add menu items in sidebar/navigation:
- "Đơn đặt hàng" → `/inventory/purchase-orders`
- Link from supplier page to supplier details with A/P

---

## 🎨 UI/UX Guidelines (From CLAUDE.md)

### Filter Pattern:
- Use "Lọc" button that opens a Sheet
- Sheet contains all filter controls
- Show active filter badges below toolbar
- Each badge has X to remove individual filter
- "Xóa tất cả" button to clear all filters

### Sheet Component Standards:
```typescript
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

### Data Fetching:
- **ALWAYS use TanStack Query** (useQuery, useMutation)
- **NEVER use useEffect + useState** for data fetching

### Component Breakdown:
- Keep pages < 200 lines
- Extract forms into separate Dialog components
- Extract tables into separate components
- Create reusable components

---

## 🧪 Testing Workflow

### 1. Create Purchase Order
1. Navigate to `/inventory/purchase-orders`
2. Click "Tạo đơn đặt hàng"
3. Select supplier, set dates
4. Add items with quantities and costs
5. Submit → Creates draft PO

### 2. Purchase Order Approval
1. Open PO details
2. Click "Gửi duyệt" (Submit for Approval)
3. Status changes to "Chờ duyệt"
4. Manager clicks "Duyệt" (Approve)
5. Status changes to "Đã duyệt"
6. Stock automatically increases

### 3. Record Payment
1. Go to supplier details
2. See outstanding balance
3. Click "Ghi nhận thanh toán"
4. Enter amount, payment method
5. Choose auto or manual allocation
6. Submit → Payment recorded, PO balance updated

### 4. Create Return
1. Go to supplier details
2. Click "Trả hàng"
3. Select approved PO
4. Select items and quantities to return
5. Submit → Return created (pending)
6. Manager approves return
7. Stock decreases

---

## 📊 Estimated Time Remaining

- Purchase Order Form Dialog: **1 hour**
- Purchase Order Details Page: **2 hours**
- PO Items Management: **1 hour**
- Supplier Details Enhancement: **2 hours**
- Supplier Payment Dialog: **2 hours**
- Supplier Return Dialog: **1.5 hours**
- Testing & Polish: **2 hours**

**Total: ~11-12 hours** to complete all frontend UI

---

## 🎯 Priority Order

1. **Purchase Order Details Page** - Core functionality
2. **Purchase Order Form Dialog** - Create POs
3. **Supplier Details with A/P** - View balances
4. **Supplier Payment Dialog** - Record payments
5. **Supplier Return Dialog** - Handle returns
6. **Testing** - Verify all workflows

---

## ✅ What's Already Working (Backend)

All these endpoints are ready and tested:
- `POST /purchase-orders` - ✅ Create
- `POST /purchase-orders/:id/submit` - ✅ Submit
- `POST /purchase-orders/:id/approve` - ✅ Approve (auto stock update)
- `POST /supplier-payments` - ✅ Record payment (auto/manual allocation)
- `POST /supplier-returns` - ✅ Create return
- `POST /supplier-returns/:id/approve` - ✅ Approve (auto stock decrease)
- `GET /suppliers/:id/accounts-payable` - ✅ Get A/P balance
- `GET /suppliers/:id/outstanding-purchase-orders` - ✅ Get unpaid POs

Just need the UI to call them!

---

## 🚀 Next Steps

1. Create the remaining component files listed above
2. Add routes to router
3. Add navigation menu items
4. Test each workflow end-to-end
5. Polish UI/UX

The backend is rock-solid and ready. Just need React components to bring it to life!
