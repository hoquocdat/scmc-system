# Epic: Employee Sales Order Management

## Epic Description
As a business, we want employees to efficiently create, manage, and process sales orders across multiple sales channels, apply discounts, record payments, and track customer accounts receivable, so that sales operations are accurate, auditable, and fully reflected in financial and performance reports.

This feature enables end-to-end sales order lifecycle management within a POS/ERP system, ensuring transparency in employee performance, payment collection, and customer balances.

---

## User Stories

### 1. Create Sales Order
**As an** employee  
**I want** to create a sales order for a customer  
**So that** I can record and manage customer purchases accurately.

**Acceptance Criteria**
- Employee can select or create a customer when creating an order
- Employee can add one or more products/services with quantity and price
- System automatically calculates subtotal and order total
- Order is created with status **Draft** by default
- Order is associated with the logged-in employee
- Order is assigned a sales channel
- Order cannot be paid or completed while in Draft

---

### 2. Manage Sales Order Status
**As an** employee  
**I want** to update the sales order status following a defined lifecycle  
**So that** the order accurately reflects its current state.

**Acceptance Criteria**
- System enforces valid status transitions only
- Employee can move an order from Draft to Confirmed
- Confirmed orders cannot be edited except for payments or discounts (if permitted)
- Cancelled orders are locked from further changes
- Completed status is only available when order is fully paid
- Status changes are logged for audit purposes

---

### 3. Apply Discount to Sales Order
**As an** employee  
**I want** to apply a discount to a sales order  
**So that** I can offer price adjustments to customers when allowed.

**Acceptance Criteria**
- Employee can apply either:
  - Percentage discount
  - Fixed amount discount
- Discount cannot exceed order subtotal
- System recalculates order total after discount
- Discount value is visible on the order summary
- Discount updates customer receivable balance
- Discount information is included in reporting

---

### 4. Record Payments for an Order
**As an** employee  
**I want** to record one or more payments for a sales order  
**So that** customer payments are accurately tracked.

**Acceptance Criteria**
- Employee can add one or multiple payment records per order
- Each payment includes:
  - Payment method
  - Amount
  - Payment date
  - Optional reference
- System supports mixed payment methods for a single order
- Payment total cannot exceed order total
- Order status updates automatically based on payment total:
  - Partially Paid
  - Paid
- Payment history is visible on the order

---

### 5. Track Customer Accounts Receivable
**As a** finance or operations user  
**I want** the system to automatically track customer receivable balances  
**So that** I can monitor outstanding payments accurately.

**Acceptance Criteria**
- System increases customer receivable when an order is confirmed
- System reduces receivable when payments are recorded
- System recalculates receivable when discounts are applied
- Fully paid orders result in zero receivable for that order
- Cancelled or refunded orders reverse receivable amounts
- Customer receivable balance is always up to date and viewable

---

### 6. Report Sales by Employee
**As a** manager  
**I want** to view sales performance by employee  
**So that** I can evaluate productivity and incentives.

**Acceptance Criteria**
- Report shows total sales amount per employee
- Report shows order count per employee
- Report includes total discount amount per employee
- Data can be filtered by date range and status
- Only completed or paid orders are included by default

---

### 7. Report Sales by Sales Channel
**As a** business owner  
**I want** to analyze sales by sales channel  
**So that** I can understand which channels perform best.

**Acceptance Criteria**
- Report groups sales by sales channel
- Report includes:
  - Total revenue
  - Order count
  - Total discounts
- Data supports filtering by employee and date range
- Cancelled orders are excluded from revenue calculations

---

## Suggested Order Status Flow