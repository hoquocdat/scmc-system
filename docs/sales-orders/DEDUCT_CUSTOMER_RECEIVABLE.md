## User Story: Customer Receivable Payment (Customer Point of View)

### Story
**As a** customer  
**I want** an employee to be able to record payments on my behalf  
**So that** my outstanding receivable balance is reduced accurately and reflects what I have paid.

---

### Acceptance Criteria

#### Payment Recording
- Employee can record a payment against a specific customer account
- Payment can be linked to:
  - A specific sales order, or
  - The customer’s open receivable balance (on-account payment)
- Payment record includes:
  - Payment amount
  - Payment method
  - Payment date
  - Optional reference or note
- System validates that payment amount is greater than zero

#### Receivable Deduction
- When payment is recorded, system immediately reduces the customer’s receivable balance
- Payment is applied in the following priority:
  1. Specific order (if selected)
  2. Oldest unpaid or partially paid orders (FIFO), if recorded as on-account payment
- System recalculates remaining balance per order and per customer

#### Order & Status Update
- If payment fully covers an order:
  - Order status updates to **Paid**
- If payment partially covers an order:
  - Order status updates to **Partially Paid**
- If payment exceeds a single order amount:
  - Excess amount is applied to other outstanding orders or kept as customer credit

#### Visibility & Transparency
- Customer receivable summary shows:
  - Previous balance
  - Payment amount
  - Updated balance
- Payment appears in customer statement and order history
- Employee identity who recorded the payment is stored for audit

#### Error Handling
- System prevents applying payment to cancelled orders
- System prevents applying payment beyond total outstanding receivable unless credit is allowed
- Validation errors clearly explain why payment cannot be recorded

---

## Business Rules

- Payments reduce receivable at customer level and order level
- A single payment may cover multiple orders
- Customer credit balance is allowed only if enabled by business policy
- Refunds or reversals increase receivable accordingly
- All receivable changes must be auditable

---

## Suggested Customer Receivable Flow
Outstanding Receivable
↓
Employee Records Payment
↓
Receivable Reduced
↓
Order Status Updated (Partial / Paid)
↓
Customer Balance Updated

---

## Edge Cases

- Customer pays without specifying an order (on-account payment)
- Customer overpays, resulting in credit balance
- Payment recorded before order confirmation (blocked or flagged)
- Multiple employees record payments concurrently for the same customer
- Payment reversal due to failed bank transfer