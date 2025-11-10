SCMC Workshop Management System
Requirements Document & Project Plan

📋 1. BUSINESS REQUIREMENTS
1.1 Project Objective
Build a comprehensive workshop management system to digitize and streamline SCMC's motorcycle service operations.
1.2 Stakeholders

Primary Users: Technicians, Sales Staff, Managers, Finance Team
Secondary Users: Customers (future mobile app)
System Owner: SCMC Management

1.3 Success Criteria

Reduce service order processing time by 50%
Real-time visibility of all bikes in service
Eliminate paper-based tracking
Improve customer communication
Accurate financial tracking


👥 2. USER ROLES & RESPONSIBILITIES
2.1 Sales Staff

Register new customers and bike owners
Create service orders
Generate quotations
Schedule service appointments
Handle customer inquiries

2.2 Technician

View assigned work orders
Update service progress
Record parts used and work hours
Report issues or additional work needed
Mark tasks complete

2.3 Manager

Monitor all workshop operations
Assign technicians to jobs
Approve additional work/costs
View analytics and reports
Manage staff and resources

2.4 Finance

Process payments
Generate invoices
Track accounts receivable
Financial reporting
Cost analysis


📊 3. FUNCTIONAL REQUIREMENTS
3.1 User Management

FR-001: System must authenticate users via Supabase Auth
FR-002: System must support role-based access control (RBAC)
FR-003: Each user must have a profile with role, name, contact info
FR-004: System must track user activity for audit purposes

3.2 Customer & Owner Management

FR-005: System must distinguish between Bike Owner and Customer
FR-006: Bike Owner = registered legal owner of motorcycle
FR-007: Customer = person bringing bike for service (may or may not be owner)
FR-008: System must support individual and company owners
FR-009: System must track relationship between customer and owner
FR-010: System must handle authorization for non-owners to bring bikes

3.3 Motorcycle Management

FR-011: Each motorcycle must be linked to one bike owner
FR-012: System must store: brand, model, year, license plate, VIN, engine number
FR-013: System must track motorcycle service history
FR-014: System must store motorcycle photos
FR-015: System must track mileage for each service

3.4 Service Order Management

FR-016: System must track who owns bike and who brought it for service
FR-017: System must generate unique service order numbers (auto-increment)
FR-018: System must support multiple service statuses:

Pending, Confirmed, In Progress, Waiting Parts, Waiting Approval, Quality Check, Completed, Ready for Pickup, Delivered, Cancelled


FR-019: System must assign priority levels (Low, Normal, High, Urgent)
FR-020: System must allow technician assignment
FR-021: System must track estimated vs actual completion dates
FR-022: System must record drop-off and pickup information
FR-023: System must track who picked up the bike (ID verification)

3.5 Service Monitoring (KEY REQUIREMENT)

FR-024: Dashboard must show total bikes currently in service
FR-025: System must display bikes by status (in progress, waiting parts, etc.)
FR-026: System must provide real-time updates when status changes
FR-027: System must show detailed view of each bike in service including:

Customer and owner information
Current status and progress
Assigned technician
Services being performed
Parts used
Timeline (started, estimated completion)
Photos
Activity history



3.6 Service Task Management

FR-028: Each service order must have multiple service tasks/items
FR-029: Each task must track: name, description, status, labor cost, parts cost, hours
FR-030: Technicians must update task progress
FR-031: System must calculate total cost from all tasks and parts

3.7 Parts & Inventory

FR-032: System must maintain parts inventory
FR-033: System must track parts used in each service
FR-034: System must deduct parts from inventory when used
FR-035: System must alert when parts are low stock

3.8 Payment & Finance

FR-036: System must track deposits and final payments
FR-037: System must support multiple payment methods (cash, card, transfer)
FR-038: System must generate invoices
FR-039: Finance role must see all payment transactions
FR-040: System must track outstanding payments

3.9 Reporting & Analytics

FR-041: Manager dashboard showing: bikes in service, completed today, pending, revenue
FR-042: Reports: daily/weekly/monthly service summary
FR-043: Reports: technician performance
FR-044: Reports: revenue and payment status
FR-045: Reports: average service completion time

3.10 Notifications & Real-time

FR-046: System must update dashboard in real-time when service status changes
FR-047: System must notify relevant users of status changes
FR-048: System must show recent activity feed


🔧 4. NON-FUNCTIONAL REQUIREMENTS
4.1 Performance

