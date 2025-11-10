# Software Requirements Document (SRD)
## POS / Sales Order & Inventory Management System
### Saigon Classic Motorcycles Club (SCMC)

**Document Version:** 1.0  
**Date:** November 10, 2025  
**Prepared For:** SCMC Management Team  
**Focus Areas:** Parts & Denim Product Categories

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context](#2-business-context)
3. [System Objectives](#3-system-objectives)
4. [Stakeholders](#4-stakeholders)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [User Roles & Permissions](#7-user-roles--permissions)
8. [System Architecture & Integration](#8-system-architecture--integration)
9. [Data Requirements](#9-data-requirements)
10. [Technical Specifications](#10-technical-specifications)
11. [Implementation Phases](#11-implementation-phases)
12. [Success Metrics & KPIs](#12-success-metrics--kpis)
13. [Assumptions & Constraints](#13-assumptions--constraints)
14. [Appendices](#14-appendices)

---

## 1. Executive Summary

### 1.1 Purpose
This document outlines the requirements for developing an integrated POS (Point of Sale), Sales Order Management, and Inventory Management system for Saigon Classic Motorcycles Club (SCMC), specifically designed for their Parts & Denim product categories.

### 1.2 Scope
The system will:
- Manage in-store and online sales transactions across two locations (Ho Chi Minh City and Hanoi)
- Track inventory for motorcycle parts/accessories and premium denim/apparel
- Provide real-time inventory visibility across all channels
- Generate sales orders and manage order fulfillment
- Integrate with existing e-commerce platform
- Support premium brand management (e.g., Momotaro, Japanese selvedge denim brands)

### 1.3 Business Impact
The system will enable SCMC to:
- Reduce stock discrepancies and overselling
- Improve customer experience through accurate inventory visibility
- Streamline operations across dual locations
- Support business growth and premium brand positioning
- Enable data-driven decision making for purchasing and merchandising

---

## 2. Business Context

### 2.1 Company Overview
- **Business Name:** Saigon Classic Motorcycles Club (SCMC)
- **Established:** 2016
- **Business Model:** Dual-channel (Physical Workshop/Retail + E-commerce)
- **Locations:** Ho Chi Minh City, Hanoi
- **Brand Position:** Premium motorcycle lifestyle brand

### 2.2 Product Categories (In-Scope)

#### 2.2.1 Motorcycle Parts & Accessories
- Exhaust systems
- Suspension components
- Lighting systems
- Performance parts
- Bike accessories ("Đồ chơi xe")
- Custom workshop components

#### 2.2.2 Denim & Apparel
- Premium Japanese selvedge denim (e.g., Momotaro)
- Riding jackets
- Boots
- Lifestyle apparel
- Limited edition/specialty items

### 2.3 Current Challenges
- Manual inventory tracking leading to stock discrepancies
- Limited visibility of inventory across locations
- Difficulty managing premium/limited stock items
- No unified system for online and offline sales
- Complex pricing (discounts, promotions) hard to manage
- Lack of sales analytics and reporting

### 2.4 Target Users
- Store staff (sales associates)
- Store managers (HCMC and Hanoi)
- Workshop technicians
- Warehouse/inventory staff
- Finance/accounting team
- Management/owners

---

## 3. System Objectives

### 3.1 Primary Objectives
1. **Unified Inventory Management:** Single source of truth for all inventory across channels and locations
2. **Efficient POS Operations:** Fast, reliable checkout process for in-store customers
3. **Order Management:** Seamless processing of sales orders from all channels
4. **Real-time Synchronization:** Immediate inventory updates across all systems
5. **Business Intelligence:** Actionable insights from sales and inventory data

### 3.2 Secondary Objectives
1. Support for multi-location inventory transfers
2. Advanced reporting and analytics capabilities
3. Customer relationship management (CRM) integration readiness
4. Scalability for future business expansion
5. Mobile accessibility for inventory management

---

## 4. Stakeholders

| Stakeholder Group | Key Interests | System Interaction Level |
|-------------------|---------------|-------------------------|
| Store Managers | Operations efficiency, sales reporting | High - Daily use |
| Sales Staff | Fast checkout, inventory lookup | High - Continuous use |
| Warehouse Staff | Inventory receiving, stock counts | High - Daily use |
| Workshop Technicians | Parts availability, custom order tracking | Medium - As needed |
| Finance Team | Accurate sales data, revenue reporting | Medium - Regular reporting |
| Management/Owners | Business performance, strategic insights | Medium - Dashboard/reports |
| IT/Technical Team | System maintenance, integrations | High - System administration |
| Customers (Indirect) | Product availability, smooth checkout | Indirect - Via staff |

---

## 5. Functional Requirements

### 5.1 Point of Sale (POS) Module

#### 5.1.1 Core POS Functions
**REQ-POS-001:** The system shall support in-store sales transactions with the following capabilities:
- Product scanning via barcode/SKU search
- Manual product entry
- Quantity adjustment
- Price override (with authorization)
- Apply discounts (percentage or fixed amount)
- Multiple payment methods (cash, credit/debit card, bank transfer, e-wallet)
- Split payment support

**REQ-POS-002:** The system shall display real-time product information:
- Product name and description
- Current price
- Available inventory (current location)
- Available inventory (other locations)
- Product images
- Variant information (size, color, specifications)

**REQ-POS-003:** The system shall support customer information management:
- Search existing customers by phone/email
- Quick customer registration
- Customer purchase history view
- Loyalty points tracking (if applicable)

**REQ-POS-004:** The system shall generate and print receipts with:
- Store information (name, address, tax ID)
- Transaction details (items, prices, discounts)
- Payment information
- Return/exchange policy
- QR code for digital receipt
- Barcode for returns processing

#### 5.1.2 POS User Experience
**REQ-POS-005:** The POS interface shall:
- Load and respond within 2 seconds for standard transactions
- Support keyboard shortcuts for common actions
- Provide visual feedback for all actions
- Support both mouse and touch-screen interactions
- Display clear error messages with resolution steps

**REQ-POS-006:** The system shall support offline mode:
- Queue transactions when network is unavailable
- Automatically sync when connection restored
- Alert staff when operating in offline mode
- Maintain critical functions offline (sales, basic inventory lookup)

#### 5.1.3 POS Reporting
**REQ-POS-007:** The system shall provide shift/cashier management:
- Cash drawer open/close functionality
- Starting cash declaration
- Cash drop recording
- Shift close-out report with reconciliation
- Cashier performance tracking

### 5.2 Sales Order Management Module

#### 5.2.1 Order Creation & Processing
**REQ-OM-001:** The system shall support order creation from multiple channels:
- In-store orders (walk-in customers)
- Phone orders
- E-commerce platform orders (via integration)
- Custom workshop orders
- Pre-orders for limited stock items

**REQ-OM-002:** The system shall manage order lifecycle:
- Order creation/draft
- Order confirmation
- Payment processing/verification
- Fulfillment (pick, pack, ship)
- Delivery/pickup
- Order completion
- Returns/exchanges

**REQ-OM-003:** The system shall support order modifications:
- Add/remove items (before fulfillment)
- Change quantity
- Update customer information
- Change delivery address
- Split orders
- Merge orders
- Cancel orders (with authorization)

**REQ-OM-004:** The system shall handle partial fulfillment:
- Back-order management
- Partial shipment tracking
- Automatic customer notifications
- Separate invoicing for partial shipments

#### 5.2.2 Order Allocation & Fulfillment
**REQ-OM-005:** The system shall support intelligent inventory allocation:
- Automatic allocation based on stock availability
- Manual allocation override
- Cross-location fulfillment
- Reserved inventory for confirmed orders
- Priority allocation for premium customers/rush orders

**REQ-OM-006:** The system shall track fulfillment status:
- Pick list generation
- Packing slip creation
- Shipping label integration (for delivery orders)
- Pickup notification (for store pickup)
- Delivery status tracking
- Proof of delivery

#### 5.2.3 Order Communication
**REQ-OM-007:** The system shall support automated customer notifications:
- Order confirmation (email/SMS)
- Payment received confirmation
- Order ready for pickup notification
- Shipping notification with tracking
- Delivery confirmation
- Configurable notification templates

### 5.3 Inventory Management Module

#### 5.3.1 Product Information Management
**REQ-INV-001:** The system shall maintain comprehensive product data:
- Basic information (SKU, name, description, brand)
- Category hierarchy (Parts, Denim, sub-categories)
- Variants (size, color, specifications)
- Pricing information (cost, retail, sale price)
- Supplier information
- Product images (multiple)
- Weight and dimensions
- Product tags/attributes

**REQ-INV-002:** The system shall support product categorization specific to SCMC:
- **Parts Category:** Exhaust, Suspension, Lights, Performance, Accessories, Custom Components
- **Denim Category:** Brand, Style, Wash, Size, Fit, Origin (e.g., Japanese selvedge)
- Custom workshop project categorization
- Premium/specialty item flagging

**REQ-INV-003:** The system shall manage product variants:
- Size matrices (for apparel and some parts)
- Color variants
- Specification variants (for motorcycle parts)
- Individual SKU for each variant
- Variant-level inventory tracking

#### 5.3.2 Stock Management
**REQ-INV-004:** The system shall track inventory by location:
- Ho Chi Minh City store
- Hanoi store
- Workshop inventory
- Warehouse(s) if applicable
- In-transit inventory between locations

**REQ-INV-005:** The system shall support inventory transactions:
- Receiving (purchase orders)
- Sales (automatic deduction)
- Returns (customer returns, supplier returns)
- Transfers between locations
- Adjustments (damage, theft, corrections)
- Cycle counts and physical inventory
- Holds/reservations

**REQ-INV-006:** The system shall maintain inventory accuracy:
- Real-time inventory updates
- Transaction logging (audit trail)
- Negative inventory prevention
- Low stock alerts
- Over-stock alerts
- Expiry tracking (if applicable for gear with expiration dates)

**REQ-INV-007:** The system shall support inventory valuation:
- Multiple costing methods (FIFO, weighted average)
- Cost tracking per item
- Landed cost calculation (for imports)
- Margin analysis
- Inventory value reporting

#### 5.3.3 Stock Replenishment
**REQ-INV-008:** The system shall provide replenishment management:
- Reorder point alerts
- Reorder quantity suggestions
- Purchase order creation
- Supplier lead time tracking
- Seasonal demand forecasting
- Trend analysis for purchasing decisions

**REQ-INV-009:** The system shall support transfer orders:
- Inter-location transfer requests
- Transfer approval workflow
- Transfer shipment tracking
- Automatic inventory adjustment upon receipt
- Transfer cost tracking

#### 5.3.4 Premium & Specialty Item Management
**REQ-INV-010:** The system shall support premium product management:
- Limited edition item tracking
- Pre-order management
- Consignment inventory tracking
- High-value item security flags
- Premium brand specific attributes (e.g., Momotaro selvage ID, production run)
- Certificate/authentication tracking

#### 5.3.5 Inventory Counting & Auditing
**REQ-INV-011:** The system shall support physical inventory processes:
- Cycle count scheduling
- Count sheet generation
- Mobile counting interface (optional)
- Variance reporting
- Automatic adjustment posting
- Count history and audit trail

### 5.4 Reporting & Analytics Module

#### 5.4.1 Sales Reports
**REQ-REP-001:** The system shall generate sales reports:
- Daily/weekly/monthly sales summary
- Sales by category (Parts vs. Denim)
- Sales by location
- Sales by staff member
- Sales by payment method
- Top-selling products
- Sales trends and comparisons
- Discount analysis

#### 5.4.2 Inventory Reports
**REQ-REP-002:** The system shall generate inventory reports:
- Current inventory levels (by location, by category)
- Inventory valuation
- Stock movement report
- Slow-moving/dead stock report
- Inventory turnover analysis
- Stock-out history
- Reorder recommendations
- Inventory aging report

#### 5.4.3 Financial Reports
**REQ-REP-003:** The system shall generate financial reports:
- Revenue reports
- Cost of goods sold (COGS)
- Gross profit analysis
- Margin analysis by product/category
- Payment reconciliation report
- Tax reports (VAT for Vietnam)

#### 5.4.4 Operational Reports
**REQ-REP-004:** The system shall generate operational reports:
- Order fulfillment performance
- Return/exchange analysis
- Staff performance metrics
- Customer purchase patterns
- Peak hours/days analysis
- Cross-location activity report

#### 5.4.5 Custom Reporting
**REQ-REP-005:** The system shall support:
- Report scheduling and automated delivery
- Export to multiple formats (PDF, Excel, CSV)
- Custom date range selection
- Report filtering and drill-down
- Dashboard with key metrics
- Real-time vs. historical data views

### 5.5 Integration Requirements

#### 5.5.1 E-commerce Integration
**REQ-INT-001:** The system shall integrate with SCMC's e-commerce platform:
- Real-time inventory synchronization
- Automatic order import
- Order status updates
- Price synchronization
- Product information sync
- Two-way communication

**REQ-INT-002:** The system shall prevent overselling:
- Reserved inventory for online orders
- Real-time stock updates to website
- Safety stock settings per product
- Buffer inventory for popular items

#### 5.5.2 Payment Gateway Integration
**REQ-INT-003:** The system shall integrate with payment processors:
- Credit/debit card processing
- Vietnamese e-wallets (MoMo, ZaloPay, etc.)
- Bank transfer verification
- Payment confirmation and reconciliation
- Refund processing

#### 5.5.3 Accounting Integration
**REQ-INT-004:** The system shall support accounting system integration:
- Sales data export
- Inventory value updates
- COGS calculation
- Tax calculation and reporting
- Chart of accounts mapping
- Standard export formats (CSV, XML, API)

#### 5.5.4 Future Integration Readiness
**REQ-INT-005:** The system shall be designed for future integrations:
- CRM systems
- Marketing automation tools
- Loyalty programs
- Third-party logistics (for shipping)
- Supplier EDI (Electronic Data Interchange)
- Business intelligence tools

### 5.6 User Management & Security

#### 5.6.1 User Authentication
**REQ-SEC-001:** The system shall provide secure user access:
- Username and password authentication
- Password complexity requirements
- Password expiry and change policies
- Two-factor authentication (optional)
- Session timeout after inactivity
- Failed login attempt lockout

#### 5.6.2 Role-Based Access Control
**REQ-SEC-002:** The system shall implement role-based permissions:
- Predefined user roles (see Section 7)
- Custom role creation
- Granular permissions per module/function
- Permission inheritance
- Audit log of permission changes

#### 5.6.3 Data Security
**REQ-SEC-003:** The system shall protect sensitive data:
- Encrypted data transmission (SSL/TLS)
- Encrypted storage of sensitive information
- PCI DSS compliance for payment data
- Personal data protection (GDPR-ready)
- Regular security updates

#### 5.6.4 Audit Trail
**REQ-SEC-004:** The system shall maintain comprehensive audit logs:
- User actions (who, what, when)
- Data modifications
- Price changes
- Inventory adjustments
- Permission changes
- System access logs
- Log retention policy (minimum 2 years)

---

## 6. Non-Functional Requirements

### 6.1 Performance Requirements

**REQ-NFR-001: Response Time**
- POS transactions: Complete within 2 seconds
- Inventory lookups: Results within 1 second
- Report generation: Simple reports within 5 seconds
- Dashboard load time: Within 3 seconds

**REQ-NFR-002: Throughput**
- Support minimum 50 concurrent users
- Handle 100+ transactions per hour during peak times
- Process 1000+ daily orders across all channels

**REQ-NFR-003: Data Volume**
- Support minimum 50,000 products (SKU variants)
- Store 5 years of transaction history
- Handle 500,000+ annual transactions

### 6.2 Reliability & Availability

**REQ-NFR-004: System Availability**
- 99.5% uptime during business hours (8 AM - 10 PM Vietnam time)
- Scheduled maintenance during off-peak hours
- Maximum planned downtime: 4 hours per month

**REQ-NFR-005: Data Backup**
- Automatic daily backups
- Real-time transaction replication
- Backup retention: 90 days
- Disaster recovery plan with 4-hour recovery time objective (RTO)

**REQ-NFR-006: Fault Tolerance**
- Offline mode for POS operations
- Automatic failover for critical services
- Graceful degradation when services unavailable

### 6.3 Usability Requirements

**REQ-NFR-007: User Interface**
- Intuitive interface requiring minimal training
- Consistent design across modules
- Support for Vietnamese and English languages
- Responsive design for various screen sizes
- Accessibility compliance (basic level)

**REQ-NFR-008: Learning Curve**
- Basic POS operations: trainable in 1 hour
- Full system proficiency: achievable in 1 week
- Comprehensive user documentation
- In-app help and tooltips

### 6.4 Scalability Requirements

**REQ-NFR-009: System Scalability**
- Support business growth to 5 locations
- Handle 3x current product catalog
- Scale to 200 concurrent users
- Cloud-based architecture for easy scaling

### 6.5 Compatibility Requirements

**REQ-NFR-010: Platform Compatibility**
- Web-based application (Chrome, Firefox, Safari, Edge)
- Windows 10+ for POS terminals
- iOS and Android for mobile inventory (optional)
- Support for barcode scanners, receipt printers, cash drawers

**REQ-NFR-011: Data Standards**
- Standard data formats (JSON, CSV, XML)
- API-first architecture (RESTful APIs)
- Integration-friendly design

### 6.6 Maintainability Requirements

**REQ-NFR-012: System Maintenance**
- Modular architecture for easy updates
- Comprehensive system logging
- Remote system monitoring capabilities
- Clear error messages and diagnostic tools
- Regular security patches and updates

### 6.7 Localization Requirements

**REQ-NFR-013: Vietnam-Specific Requirements**
- Vietnamese Dong (₫) currency support
- Vietnamese date/time formats
- Vietnamese tax regulations (VAT)
- Vietnamese address formats
- Vietnamese language support (primary)
- English language support (secondary)

---

## 7. User Roles & Permissions

### 7.1 Role Definitions

#### 7.1.1 Store Manager (Full Access)
**Permissions:**
- All POS operations
- All inventory management functions
- Sales order management (create, modify, cancel)
- Access to all reports
- User management (for their location)
- Price override and discount authorization
- Refund authorization
- Inventory adjustments
- Close-out and reconciliation

#### 7.1.2 Sales Associate
**Permissions:**
- POS transactions (standard sales)
- Customer lookup and basic customer management
- Product and inventory lookup
- Create sales orders
- Process returns/exchanges (within limits)
- Access to basic sales reports (their own)
- Limited price discounts (up to defined threshold)

#### 7.1.3 Warehouse/Inventory Staff
**Permissions:**
- Inventory receiving
- Inventory transfers (create and receive)
- Physical inventory counts
- Stock adjustments (with approval)
- Inventory reports
- Product information view
- Order fulfillment operations (pick and pack)

#### 7.1.4 Workshop Technician
**Permissions:**
- View parts inventory
- Create internal parts requisitions
- View custom order details
- Access workshop-specific inventory
- Limited POS access (parts sales only)

#### 7.1.5 Finance/Accounting
**Permissions:**
- Read-only access to sales transactions
- Access to all financial reports
- Payment reconciliation functions
- Revenue reports
- COGS and margin reports
- Tax reports
- No POS or inventory modification access

#### 7.1.6 System Administrator
**Permissions:**
- All system functions
- User management (all locations)
- System configuration
- Integration management
- Backup and restore
- Security settings
- Audit log access
- System health monitoring

#### 7.1.7 Owner/Management
**Permissions:**
- Read-only access to all modules
- Access to all reports and dashboards
- Business intelligence and analytics
- Strategic insights
- Override authorization (when needed)

### 7.2 Permission Matrix

| Function | Manager | Sales | Warehouse | Workshop | Finance | Admin | Owner |
|----------|---------|-------|-----------|----------|---------|-------|-------|
| POS Sales | ✓ | ✓ | - | Limited | - | ✓ | ✓ |
| Price Override | ✓ | Limited | - | - | - | ✓ | ✓ |
| Refunds | ✓ | Limited | - | - | - | ✓ | ✓ |
| Inventory View | ✓ | ✓ | ✓ | Limited | - | ✓ | ✓ |
| Inventory Adjust | ✓ | - | Approval Req | - | - | ✓ | ✓ |
| Stock Receiving | ✓ | - | ✓ | - | - | ✓ | - |
| Orders Create | ✓ | ✓ | - | Limited | - | ✓ | ✓ |
| Orders Modify | ✓ | Limited | - | - | - | ✓ | ✓ |
| Reports - Sales | ✓ | Limited | - | - | ✓ | ✓ | ✓ |
| Reports - Inventory | ✓ | - | ✓ | - | ✓ | ✓ | ✓ |
| Reports - Financial | ✓ | - | - | - | ✓ | ✓ | ✓ |
| User Management | Location | - | - | - | - | ✓ | - |
| System Config | - | - | - | - | - | ✓ | - |

**Legend:**
- ✓ = Full access
- Limited = Restricted/conditional access
- Approval Req = Can request, requires approval
- \- = No access

---

## 8. System Architecture & Integration

### 8.1 Recommended Architecture

#### 8.1.1 System Layers
```
┌─────────────────────────────────────────────────────┐
│         Presentation Layer                          │
│  (Web App, POS Interface, Mobile App)              │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│         Application Layer                           │
│  (Business Logic, APIs, Services)                  │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│         Data Layer                                  │
│  (Database, File Storage, Cache)                   │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│         Integration Layer                           │
│  (E-commerce, Payments, Accounting, APIs)          │
└─────────────────────────────────────────────────────┘
```

#### 8.1.2 Technology Stack Recommendations

**Frontend:**
- Modern web framework (React, Vue.js, or Angular)
- Responsive design (Bootstrap or Tailwind CSS)
- Progressive Web App (PWA) capabilities for offline support

**Backend:**
- RESTful API architecture
- Programming language: Node.js, Python (Django/Flask), or PHP (Laravel)
- Microservices or modular monolith approach

**Database:**
- Primary database: PostgreSQL or MySQL
- Caching layer: Redis
- Search engine: Elasticsearch (for product search)

**Infrastructure:**
- Cloud hosting (AWS, Google Cloud, or Azure)
- CDN for static assets
- Load balancer for high availability

**Integration:**
- API Gateway for external integrations
- Message queue (RabbitMQ or AWS SQS) for async processing
- Webhook support for real-time updates

### 8.2 System Integrations

#### 8.2.1 E-commerce Platform Integration
**Integration Type:** Bidirectional API
**Data Flow:**
- **To E-commerce:** Inventory levels, product information, pricing
- **From E-commerce:** Orders, customer information
**Frequency:** Real-time (webhook-based)
**Fallback:** Polling every 5 minutes

#### 8.2.2 Payment Gateway Integration
**Integration Type:** Unidirectional API (Receive payments)
**Supported Methods:**
- Credit/Debit cards (Visa, Mastercard)
- Vietnamese e-wallets (MoMo, ZaloPay, VNPay)
- Bank transfers
**Security:** PCI DSS compliant

#### 8.2.3 Accounting Software Integration
**Integration Type:** Data export or API (if available)
**Data Flow:** Sales data, inventory valuations, COGS
**Frequency:** Daily or on-demand
**Format:** CSV, Excel, or API

#### 8.2.4 Hardware Integration (POS)
**Peripherals:**
- Barcode scanners (USB or Bluetooth)
- Receipt printers (thermal, USB/network)
- Cash drawers (connected to printer)
- Card readers (USB or network)
**Compatibility:** Standard drivers (OPOS, JPOS, or native)

### 8.3 Data Synchronization

**REQ-SYNC-001:** The system shall synchronize data across locations:
- Inventory levels: Real-time
- Product information: Within 5 minutes
- Pricing updates: Within 5 minutes
- Sales transactions: Real-time
- Reports: Near real-time (within 15 minutes)

**REQ-SYNC-002:** The system shall handle synchronization conflicts:
- Last-write-wins for product information
- Transaction-level locking for inventory
- Conflict resolution logs
- Manual override capability

### 8.4 API Requirements

**REQ-API-001:** The system shall provide RESTful APIs for:
- Inventory management (CRUD operations)
- Order management (create, update, status)
- Product information (read operations)
- Sales data (read operations)
- Authentication and authorization

**REQ-API-002:** API specifications:
- JSON request/response format
- API versioning support
- Rate limiting (to prevent abuse)
- Comprehensive API documentation (Swagger/OpenAPI)
- Sandbox environment for testing

---

## 9. Data Requirements

### 9.1 Data Entities

#### 9.1.1 Product Master Data
```
Product
├── Product ID (SKU)
├── Product Name
├── Description (short & long)
├── Category (Parts/Denim hierarchy)
├── Brand
├── Supplier Information
├── Cost Price
├── Retail Price
├── Sale Price
├── Tax Category
├── Product Images (URLs)
├── Weight & Dimensions
├── Attributes (JSON)
│   ├── For Parts: Type, Fit, Brand, Model Compatibility
│   ├── For Denim: Brand, Style, Wash, Origin, Fit
├── Is Active
├── Is Featured
├── Created Date
├── Modified Date
└── Variants []
    ├── Variant ID
    ├── Variant Attributes (size, color, etc.)
    ├── Variant SKU
    └── Variant Images
```

#### 9.1.2 Inventory Data
```
Inventory
├── Product ID (FK to Product)
├── Variant ID (FK to Variant)
├── Location ID (FK to Location)
├── Quantity on Hand
├── Quantity Reserved
├── Quantity Available (calculated)
├── Reorder Point
├── Reorder Quantity
├── Last Stock Count Date
├── Last Movement Date
└── Bin Location (physical location in warehouse)
```

#### 9.1.3 Transaction Data
```
Sales Transaction
├── Transaction ID
├── Transaction Date
├── Transaction Type (Sale, Return, Exchange)
├── Location ID (FK)
├── Cashier ID (FK to User)
├── Customer ID (FK, optional)
├── Line Items []
│   ├── Product ID (FK)
│   ├── Variant ID (FK)
│   ├── Quantity
│   ├── Unit Price
│   ├── Discount
│   ├── Line Total
├── Subtotal
├── Discount Total
├── Tax Total
├── Grand Total
├── Payment Details []
│   ├── Payment Method
│   ├── Amount
│   ├── Reference Number
├── Status (Completed, Void, Refunded)
└── Notes
```

#### 9.1.4 Sales Order Data
```
Sales Order
├── Order ID
├── Order Number (user-facing)
├── Order Date
├── Order Channel (Store, Online, Phone, Custom)
├── Location ID (fulfillment location)
├── Customer Information
│   ├── Customer ID (FK, optional)
│   ├── Name
│   ├── Phone
│   ├── Email
│   ├── Delivery Address
├── Order Items []
│   ├── Product ID (FK)
│   ├── Variant ID (FK)
│   ├── Quantity
│   ├── Unit Price
│   ├── Status (Pending, Allocated, Picked, Packed, Shipped)
├── Order Totals (similar to Transaction)
├── Order Status (New, Confirmed, Processing, Shipped, Delivered, Cancelled)
├── Payment Status (Pending, Paid, Refunded)
├── Fulfillment Method (Delivery, Pickup)
├── Tracking Information
└── Notes/Special Instructions
```

#### 9.1.5 Customer Data
```
Customer
├── Customer ID
├── Customer Type (Retail, VIP, Wholesale)
├── Full Name
├── Phone Number (primary identifier)
├── Email
├── Date of Birth (optional)
├── Address Information
├── Purchase History (reference to transactions)
├── Total Lifetime Value
├── Loyalty Points (if applicable)
├── Notes
├── Created Date
└── Last Purchase Date
```

#### 9.1.6 User/Employee Data
```
User
├── User ID
├── Username
├── Password (hashed)
├── Full Name
├── Email
├── Phone
├── Role ID (FK to Role)
├── Location ID (FK, if applicable)
├── Is Active
├── Last Login Date
└── Created Date
```

### 9.2 Data Integrity Requirements

**REQ-DATA-001:** The system shall enforce data integrity:
- Foreign key constraints
- Unique constraints (SKUs, order numbers)
- Not-null constraints for critical fields
- Data type validation
- Range validation (e.g., prices > 0)

**REQ-DATA-002:** The system shall maintain referential integrity:
- Cascade updates for master data changes
- Prevent deletion of referenced records
- Soft deletes for historical data (set Is_Active = false)

### 9.3 Data Migration Requirements

**REQ-DATA-003:** The system shall support data migration from existing systems:
- Product master data import
- Historical inventory data
- Customer data (with consent)
- Historical transaction data (for reporting)
- Supplier information

**REQ-DATA-004:** Data migration process:
- Data mapping and transformation
- Data validation and cleansing
- Staged migration (test environment first)
- Rollback plan
- Data reconciliation post-migration

### 9.4 Data Retention & Archival

**REQ-DATA-005:** The system shall retain data according to policy:
- Active transactions: Indefinite
- Archived transactions: 7 years (for accounting/tax purposes)
- Customer data: Until customer requests deletion (GDPR-ready)
- Audit logs: 2 years minimum
- System logs: 90 days

**REQ-DATA-006:** The system shall support data archival:
- Automated archival of old transactions
- Archived data accessible for reporting
- Purge capability for expired data

---

## 10. Technical Specifications

### 10.1 Hardware Requirements

#### 10.1.1 POS Terminal (Per Location)
- **Computer:**
  - Processor: Intel i3 or equivalent (minimum)
  - RAM: 8 GB
  - Storage: 256 GB SSD
  - Operating System: Windows 10 Pro or higher
  - Network: Ethernet or WiFi (stable internet connection)

- **Peripherals:**
  - Barcode Scanner: 1D/2D capable, USB or Bluetooth
  - Receipt Printer: Thermal printer, 80mm, USB or Network
  - Cash Drawer: RJ11/RJ12 connection (via printer) or USB
  - Card Reader: USB or network-based, PCI-compliant
  - Monitor: Touchscreen optional (15-17 inch)
  - Backup UPS: To prevent data loss during power outages

#### 10.1.2 Server/Cloud Infrastructure
- **Hosting:** Cloud-based (AWS, Google Cloud, Azure, or local Vietnam provider)
- **Database Server:**
  - CPU: 4 cores minimum
  - RAM: 16 GB minimum
  - Storage: 500 GB SSD (scalable)
- **Application Server:**
  - CPU: 4 cores minimum
  - RAM: 8 GB minimum
  - Scalable based on load
- **Backup Storage:** Offsite backup storage (500 GB minimum)

#### 10.1.3 Network Requirements
- **Internet Connection:** Minimum 10 Mbps per location
- **Local Network:** Gigabit Ethernet for in-store devices
- **VPN:** Site-to-site VPN for secure inter-location communication (optional)

### 10.2 Software Requirements

#### 10.2.1 System Software
- **POS Terminals:** Windows 10 Pro (64-bit) or higher
- **Server OS:** Linux (Ubuntu 20.04+ or CentOS 8+) or Windows Server 2019+
- **Database:** PostgreSQL 13+ or MySQL 8+
- **Web Server:** Nginx or Apache
- **Application Framework:** As per development choice (Node.js, Python, PHP)

#### 10.2.2 Client Software
- **Web Browser:**
  - Google Chrome 90+
  - Mozilla Firefox 88+
  - Microsoft Edge 90+
  - Safari 14+ (for macOS/iOS)
- **Mobile App (if applicable):** iOS 13+ or Android 8+

#### 10.2.3 Third-Party Dependencies
- **Payment Gateway SDK:** As per chosen payment processor
- **Reporting Engine:** Crystal Reports, JasperReports, or custom
- **Barcode Generation:** Library for generating barcodes/QR codes
- **PDF Generation:** Library for generating invoices/reports
- **Email Service:** SMTP server or service (SendGrid, AWS SES)
- **SMS Gateway:** For customer notifications (Vietnamese provider)

### 10.3 Security Requirements

#### 10.3.1 Network Security
- **Firewall:** Application-level firewall
- **SSL/TLS:** Minimum TLS 1.2 for all connections
- **DDoS Protection:** Cloud-based DDoS mitigation
- **Intrusion Detection:** IDS/IPS system (optional)

#### 10.3.2 Application Security
- **Input Validation:** Server-side validation for all inputs
- **SQL Injection Prevention:** Parameterized queries
- **XSS Prevention:** Output encoding
- **CSRF Protection:** Anti-CSRF tokens
- **Rate Limiting:** API rate limiting to prevent abuse
- **Secure Session Management:** Session timeout, secure cookies

#### 10.3.3 Data Security
- **Encryption at Rest:** Database encryption for sensitive fields
- **Encryption in Transit:** TLS for all data transmission
- **Password Hashing:** bcrypt or Argon2 with salt
- **PCI DSS Compliance:** For payment card data
- **Personal Data Protection:** GDPR-ready (for potential international customers)

#### 10.3.4 Access Security
- **Authentication:** Username/password with optional 2FA
- **Authorization:** Role-based access control (RBAC)
- **Session Management:** Secure session handling, idle timeout (15 minutes)
- **Password Policy:**
  - Minimum 8 characters
  - Mix of uppercase, lowercase, numbers, special characters
  - Password expiry: 90 days
  - Password history: prevent reuse of last 5 passwords

### 10.4 Backup & Disaster Recovery

#### 10.4.1 Backup Strategy
- **Full Backup:** Weekly
- **Incremental Backup:** Daily
- **Transaction Log Backup:** Every 4 hours
- **Backup Storage:** Offsite/cloud storage
- **Backup Retention:** 90 days

#### 10.4.2 Disaster Recovery
- **Recovery Time Objective (RTO):** 4 hours
- **Recovery Point Objective (RPO):** 4 hours (maximum data loss)
- **Disaster Recovery Site:** Cloud-based failover
- **DR Testing:** Quarterly

### 10.5 Monitoring & Logging

#### 10.5.1 System Monitoring
- **Application Monitoring:** Uptime, response times, error rates
- **Infrastructure Monitoring:** CPU, memory, disk usage
- **Database Monitoring:** Query performance, connection pool
- **Alert Notifications:** Email/SMS for critical issues

#### 10.5.2 Logging
- **Application Logs:** Info, warning, error levels
- **Access Logs:** User logins, API calls
- **Audit Logs:** Data modifications, permission changes
- **Transaction Logs:** All sales and inventory transactions
- **Log Aggregation:** Centralized log management (ELK stack or similar)

---

## 11. Implementation Phases

### Phase 1: Foundation (Weeks 1-8)
**Objective:** Build core infrastructure and basic functionality

**Deliverables:**
- System architecture design and documentation
- Development environment setup
- Database design and setup
- User authentication and authorization module
- Basic product management (CRUD operations)
- Basic inventory management (stock levels, transactions)
- Simple POS interface (basic sales, no offline mode)

**Key Milestones:**
- Week 2: Architecture finalized
- Week 4: Database schema complete
- Week 6: User management functional
- Week 8: Basic product and inventory modules operational

**Testing:** Unit testing for all modules

---

### Phase 2: Core POS & Sales (Weeks 9-16)
**Objective:** Complete POS functionality and sales order management

**Deliverables:**
- Full POS interface with all payment methods
- Receipt printing functionality
- Customer management
- Basic sales order management
- Inventory synchronization (real-time)
- Cash drawer and shift management
- Basic reporting (daily sales, inventory levels)

**Key Milestones:**
- Week 10: POS interface complete
- Week 12: Payment integration complete
- Week 14: Sales order module complete
- Week 16: Basic reporting functional

**Testing:** Integration testing, POS hardware testing

---

### Phase 3: Advanced Inventory & Multi-Location (Weeks 17-24)
**Objective:** Advanced inventory features and multi-location support

**Deliverables:**
- Multi-location inventory management
- Inventory transfers between locations
- Stock receiving and purchase order tracking
- Reorder point alerts and replenishment
- Cycle counting and physical inventory
- Premium product management features
- Inventory reporting (turnover, aging, valuation)

**Key Milestones:**
- Week 18: Multi-location architecture complete
- Week 20: Transfer orders functional
- Week 22: Stock receiving and PO tracking complete
- Week 24: Advanced inventory features complete

**Testing:** Multi-location synchronization testing

---

### Phase 4: E-commerce Integration & Advanced Features (Weeks 25-32)
**Objective:** E-commerce integration and advanced system features

**Deliverables:**
- E-commerce platform integration (bidirectional)
- Online order processing
- Order fulfillment workflow
- Customer notifications (email/SMS)
- Advanced reporting and analytics
- Dashboard for management
- Offline POS mode
- Mobile inventory management (optional)

**Key Milestones:**
- Week 26: E-commerce API integration complete
- Week 28: Order fulfillment workflow complete
- Week 30: Advanced reporting complete
- Week 32: Offline mode and mobile features complete

**Testing:** Integration testing with e-commerce, end-to-end testing

---

### Phase 5: Accounting Integration & Optimization (Weeks 33-40)
**Objective:** Financial integrations and system optimization

**Deliverables:**
- Accounting software integration
- Financial reporting (COGS, margins, tax)
- Payment reconciliation
- System performance optimization
- Security hardening
- Comprehensive user documentation
- Training materials

**Key Milestones:**
- Week 34: Accounting integration complete
- Week 36: Financial reporting complete
- Week 38: Performance optimization complete
- Week 40: Documentation and training materials complete

**Testing:** Performance testing, security testing, user acceptance testing

---

### Phase 6: Deployment & Training (Weeks 41-44)
**Objective:** Production deployment and user training

**Activities:**
- Data migration from existing systems
- Production environment setup
- System deployment (staged rollout: one location first)
- Staff training (hands-on sessions)
- Go-live support (on-site support for first week)
- Post-deployment monitoring and issue resolution

**Key Milestones:**
- Week 41: Data migration complete
- Week 42: HCMC location go-live
- Week 43: Hanoi location go-live
- Week 44: System stabilization

**Success Criteria:**
- All users trained and comfortable with system
- No critical issues during first week
- Positive user feedback
- System performance meets requirements

---

### Phase 7: Post-Launch Support & Iteration (Weeks 45-52)
**Objective:** Stabilization and continuous improvement

**Activities:**
- Bug fixes and issue resolution
- Performance tuning based on actual usage
- User feedback collection and analysis
- Feature enhancements (based on priority)
- Documentation updates
- Ongoing training and support

**Success Criteria:**
- System stability (< 1 critical issue per week)
- User satisfaction (> 80% positive feedback)
- Performance metrics met
- All P1 issues resolved

---

## 12. Success Metrics & KPIs

### 12.1 System Performance Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| POS Transaction Time | < 2 seconds | Average time from scan to receipt |
| System Uptime | 99.5% | Monthly uptime monitoring |
| Inventory Sync Time | < 5 minutes | Time from transaction to web update |
| Report Generation | < 10 seconds | Average time for standard reports |
| Concurrent Users | 50+ | Load testing results |
| Page Load Time | < 3 seconds | Average page load across modules |

### 12.2 Business Process Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Inventory Accuracy | > 98% | Cycle count variance |
| Order Fulfillment Time | < 24 hours | Average time from order to ship |
| Stock-out Rate | < 2% | Percentage of out-of-stock SKUs |
| Return Processing Time | < 15 minutes | Average time to process return |
| Cash Reconciliation Time | < 30 minutes | Time to close out register |
| Order Accuracy | > 99% | Correct items shipped vs. total |

### 12.3 User Adoption Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| User Training Completion | 100% | Training attendance records |
| System Usage Rate | > 95% | Daily active users vs. total users |
| User Satisfaction Score | > 4/5 | Quarterly user surveys |
| Support Tickets (P1) | < 5/month | Ticket system tracking |
| Average Ticket Resolution | < 24 hours | Ticket system tracking |

### 12.4 Business Impact Metrics

| Metric | Target (Year 1) | Measurement Method |
|--------|----------------|-------------------|
| Inventory Turnover Improvement | +15% | Compare pre/post implementation |
| Transaction Processing Speed | +30% | Average transaction time reduction |
| Stock Discrepancy Reduction | -50% | Compare pre/post stock variances |
| Labor Cost Reduction (admin) | -20% | Time spent on manual processes |
| Customer Satisfaction | +10% | Customer feedback surveys |
| Sales Growth (enabled by system) | +20% | Year-over-year comparison |

### 12.5 Data Quality Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Product Data Completeness | > 95% | Percentage of products with all required fields |
| Duplicate Records | < 1% | Data quality audit |
| Data Entry Errors | < 2% | Validation error rate |
| Inventory Record Accuracy | > 98% | Physical count vs. system |

---

## 13. Assumptions & Constraints

### 13.1 Assumptions

1. **Technical Assumptions:**
   - Stable internet connectivity available at both locations (minimum 10 Mbps)
   - Existing e-commerce platform has API capabilities for integration
   - Standard POS hardware (barcode scanners, receipt printers) will be provided
   - Cloud hosting infrastructure is available and budget-approved
   - Staff have basic computer literacy

2. **Business Assumptions:**
   - Business processes will be standardized across both locations
   - Management commitment to user training and change management
   - Dedicated staff available for system testing and feedback
   - Budget allocated for ongoing system maintenance and support
   - Product catalog cleanup will be completed before data migration

3. **Data Assumptions:**
   - Existing product data is available in exportable format
   - Historical data quality is acceptable for migration
   - Customer consent obtained for data migration (if applicable)
   - Supplier information is available and current

4. **Regulatory Assumptions:**
   - Vietnamese tax regulations (VAT) will not change significantly during implementation
   - No significant changes to data protection laws during implementation
   - Payment processing regulations remain stable

### 13.2 Constraints

1. **Budget Constraints:**
   - Total project budget: [To be defined by client]
   - Hardware budget: [To be defined]
   - Ongoing maintenance budget: [To be defined]

2. **Timeline Constraints:**
   - Project must be completed within 12 months
   - Go-live must avoid peak sales seasons (Tet holiday, major promotional periods)
   - Training must be completed 2 weeks before go-live

3. **Resource Constraints:**
   - Limited IT staff at SCMC (may require external support)
   - Staff availability for training (must not disrupt business operations)
   - Development team availability and skillset

4. **Technical Constraints:**
   - Must integrate with existing e-commerce platform (limited API flexibility)
   - Hardware compatibility with existing infrastructure
   - Network bandwidth limitations
   - Vietnam-specific requirements (language, currency, regulations)

5. **Operational Constraints:**
   - System cutover must happen outside business hours
   - Cannot disrupt daily operations during implementation
   - Must maintain dual systems during transition period (if necessary)
   - Limited downtime tolerance (maximum 4 hours for planned maintenance)

6. **Regulatory Constraints:**
   - Must comply with Vietnamese tax laws (VAT reporting)
   - Must comply with data protection regulations
   - PCI DSS compliance for payment card processing
   - Must maintain financial records for 7 years (accounting law)

### 13.3 Risks & Mitigation Strategies

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|-------------------|
| E-commerce integration delays | High | Medium | Start integration work early; have fallback manual process |
| Data migration issues | High | Medium | Thorough data cleanup pre-migration; staged migration approach |
| User resistance to change | Medium | Medium | Comprehensive training; involve users early; gather feedback |
| Internet connectivity issues | High | Low | Offline POS mode; UPS backup; redundant connections |
| Budget overruns | High | Medium | Phased approach; MVP first; clear scope management |
| Vendor delays (hardware) | Medium | Low | Order hardware early; have backup suppliers |
| Scope creep | High | High | Strict change control process; prioritize features |
| Key staff turnover | Medium | Low | Documentation; knowledge transfer; cross-training |
| Security breach | High | Low | Follow security best practices; regular security audits |
| Performance issues at scale | Medium | Medium | Performance testing; scalable architecture; optimization |

---

## 14. Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| **SKU** | Stock Keeping Unit - Unique identifier for each product variant |
| **POS** | Point of Sale - System used for processing customer transactions |
| **COGS** | Cost of Goods Sold - Direct costs of producing goods sold |
| **FIFO** | First In, First Out - Inventory valuation method |
| **API** | Application Programming Interface - Software intermediary allowing applications to communicate |
| **VAT** | Value Added Tax - Consumption tax in Vietnam |
| **RTO** | Recovery Time Objective - Maximum acceptable downtime |
| **RPO** | Recovery Point Objective - Maximum acceptable data loss |
| **PCI DSS** | Payment Card Industry Data Security Standard - Security standard for card payments |
| **GDPR** | General Data Protection Regulation - EU data protection law (applicable for EU customers) |
| **EOD** | End of Day - Daily closing procedures |
| **ABC Analysis** | Inventory categorization method (A=high value, B=medium, C=low) |

### Appendix B: Vietnamese Market Specifics

**Currency:**
- Vietnamese Dong (₫, VND)
- Display format: 1.000.000₫ or 1,000,000 VND
- No decimal places (Dong does not have fractional units)

**Tax:**
- VAT (Value Added Tax): 10% standard rate (some items 5% or 0%)
- VAT display: Can be inclusive or exclusive (SCMC to decide)
- Tax invoice requirements: Red invoice for VAT-registered businesses

**Date/Time Format:**
- Date: DD/MM/YYYY (e.g., 10/11/2025)
- Time: 24-hour format (e.g., 14:30)
- Timezone: ICT (Indochina Time, UTC+7)

**Address Format:**
```
[Street Address]
[Ward], [District]
[City/Province]
[Postal Code] (optional, not commonly used)
Vietnam
```

**Phone Number Format:**
- Mobile: +84 9XX XXX XXX or 09XX XXX XXX
- Landline: +84 28 XXXX XXXX (HCMC) or +84 24 XXXX XXXX (Hanoi)

**Popular Payment Methods:**
- Cash (still dominant)
- Bank transfer
- Credit/Debit cards (Visa, Mastercard, domestic cards)
- E-wallets: MoMo, ZaloPay, VNPay, ShopeePay, Moca

**Business Hours:**
- Typical: 9:00 - 20:00 or 21:00 (later for retail)
- Closed: May have afternoon break (12:00-13:30) in some areas
- Holidays: Tet (Lunar New Year) - major holiday, 7-10 days closure

### Appendix C: Sample Workflows

#### Workflow 1: In-Store Sale (Walk-in Customer)
```
1. Customer brings items to counter
2. Sales associate scans/enters items into POS
3. System displays items, prices, calculates total
4. Sales associate applies discounts (if any)
5. Sales associate selects payment method
6. Customer provides payment
7. System processes payment
8. System automatically deducts inventory
9. System prints receipt
10. Sales associate hands receipt and items to customer
11. System syncs transaction data to central database
```

#### Workflow 2: Online Order Fulfillment
```
1. Customer places order on e-commerce site
2. Order automatically imported into system
3. System allocates inventory (reserves stock)
4. Warehouse staff receives pick list
5. Staff picks items from shelves
6. Staff verifies items against order
7. Staff packs items
8. System generates shipping label/delivery note
9. Order marked as "Shipped" or "Ready for Pickup"
10. Customer receives notification
11. Upon delivery/pickup: Order marked "Completed"
12. Payment reconciliation (if COD or paid online)
```

#### Workflow 3: Stock Receiving
```
1. Purchase order placed with supplier (outside system scope initially)
2. Supplier delivers goods to warehouse
3. Warehouse staff creates receiving document in system
4. Staff counts and verifies items against PO
5. Staff enters received quantities
6. System updates inventory levels
7. System flags discrepancies (if any)
8. Manager approves receiving
9. System posts inventory increase
10. Goods put away in bins/shelves
11. System records bin locations
```

#### Workflow 4: Inter-Location Transfer
```
1. Location A identifies need for product from Location B
2. Manager at Location A creates transfer request
3. Manager at Location B approves request
4. Location B staff picks items
5. System reserves inventory at Location B
6. Items shipped/transported to Location A
7. Location A receives items
8. Location A staff verifies and confirms receipt
9. System deducts from Location B, adds to Location A
10. Transfer marked as complete
```

### Appendix D: Sample Reports (Mockups)

**Report 1: Daily Sales Summary**
```
SAIGON CLASSIC MOTORCYCLES CLUB
Daily Sales Summary Report

Date: 10/11/2025
Location: Ho Chi Minh City

Total Sales:           25,000,000₫
Total Transactions:    42
Average Transaction:   595,238₫
Total Discounts:       1,500,000₫
Total Tax Collected:   2,272,727₫

Sales by Category:
  Parts & Accessories: 15,000,000₫ (60%)
  Denim & Apparel:     10,000,000₫ (40%)

Payment Methods:
  Cash:                12,000,000₫
  Credit Card:         8,000,000₫
  Bank Transfer:       3,000,000₫
  E-wallet:            2,000,000₫

Top Selling Products:
  1. Momotaro 0106SPZ (Qty: 3)
  2. LED Headlight Kit (Qty: 5)
  3. Riding Jacket XL (Qty: 2)
  ...
```

**Report 2: Inventory Valuation Summary**
```
SAIGON CLASSIC MOTORCYCLES CLUB
Inventory Valuation Report

As of: 10/11/2025

Location: All Locations

Category: Parts & Accessories
  Total Items:    1,250
  Total Value:    450,000,000₫
  Avg. Item Cost: 360,000₫

Category: Denim & Apparel
  Total Items:    850
  Total Value:    380,000,000₫
  Avg. Item Cost: 447,059₫

Grand Total Value: 830,000,000₫

Breakdown by Location:
  Ho Chi Minh City:  500,000,000₫ (60.2%)
  Hanoi:             330,000,000₫ (39.8%)

Low Stock Alert (< Reorder Point): 23 items
Over-Stock Alert (> 6 months supply): 15 items
```

**Report 3: Top Selling Products (Monthly)**
```
SAIGON CLASSIC MOTORCYCLES CLUB
Top Selling Products Report

Period: October 2025
Location: All Locations

Rank | Product Name          | Category | Qty Sold | Revenue
-----|----------------------|----------|----------|-------------
  1  | Momotaro 0106SPZ     | Denim    | 18       | 52,200,000₫
  2  | LED Headlight Kit    | Parts    | 45       | 36,000,000₫
  3  | Exhaust System - XYZ | Parts    | 12       | 30,000,000₫
  4  | Riding Jacket Black  | Apparel  | 22       | 28,600,000₫
  5  | Suspension Kit - ABC | Parts    | 8        | 24,000,000₫
  ...

Total Products Sold: 1,250
Total Revenue: 625,000,000₫
```

### Appendix E: Contact Information

**Project Stakeholders:**
- **SCMC Management:** [Contact details to be added]
- **Project Manager:** [To be assigned]
- **Technical Lead:** [To be assigned]
- **Business Analyst:** [To be assigned]

**Vendor/Support Contacts:**
- **E-commerce Platform:** [Vendor contact]
- **Payment Gateway:** [Vendor contact]
- **Hosting Provider:** [Vendor contact]
- **Hardware Supplier:** [Vendor contact]

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 10/11/2025 | [Author Name] | Initial draft |

---

## Document Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| SCMC Management |  |  |  |
| Project Sponsor |  |  |  |
| Technical Lead |  |  |  |
| Business Analyst |  |  |  |

---

**End of Document**

---

## Next Steps

1. **Review & Approval:**
   - Distribute this document to all stakeholders
   - Schedule review meeting
   - Gather feedback and comments
   - Finalize requirements

2. **Vendor Selection (if outsourcing):**
   - Create RFP (Request for Proposal) based on this SRD
   - Evaluate vendor proposals
   - Select development partner

3. **Project Planning:**
   - Create detailed project plan based on implementation phases
   - Assign resources
   - Set up project governance
   - Establish communication plan

4. **Detailed Design:**
   - UI/UX design mockups
   - Database design (detailed schema)
   - API specifications
   - Integration design documents

5. **Development Kick-off:**
   - Set up development environment
   - Begin Phase 1 (Foundation)

---

*This document serves as the foundation for SCMC's POS, Sales Order, and Inventory Management system development project. It should be treated as a living document and updated as requirements evolve during the project lifecycle.*