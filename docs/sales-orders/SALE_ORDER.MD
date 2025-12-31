You are a Senior Product Manager and Business Analyst.

Your task is to generate **complete user stories with acceptance criteria** for an **Employee Sales Order Management** feature in a business system (POS / ERP).

### Feature Overview
Employees can create and manage sales orders.  
The system must support order lifecycle management, discounts, reporting by employee and sales channel, payment methods, and customer accounts receivable.

---

### Requirements

#### 1. Sales Order Creation & Status
- Employees can create sales orders for customers
- Each order must have a clear lifecycle status, such as:
  - Draft
  - Confirmed
  - Paid
  - Partially Paid
  - Cancelled
  - Completed
- Order status transitions must be clearly defined and validated

---

#### 2. Discounts
- Employees can apply discounts to sales orders
- Support:
  - Order-level discount (percentage or fixed amount)
  - Validation rules (e.g. discount cannot exceed order total)
- Discount impact must be reflected in:
  - Order total
  - Customer receivable
  - Reports

---

#### 3. Reporting by Employee & Sales Channel
- Each order must be associated with:
  - Employee (creator / salesperson)
  - Sales channel (e.g. in-store, online, phone, marketplace)
- System must support reporting on:
  - Total sales by employee
  - Total sales by sales channel
  - Order count and revenue
  - Discount amounts by employee or channel

---

#### 4. Payment Methods
- System must support multiple payment methods, such as:
  - Cash
  - Bank transfer
  - Credit card
  - E-wallet
  - Mixed payment methods
- Employees can record one or multiple payments per order
- Payment records must include:
  - Payment method
  - Amount
  - Date
  - Reference (optional)

---

#### 5. Customer Accounts Receivable
- System must track customer receivable balances
- Support:
  - Unpaid orders
  - Partially paid orders
  - Fully paid orders
- Customer receivable balance must update automatically when:
  - An order is created
  - A discount is applied
  - A payment is recorded
  - An order is cancelled or refunded

---

### Output Instructions

Generate the following in **Markdown format**:

1. A high-level **Epic description**
2. A list of **User Stories**, each with:
   - As a / I want / So that
   - Clear acceptance criteria
3. Suggested **Order Status Flow**
4. Key **Business Rules & Validations**
5. (Optional) Important **Edge Cases**

Use clear, concise, and professional language.
Avoid implementation-specific details unless necessary.