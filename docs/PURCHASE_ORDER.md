# Feature: Purchase Order Management

This feature allows users to create and manage purchase orders.  
When a purchase order is approved, product stock levels are increased automatically.

---

## Feature: Create Purchase Order

### Scenario: Create a new purchase order as draft
**Given** the user is authenticated as a purchasing staff  
**When** the user creates a new purchase order  
**Then** a purchase order is created with status `Draft`  
**And** the purchase order has a unique order number  

---

## Feature: Manage Products in Purchase Order

### Scenario: Add a product to a draft purchase order
**Given** a purchase order exists with status `Draft`  
**When** the user adds a product with quantity and unit price  
**Then** the product is added to the purchase order  
**And** the purchase order total is recalculated  

---

### Scenario: Update a product in a purchase order
**Given** a purchase order exists with status `Draft`  
**And** the purchase order contains a product  
**When** the user updates the product quantity or unit price  
**Then** the purchase order product is updated  
**And** the purchase order total is recalculated  

---

### Scenario: Remove a product from a purchase order
**Given** a purchase order exists with status `Draft`  
**And** the purchase order contains a product  
**When** the user removes the product from the purchase order  
**Then** the product is removed  
**And** the purchase order total is recalculated  

---

### Scenario: Prevent editing products in an approved purchase order
**Given** a purchase order exists with status `Approved`  
**When** the user attempts to modify products  
**Then** the system rejects the change  

---

## Feature: Submit Purchase Order for Approval

### Scenario: Submit purchase order with products
**Given** a purchase order exists with status `Draft`  
**And** the purchase order contains at least one product  
**When** the user submits the purchase order for approval  
**Then** the purchase order status changes to `Pending Approval`  
**And** the purchase order products become read-only  

---

### Scenario: Submit purchase order without products
**Given** a purchase order exists with status `Draft`  
**And** the purchase order has no products  
**When** the user submits the purchase order for approval  
**Then** the system rejects the submission  

---

## Feature: Approve Purchase Order

### Scenario: Approve a purchase order
**Given** a purchase order exists with status `Pending Approval`  
**And** the user is authorized to approve purchase orders  
**When** the user approves the purchase order  
**Then** the purchase order status changes to `Approved`  
**And** the approver and approval timestamp are recorded  

---

### Scenario: Unauthorized user attempts to approve a purchase order
**Given** a purchase order exists with status `Pending Approval`  
**And** the user is not authorized to approve purchase orders  
**When** the user attempts to approve the purchase order  
**Then** the system rejects the approval  

---

## Feature: Stock Update on Approval

### Scenario: Increase stock when purchase order is approved
**Given** a purchase order exists with status `Pending Approval`  
**And** the purchase order contains products with quantities  
**When** the purchase order is approved  
**Then** the stock level for each product increases by the ordered quantity  
**And** a stock transaction is recorded with the purchase order reference  

---

### Scenario: Prevent stock increase more than once
**Given** a purchase order exists with status `Approved`  
**And** stock has already been increased for this purchase order  
**When** the purchase order is re-approved or updated  
**Then** the stock level does not change  

---

## Feature: View Purchase Order

### Scenario: View purchase order details
**Given** a purchase order exists  
**When** the user views the purchase order  
**Then** the user can see supplier information  
**And** the list of products, quantities, and prices  
**And** the purchase order status  
**And** the stock impact if the purchase order is approved  

---

## Feature: Cancel or Reject Purchase Order

### Scenario: Reject a purchase order
**Given** a purchase order exists with status `Pending Approval`  
**When** the manager rejects the purchase order  
**Then** the purchase order status changes to `Rejected`  
**And** no stock levels are updated  

---

### Scenario: Cancel a draft purchase order
**Given** a purchase order exists with status `Draft`  
**When** the user cancels the purchase order  
**Then** the purchase order status changes to `Cancelled`  
**And** no stock levels are updated  

---