NFR-001: Dashboard must load within 2 seconds
NFR-002: System must handle up to 100 concurrent users
NFR-003: Real-time updates must reflect within 1 second

4.2 Security

NFR-004: All data transmission must be encrypted (HTTPS)
NFR-005: Passwords must meet minimum complexity requirements
NFR-006: System must log all critical operations
NFR-007: Role-based permissions must be strictly enforced

4.3 Usability

NFR-008: Interface must be intuitive for non-technical users
NFR-009: System must be responsive (mobile, tablet, desktop)
NFR-010: Forms must provide clear validation messages

4.4 Reliability

NFR-011: System uptime must be 99.5% or higher
NFR-012: System must have automated daily backups
NFR-013: System must recover from crashes without data loss

4.5 Scalability

NFR-014: Database must handle 10,000+ service orders
NFR-015: System must support future expansion (mobile app, customer portal)


🗂️ 5. DATA ENTITIES
5.1 Core Entities

User Profile - Staff members with roles
Bike Owner - Legal owners of motorcycles (individual or company)
Customer - People bringing bikes for service
Motorcycle - Bikes registered in system
Service Order - Work orders for services
Service Item - Individual tasks within an order
Parts - Inventory items
Service Parts - Parts used in specific service
Payment - Payment transactions
Activity Log - Audit trail

5.2 Key Relationships

Bike Owner → has many → Motorcycles
Customer → can bring → many Motorcycles (with authorization)
Motorcycle → has many → Service Orders
Service Order → references → one Bike Owner (who owns bike)
Service Order → references → one Customer (who brought bike)
Service Order → has many → Service Items
Service Order → has many → Payments
User (Technician) → assigned to → many Service Orders


📅 6. PROJECT PHASES & TIMELINE
Phase 1: Setup & Foundation (2 weeks)
Deliverables:

Development environment setup
Database schema design and creation
Authentication system
Basic project structure (frontend + backend)
Initial UI design system (Shadcn + Tailwind)

Milestones:

✅ Users can login with role-based access
✅ Database tables created and tested


Phase 2: Core Data Management (2 weeks)
Deliverables:

Bike owner management (CRUD)
Customer management (CRUD)
Motorcycle registration (CRUD)
Owner-Customer relationship handling

Milestones:

✅ Can register bike owners (individual/company)
✅ Can register customers
✅ Can add motorcycles linked to owners
✅ Can authorize customers to bring bikes


Phase 3: Service Order System (2 weeks)
Deliverables:

Service order creation workflow
Service order listing and filtering
Service order detail view
Status management
Technician assignment

Milestones:

✅ Sales can create service orders
✅ System tracks owner vs customer
✅ Can assign technicians
✅ Can update service status


Phase 4: Service Monitoring (KEY FEATURE) (2 weeks)
Deliverables:

Dashboard with bikes-in-service counter
Real-time status updates using Supabase realtime
Detailed bike service view
Service progress tracking
Task management for technicians

Milestones:

✅ Dashboard shows live count of bikes in service
✅ Can view detailed status of any bike
✅ Technicians can update progress
✅ Real-time updates work across users


Phase 5: Parts & Inventory (1.5 weeks)
Deliverables:

Parts inventory management
Parts usage tracking
Stock level monitoring

Milestones:

✅ Can manage parts inventory
✅ Can record parts used in service
✅ Inventory automatically updated


Phase 6: Payments & Finance (1.5 weeks)
Deliverables:

Payment processing
Invoice generation
Payment tracking
Financial reports

Milestones:

✅ Finance can process payments
✅ Can generate invoices
✅ Can track outstanding payments


Phase 7: Reports & Analytics (1 week)
Deliverables:

Manager dashboard with KPIs
Service reports
Financial reports
Performance analytics

Milestones:

✅ Manager sees comprehensive dashboard
✅ Can generate various reports


Phase 8: Testing & Deployment (1 week)
Deliverables:

User acceptance testing
Bug fixes
Performance optimization
Production deployment
User training documentation

Milestones:

✅ System tested by actual users
✅ Live in production
✅ Staff trained


Total Duration: 13 weeks (~3 months)

🎯 7. MVP (Minimum Viable Product)
Must-Have for Launch:

✅ User authentication with roles
✅ Register bike owners and customers
✅ Add motorcycles
✅ Create service orders (tracking owner + customer)
✅ Dashboard showing bikes in service count
✅ View detailed service information for each bike
✅ Update service status
✅ Assign technicians
✅ Basic payment tracking

