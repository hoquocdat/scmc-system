import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { BrandsPage } from './pages/BrandsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <BrowserRouter>
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
          path="/brands"
          element={
            <ProtectedRoute>
              <AppLayout>
                <BrandsPage />
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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
