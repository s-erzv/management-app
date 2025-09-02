import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

import Sidebar from './components/Navbar'; 
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import CalendarPage from './pages/CalendarPage';
import StockPage from './pages/StockPage';
import ReportsPage from './pages/ReportsPage';
import UserManagementPage from './pages/UserManagementPage';
import CentralOrderPage from './pages/CentralOrderPage';
import CentralOrderFormPage from './pages/CentralOrderFormPage';
import AddOrderForm from './components/AddOrderForm'; 
import CompleteDeliveryPage from './pages/CompleteDeliveryPage';
import GalonDebtPage from './pages/GalonDebtPage';

const App = () => {
  const { session, loading, userProfile } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdminOrSuperAdmin = isSuperAdmin || userProfile?.role === 'admin';
  const isCourier = userProfile?.role === 'user';
  const isLoginPage = window.location.pathname === '/login';

  // Tampilkan AuthPage saja jika belum login
  if (!userProfile && !isLoginPage) {
    return (
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    );
  }
  
  return (
    <BrowserRouter>
      <div className="flex min-h-screen"> 
        {userProfile && <Sidebar />}
        <main className="flex-1 p-4 md:p-8"> 
          <Routes>
            <Route path="/login" element={!userProfile ? <AuthPage /> : <Navigate to="/dashboard" />} />
            <Route
              path="/dashboard"
              element={session ? <DashboardPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/calendar"
              element={session && isAdminOrSuperAdmin ? <CalendarPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/settings"
              element={session && isAdminOrSuperAdmin ? <SettingsPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/customers"
              element={session && isAdminOrSuperAdmin ? <CustomersPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/orders"
              element={session && isAdminOrSuperAdmin ? <OrdersPage /> : <Navigate to="/dashboard" />}
            />
           <Route
              path="/orders/add"
              element={session && isAdminOrSuperAdmin ? <AddOrderForm /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/orders/:id"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <OrderDetailsPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/stock"
              element={session && isAdminOrSuperAdmin ? <StockPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/reports"
              element={session && isAdminOrSuperAdmin ? <ReportsPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/central-orders"
              element={session && isAdminOrSuperAdmin ? <CentralOrderPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/central-order/:id"
              element={session && isAdminOrSuperAdmin ? <CentralOrderFormPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/central-order/new"
              element={session && isAdminOrSuperAdmin ? <CentralOrderFormPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/users"
              element={session && isAdminOrSuperAdmin ? <UserManagementPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/complete-delivery/:orderId"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <CompleteDeliveryPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/galon-debt"
              element={session && isAdminOrSuperAdmin ? <GalonDebtPage /> : <Navigate to="/dashboard" />}
            />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
      <Toaster />
    </BrowserRouter>
  );

};

export default App;