import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { BikesPage } from './pages/BikesPage';
import { BikeDetailPage } from './pages/BikeDetailPage';
import { ServiceOrdersPage } from './pages/ServiceOrdersPage';
import { ServiceOrderDetailPage } from './pages/ServiceOrderDetailPage';
import { EmployeeWorkPage } from './pages/EmployeeWorkPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage';
import { ServiceBoardPage } from './pages/ServiceBoardPage';
import { PartsPage } from './pages/PartsPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProductsPage } from './pages/inventory/ProductsPage';
import { ProductDetailPage } from './pages/inventory/ProductDetailPage';
import { ProductFormPage } from './pages/inventory/ProductFormPage';
import { BrandsPage } from './pages/inventory/BrandsPage';
import { ProductCategoriesPage } from './pages/inventory/ProductCategoriesPage';
import { ProductCategoryFormPage } from './pages/inventory/ProductCategoryFormPage';
import { AttributeDefinitionsPage } from './pages/inventory/AttributeDefinitionsPage';
import { StockLevelsPage } from './pages/inventory/StockLevelsPage';
import { StockAdjustmentsPage } from './pages/inventory/StockAdjustmentsPage';
import { PurchaseOrdersPage } from './pages/inventory/PurchaseOrdersPage';
import { PurchaseOrderFormPage } from './pages/inventory/PurchaseOrderFormPage';
import { PurchaseOrderDetailsPage } from './pages/inventory/PurchaseOrderDetailsPage';
import { SupplierDetailsPage } from './pages/inventory/SupplierDetailsPage';
import { SalesOrdersPage } from './pages/sales/SalesOrdersPage';
import { SalesOrderFormPage } from './pages/sales/SalesOrderFormPage';
import { SalesOrderDetailPage } from './pages/sales/SalesOrderDetailPage';
import { SalesReportsPage } from './pages/sales/SalesReportsPage';
import { POSPage } from './pages/pos/POSPage';
import { RolesPage } from './pages/settings/RolesPage';
import { RoleDetailPage } from './pages/settings/RoleDetailPage';
import { PermissionAuditPage } from './pages/settings/PermissionAuditPage';
import { EmployeeEditPage } from './pages/EmployeeEditPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from './components/ui/sonner';
import { getPageTitle } from './hooks/useDocumentTitle';

// Component that uses the router context
function AppRoutes() {
  const location = useLocation();

  return (
    <>
      <title>{getPageTitle(location.pathname)}</title>
      <Toaster />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CustomersPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CustomerDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bikes"
          element={
            <ProtectedRoute>
              <AppLayout>
                <BikesPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bikes/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <BikeDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/service-orders"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ServiceOrdersPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/service-orders/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ServiceOrderDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/service-board"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ServiceBoardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-work"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EmployeeWorkPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/parts"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PartsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <AppLayout>
                <SuppliersPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <SupplierDetailsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/purchase-orders"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PurchaseOrdersPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/purchase-orders/new"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PurchaseOrderFormPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/purchase-orders/:id/edit"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PurchaseOrderFormPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/purchase-orders/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PurchaseOrderDetailsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/attributes"
          element={
            <ProtectedRoute>
              <AppLayout>
                <AttributeDefinitionsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/brands"
          element={
            <ProtectedRoute>
              <AppLayout>
                <BrandsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/categories"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProductCategoriesPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/categories/new"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProductCategoryFormPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/categories/:id/edit"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProductCategoryFormPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PaymentsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ReportsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EmployeesPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EmployeeDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/products"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProductsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/products/new"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProductFormPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/products/:id/edit"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProductFormPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/products/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProductDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stock"
          element={
            <ProtectedRoute>
              <AppLayout>
                <StockLevelsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/adjustments"
          element={
            <ProtectedRoute>
              <AppLayout>
                <StockAdjustmentsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/orders"
          element={
            <ProtectedRoute>
              <AppLayout>
                <SalesOrdersPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/orders/new"
          element={
            <ProtectedRoute>
              <AppLayout>
                <SalesOrderFormPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/orders/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <SalesOrderDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/reports"
          element={
            <ProtectedRoute>
              <AppLayout>
                <SalesReportsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute>
              <AppLayout>
                <POSPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/roles"
          element={
            <ProtectedRoute>
              <AppLayout>
                <RolesPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/roles/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <RoleDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees/:id/edit"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EmployeeEditPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/audit"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PermissionAuditPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
