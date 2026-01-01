# Epic: Customer Loyalty Program (Tier & Points)

## Epic Description
As a business, we want to reward customers with a simple and flexible loyalty program based on points and membership tiers, so that we can increase repeat purchases, customer retention, and lifetime value while retaining the ability to adjust rules in the future.

The loyalty program supports point earning, tier progression, and point redemption during purchase, with all rules configurable via admin settings.

---

## Loyalty Tiers (Initial Labels)
> Labels are configurable and can be changed later via admin settings.

- **Iron Rider**
- **Silver Rider**
- **Golden Legend**

---

## User Stories

### 1. View Loyalty Status
**As a** customer  
**I want** my loyalty tier and point balance to be tracked automatically  
**So that** I know my membership status and available rewards.

#### Acceptance Criteria
- Each customer has:
  - Current loyalty tier
  - Current point balance
- Loyalty tier is always derived from current rules
- Loyalty information is visible to employees during checkout
- Loyalty tier changes are logged for audit

---

### 2. View Loyalty Status on Customer Detail Page
**As an** employee (Sales, Manager)
**I want** to see a customer's loyalty status on their detail page
**So that** I can quickly understand their membership level and provide appropriate service.

#### Acceptance Criteria
- Customer detail page displays:
  - Current loyalty tier with badge/icon
  - Current point balance
  - Points earned this month/year (optional)
  - Tier progress indicator (points needed for next tier)
- Loyalty section is prominently visible on customer detail page
- Employee can see point transaction history for the customer
- Link to detailed loyalty history is available
- Information refreshes when customer data is loaded

---

### 3. Earn Points from Purchase
**As a** customer  
**I want** to earn loyalty points when I make a purchase  
**So that** I am rewarded for spending with the business.

#### Acceptance Criteria
- Points are earned when an order reaches **Paid** or **Completed** status
- Points are calculated based on configurable rules (e.g. spend amount, product type)
- System shows earned points per order
- Points are added to customer balance automatically
- Cancelled or refunded orders do not earn points
- Partial refunds reduce earned points accordingly

---

### 4. Loyalty Tier Progression
**As a** customer  
**I want** my loyalty tier to update automatically when I meet the criteria  
**So that** my membership reflects my loyalty level.

#### Acceptance Criteria
- Tier progression is based on configurable criteria (e.g. total points, total spend)
- Tier evaluation occurs after:
  - Points are earned
  - Points are adjusted (refunds, reversals)
- Customer is always assigned exactly one tier
- Tier downgrade behavior is configurable (allowed or not)
- Tier change history is recorded

---

### 5. Redeem Points as Discount
**As a** customer  
**I want** to redeem my loyalty points as a discount during purchase  
**So that** I can reduce the amount I need to pay.

#### Acceptance Criteria
- Employee can apply point redemption during order creation or checkout
- Redemption rules are configurable:
  - Point-to-currency conversion rate
  - Maximum redeemable percentage or amount per order
- Redeemed points reduce:
  - Order total
  - Customer receivable
- System validates sufficient point balance before redemption
- Redeemed points are deducted immediately after order confirmation
- Redeemed points are visible in order summary and receipt

---

### 6. Prevent Invalid Point Usage
**As a** business  
**I want** to prevent misuse of loyalty points  
**So that** point balances remain accurate and fair.

#### Acceptance Criteria
- Points cannot be redeemed on Draft orders
- Points cannot reduce order total below zero
- Points cannot be redeemed on cancelled orders
- Redeemed points are returned if the order is cancelled before payment
- Redeemed points are adjusted proportionally for partial refunds

---

### 7. Admin Configure Loyalty Rules
**As an** admin  
**I want** to configure loyalty point and tier rules  
**So that** the program can evolve without system changes.

#### Acceptance Criteria
- Admin can configure:
  - Tier labels
  - Tier qualification rules
  - Point earning rules
  - Point redemption rules
- Rule changes do not affect historical transactions
- Rule version is stored with each transaction

---

## Loyalty Lifecycle Flow
Customer Purchase
↓
Order Paid / Completed
↓
Points Earned
↓
Tier Evaluated
↓
Tier Updated (if eligible)

---

## Point Redemption Flow

Order Created
↓
Apply Point Redemption
↓
Order Total Reduced
↓
Points Reserved
↓
Order Confirmed / Paid
↓
Points Deducted

---

## Key Business Rules

- Loyalty points are non-cash and non-transferable
- Points are customer-specific and cannot be shared
- Points have no monetary value outside redemption
- Point balance must never go negative
- Tier labels and rules are configurable

---

## Important Edge Cases

- Customer redeems points and order is cancelled before payment
- Customer earns points and immediately upgrades tier
- Tier downgrade when refunds reduce total spend
- Rule changes mid-day while transactions are ongoing
- Multiple orders processed concurrently for the same customer

---

## Suggested Data Concepts (Non-Technical)
- Customer
- Loyalty Tier
- Point Balance
- Point Transaction (earn, redeem, reverse)
- Loyalty Rule Version
