# Supplier Navigation Guide - How to Access Supplier Details

## ✅ Problem Solved!

You can now easily navigate from the Suppliers list page to individual Supplier Details pages.

---

## 🎯 Two Ways to Access Supplier Details

### Method 1: Click on Supplier Name ⭐
**Fastest way!**

1. Go to `/suppliers` (Suppliers page)
2. **Click on any supplier name** (blue, underlined text)
3. Automatically navigates to `/suppliers/:id`

**Visual**:
```
Suppliers Table
┌────────────────────────────────────────────────────┐
│ Name (clickable)  │ Contact  │ Phone  │ Email      │
├────────────────────────────────────────────────────┤
│ ABC Supplies ←───  │ John     │ 123... │ abc@...    │
│ (click here!)      │          │        │            │
└────────────────────────────────────────────────────┘
```

### Method 2: Click "View Details" Button
**More explicit**

1. Go to `/suppliers` (Suppliers page)
2. Find the supplier in the table
3. Click **"View Details"** button in the Actions column
4. Navigates to `/suppliers/:id`

**Visual**:
```
Suppliers Table
┌─────────────────────────────────────────────────────────────────┐
│ Name          │ Contact │ Phone │ Email │ Actions               │
├─────────────────────────────────────────────────────────────────┤
│ ABC Supplies  │ John    │ 123.. │ abc@..│ [View Details] [Edit] │
│                                            ↑ Click this!         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete User Journey

### Journey 1: View Supplier's Purchase Orders
```
Start: /suppliers
  ↓
Click supplier name OR "View Details" button
  ↓
Supplier Details Page: /suppliers/:id
  ↓
View Tabs:
  - Outstanding Purchase Orders (unpaid POs)
  - Transaction History (all transactions)
  - Purchase History (all approved POs)
  ↓
Click "Chi tiết" on any PO
  ↓
Purchase Order Details: /inventory/purchase-orders/:id
```

### Journey 2: Record Payment to Supplier
```
Start: /suppliers
  ↓
Click supplier name
  ↓
Supplier Details Page: /suppliers/:id
  ↓
See Accounts Payable cards (balance due in red)
  ↓
Click "Ghi nhận thanh toán" button
  ↓
Payment Dialog opens
  ↓
Enter amount, select payment method
  ↓
Choose Auto or Manual allocation
  ↓
Submit → Payment recorded!
```

### Journey 3: Create Return to Supplier
```
Start: /suppliers
  ↓
Click supplier name
  ↓
Supplier Details Page: /suppliers/:id
  ↓
Click "Trả hàng" button
  ↓
Return Dialog opens
  ↓
Select approved purchase order
  ↓
Select items and quantities to return
  ↓
Submit → Return created!
```

---

## 🎨 UI Changes Made

### Before (Old SuppliersPage):
```
Actions Column:
[Edit] [Delete]
```

### After (Updated SuppliersPage):
```
Name Column:
ABC Supplies ← Clickable, blue, underlined

Actions Column:
[View Details] [Edit] [Delete]
```

---

## 📝 Technical Details

### Files Modified:
**File**: `frontend/src/pages/SuppliersPage.tsx`

### Changes:
1. **Added import**:
   ```typescript
   import { useNavigate } from 'react-router-dom';
   ```

2. **Added useNavigate hook**:
   ```typescript
   const navigate = useNavigate();
   ```

3. **Updated Name column cell**:
   ```typescript
   cell: ({ row }) => {
     const supplier = row.original;
     return (
       <div
         className="font-medium text-blue-600 hover:underline cursor-pointer"
         onClick={() => navigate(`/suppliers/${supplier.id}`)}
       >
         {row.getValue('name')}
       </div>
     );
   },
   ```

4. **Added "View Details" button** in Actions column:
   ```typescript
   <Button
     variant="outline"
     size="sm"
     onClick={() => navigate(`/suppliers/${supplier.id}`)}
   >
     View Details
   </Button>
   ```

### Route Already Configured:
✅ Route `/suppliers/:id` → SupplierDetailsPage (already in App.tsx)

---

## 🎯 What You Can Do Now

### From Suppliers Page (`/suppliers`):

1. **Click supplier name** → Go to supplier details
2. **Click "View Details"** → Go to supplier details
3. **Click "Edit"** → Edit supplier info (sheet opens)
4. **Click "Delete"** → Delete supplier (with confirmation)

### From Supplier Details Page (`/suppliers/:id`):

1. **View Accounts Payable Summary**:
   - Total purchases
   - Total returns
   - Total payments
   - **Balance due** (prominent, red)

2. **View Outstanding POs Tab**:
   - All unpaid/partially paid purchase orders
   - Click "Chi tiết" → Go to PO details

3. **View Transaction History Tab**:
   - All purchases, returns, payments
   - With amounts and dates

4. **View Purchase History Tab**:
   - All approved purchase orders
   - Payment status for each

5. **Quick Actions**:
   - Click "Ghi nhận thanh toán" → Record payment
   - Click "Trả hàng" → Create return

---

## ✅ Verification Checklist

Test these flows:

- [ ] Click supplier name → Navigates to `/suppliers/:id`
- [ ] Click "View Details" → Navigates to `/suppliers/:id`
- [ ] Supplier details page loads correctly
- [ ] All three tabs display data
- [ ] Accounts payable cards show correct values
- [ ] Click "Chi tiết" on a PO → Navigates to PO details
- [ ] Click "Ghi nhận thanh toán" → Opens payment dialog
- [ ] Click "Trả hàng" → Opens return dialog
- [ ] Browser back button works (from details back to list)

---

## 🎉 Summary

**Problem**: Could not navigate from suppliers list to supplier details page.

**Solution**: Added two navigation methods:
1. ✅ Clickable supplier name (blue, underlined)
2. ✅ "View Details" button in actions column

**Result**: Easy access to complete supplier financial information and purchase order history!

---

## 💡 Pro Tip

**Keyboard Navigation**:
- Use `Ctrl+Click` (Windows) or `Cmd+Click` (Mac) on supplier name to open in new tab
- This lets you compare multiple suppliers side-by-side!

**Bookmarking**:
- Bookmark frequently used supplier details pages
- URL format: `/suppliers/{uuid}`
- Example: `/suppliers/550e8400-e29b-41d4-a716-446655440000`
