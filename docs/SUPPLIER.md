# Feature: Supplier & Accounts Payable Management

This feature allows users to manage suppliers, track accounts payable, view transaction history,
handle product returns, and make payments to suppliers.

---

## Feature: View Supplier Accounts Payable

### Scenario: View outstanding accounts payable for a supplier
**Given** a supplier exists  
**And** the supplier has approved purchase orders with unpaid balances  
**When** the user views the supplier details  
**Then** the system displays the total accounts payable amount  
**And** the outstanding balance per purchase order  

---

### Scenario: View fully paid supplier with zero balance
**Given** a supplier exists  
**And** all purchase orders for the supplier are fully paid  
**When** the user views the supplier details  
**Then** the accounts payable balance is `0`  

---

## Feature: Supplier Transaction History

### Scenario: View supplier transaction history
**Given** a supplier exists  
**And** the supplier has purchase orders, returns, or payments  
**When** the user views the supplier transaction history  
**Then** the system displays a chronological list of transactions  
**And** each transaction shows:
- transaction type (Purchase, Return, Payment)
- reference number
- amount
- date

---

## Feature: Import (Purchase) History

### Scenario: View supplier purchase history
**Given** a supplier exists  
**And** the supplier has approved purchase orders  
**When** the user views the supplier purchase history  
**Then** the system displays all related purchase orders  
**And** each purchase order shows total amount and payment status  

---

## Feature: Supplier Product Returns

### Scenario: Return products to supplier
**Given** a supplier exists  
**And** an approved purchase order exists  
**And** the purchase order products have been received into stock  
**When** the user creates a supplier return with product quantities  
**Then** the returned quantity is recorded  
**And** the stock level decreases accordingly  
**And** the supplier payable balance is reduced  

---

### Scenario: Prevent returning more products than received
**Given** a supplier return is being created  
**When** the return quantity exceeds received quantity  
**Then** the system rejects the return  

---

## Feature: Make Payment to Supplier

### Scenario: Record a payment to a supplier
**Given** a supplier exists  
**And** the supplier has an outstanding payable balance  
**When** the user records a payment with amount and payment method  
**Then** the payment is saved  
**And** the supplier accounts payable balance is reduced  
**And** the payment appears in supplier transaction history  

---

### Scenario: Prevent overpayment to supplier
**Given** a supplier exists  
**And** the supplier has an outstanding payable balance  
**When** the user records a payment greater than the payable amount  
**Then** the system rejects the payment  

---

## Feature: Payment Allocation

### Scenario: Automatically allocate payment to oldest unpaid purchase orders
**Given** a supplier exists  
**And** the supplier has multiple unpaid purchase orders  
**When** a payment is recorded without manual allocation  
**Then** the payment is applied to the oldest unpaid purchase orders first  
**And** each affected purchase order balance is updated  

---

### Scenario: Manually allocate payment to specific purchase orders
**Given** a supplier exists  
**And** the supplier has unpaid purchase orders  
**When** the user allocates a payment to selected purchase orders  
**Then** only the selected purchase orders are updated  
**And** their balances are reduced accordingly  

---

## Feature: Accounts Payable Status

### Scenario: Purchase order payment status is updated after payment
**Given** a purchase order exists with a remaining balance  
**When** a payment is applied to the purchase order  
**Then** the purchase order payment status is updated to:
- `Unpaid`
- `Partially Paid`
- `Paid`  

---

## Feature: Audit & Integrity

### Scenario: Maintain audit trail for supplier financial actions
**Given** a supplier financial action occurs  
**When** a purchase, return, or payment is recorded  
**Then** the system stores an immutable audit record with:
- action type
- reference ID
- amount
- user
- timestamp  

---