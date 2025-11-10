# SCMC Workshop Management System - API Design

## Base URL
`http://localhost:3000/api`

## Authentication
All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

## Endpoints

### Authentication
- `POST /auth/login` - Login with email/password
- `POST /auth/signup` - Register new user (admin only)
- `GET /auth/profile` - Get current user profile
- `POST /auth/logout` - Logout

### Customers
- `GET /customers` - List all customers (with pagination)
- `GET /customers/:id` - Get customer by ID
- `POST /customers` - Create customer (Sales, Manager)
- `PUT /customers/:id` - Update customer (Sales, Manager)
- `DELETE /customers/:id` - Delete customer (Manager only)

### Bikes
- `GET /bikes` - List all bikes (with owner info)
- `GET /bikes/:id` - Get bike by ID
- `GET /bikes/owner/:ownerId` - Get bikes by owner
- `POST /bikes` - Create bike (Sales, Manager)
- `PUT /bikes/:id` - Update bike (Sales, Manager)
- `DELETE /bikes/:id` - Delete bike (Manager only)

### Service Orders
- `GET /service-orders` - List all service orders (filtered by role)
- `GET /service-orders/:id` - Get service order details
- `GET /service-orders/technician/:technicianId` - Get orders for technician
- `POST /service-orders` - Create service order (Sales, Manager)
- `PUT /service-orders/:id` - Update service order
- `PATCH /service-orders/:id/status` - Update order status
- `PATCH /service-orders/:id/assign` - Assign technician (Manager)
- `DELETE /service-orders/:id` - Cancel order (Manager)
- `GET /service-orders/stats/in-service` - Get bikes in service count

### Service Items (Tasks)
- `GET /service-orders/:orderId/items` - Get tasks for order
- `POST /service-orders/:orderId/items` - Add task
- `PUT /service-items/:id` - Update task
- `PATCH /service-items/:id/status` - Update task status (Technician)
- `DELETE /service-items/:id` - Delete task

### Payments
- `GET /payments` - List all payments
- `GET /payments/order/:orderId` - Get payments for order
- `GET /payments/outstanding` - Get orders with outstanding balance (Finance)
- `POST /payments` - Record payment (Finance)
- `DELETE /payments/:id` - Delete payment (Manager only)

### Parts
- `GET /parts` - List all parts
- `GET /parts/:id` - Get part by ID
- `GET /parts/low-stock` - Get low stock parts
- `POST /parts` - Create part (Manager)
- `PUT /parts/:id` - Update part (Manager)
- `DELETE /parts/:id` - Delete part (Manager)

### Technicians (User Profiles)
- `GET /users` - List all users (Manager)
- `GET /users/technicians` - List all technicians
- `GET /users/:id` - Get user by ID
- `POST /users` - Create user (Manager only)
- `PUT /users/:id` - Update user (Manager)
- `PATCH /users/:id/activate` - Activate/deactivate user (Manager)

### Dashboard
- `GET /dashboard/stats` - Get dashboard statistics

## Role-Based Access Control

### Sales
- Create/update customers
- Create/update bikes
- Create service orders
- View all service orders

### Technician
- View assigned service orders
- Update task status
- Update service order progress

### Manager
- Full access to all endpoints
- Assign technicians
- Approve work
- View analytics

### Finance
- Process payments
- View payment history
- Generate invoices
- Track receivables

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

### Pagination Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```