Nice-to-Have (Post-Launch):

Customer SMS notifications
Photo upload for damage documentation
Advanced reporting
Mobile app for customers
Customer self-service portal


📐 8. TECHNICAL ARCHITECTURE
8.1 Frontend Layer

Framework: React 18 with Vite
UI Library: Shadcn UI components
Styling: Tailwind CSS
State Management: Zustand or Redux
Routing: React Router v6
API Client: Axios or Fetch
Real-time: Supabase Realtime

8.2 Backend Layer

Framework: NestJS
API Style: REST
Authentication: Supabase Auth
Authorization: Custom Guards + Decorators

8.3 Database Layer

Primary DB: Supabase (PostgreSQL)
Authentication: Supabase Auth
Real-time: Supabase Realtime subscriptions
Storage: Supabase Storage (for photos)

8.4 Deployment

Frontend: Vercel or Netlify
Backend: Railway, Render, or AWS
Database: Supabase (managed)


🔍 9. KEY WORKFLOWS
9.1 Create Service Order Workflow

Sales staff opens "New Service Order"
Search/Create Bike Owner
Select Motorcycle (from owner's bikes) or Add New
Identify Customer (is it owner or someone else?)
If different person, record relationship
Enter service details (type, description, priority)
Set estimated completion date
Assign technician
Record drop-off mileage
Generate order number
Save and print work order

9.2 Monitor Bikes in Service Workflow

User opens Dashboard
Dashboard displays: "Bikes Currently in Service: 12"
User clicks to view list
System shows all bikes with status indicators
User filters by status (e.g., "In Progress", "Waiting Parts")
User clicks on specific bike
System shows detailed view:

Owner & Customer info
Service timeline
Current status
Assigned technician
Tasks and progress
Parts used
Cost breakdown
Photos and notes



9.3 Update Service Progress Workflow

Technician logs in
Views assigned service orders
Selects a service order
Updates task status
Records parts used
Adds work hours
Updates overall status
Adds notes/photos if needed
System automatically updates real-time counter
Manager sees update immediately on dashboard

9.4 Complete & Deliver Service Workflow

Technician marks all tasks complete
Manager reviews and approves (Quality Check)
Status changes to "Completed"
Finance generates final invoice
Customer notified (future: SMS)
Status changes to "Ready for Pickup"
Customer arrives
Staff verifies ID and authorization
Records who picked up bike
Processes payment
Status changes to "Delivered"
Bike removed from "in service" count


📊 10. REPORTING REQUIREMENTS
10.1 Manager Dashboard

Total bikes in service (real-time)
Today's completed services
Pending approvals
Revenue today/this week/this month
Average service completion time
Overdue services

10.2 Service Reports

Daily service summary
Services by status
Services by technician
Average time per service type
Customer satisfaction (future)

10.3 Financial Reports

Daily/weekly/monthly revenue
Outstanding payments
Payment method breakdown
Cost analysis (parts vs labor)
Profit margins

10.4 Inventory Reports

Parts usage
Low stock alerts
Parts cost analysis


✅ 11. ACCEPTANCE CRITERIA
11.1 For "Bikes in Service" Feature
Given multiple bikes are at various service stages
When manager opens dashboard
Then system displays accurate count of bikes currently in service (excluding delivered/cancelled)
Given a bike's status changes
When technician updates the status
Then dashboard count updates immediately without page refresh
Given user wants to see details
When user clicks on a bike in service
Then system displays complete information including owner, customer, status, progress, timeline, and costs
11.2 For Owner/Customer Distinction
Given bike owner is not the person bringing bike
When creating service order
Then system must record both owner and customer separately
Given service order is completed
When generating invoice
Then system addresses invoice to bike owner (not customer bringing bike)

🚨 12. RISKS & MITIGATION
RiskImpactProbabilityMitigationReal-time updates failHighMediumFallback to polling, comprehensive testingData migration issuesHighLowProper schema design, test data migration earlyUser adoption resistanceHighMediumUser training, intuitive UI designSupabase rate limitsMediumLowImplement caching, optimize queriesRole permission errorsHighLowThorough testing of RBAC

📚 13. DELIVERABLES

Requirements Document ✓ (this document)
Database Schema Design
API Specification Document
UI/UX Mockups
User Manual
Technical Documentation
Test Cases & Results
Deployment Guide
Training Materials