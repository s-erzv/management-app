import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

import Sidebar from './components/Navbar'; 
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import StockAndGalonPage from './pages/StockAndGalonPage';
import ReportsPage from './pages/ReportsPage';
import UserManagementPage from './pages/UserManagementPage';
import CentralOrderPage from './pages/CentralOrderPage';
import CentralOrderFormPage from './pages/CentralOrderFormPage';
import AddOrderForm from './components/AddOrderForm'; 
import CompleteDeliveryPage from './pages/CompleteDeliveryPage';
import UpdateStockPage from './pages/UpdateStockPage';
import ExpenseReportsPage from './pages/ExpenseReportsPage';
import FinancialReportPage from './pages/FinancialReportPage'; 
import FinancialManagementPage from './pages/FinancialManagementPage';
import DataExportPage from './pages/DataExportPage';

const App = () => {
  const { session, loading, userProfile } = useAuth();
  
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(registration => {
          console.log('Service Worker berhasil didaftarkan dengan ruang lingkup:', registration.scope);
        }).catch(error => {
          console.error('Pendaftaran Service Worker gagal:', error);
        });
      });
    }
  }, []);
  
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

  return (
    <BrowserRouter>
      {userProfile && <Sidebar />}
      <main className="min-h-screen bg-white md:ml-16 transition-all duration-300">
        <div className="p-4 md:p-8">
          <Routes>
            <Route path="/login" element={!userProfile ? <AuthPage /> : <Navigate to="/dashboard" />} />
            <Route
              path="/dashboard"
              element={session ? <DashboardPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/settings"
              element={session && isAdminOrSuperAdmin ? <SettingsPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/customers"
             element={session && (isAdminOrSuperAdmin || isCourier) ? <CustomersPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/orders"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <OrdersPage /> : <Navigate to="/dashboard" />}
            />
           <Route
              path="/orders/add"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <AddOrderForm /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/orders/:id"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <OrderDetailsPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/stock"
             element={session && (isAdminOrSuperAdmin || isCourier) ? <StockAndGalonPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/stock-reconciliation"
             element={session && (isAdminOrSuperAdmin || isCourier) ? <UpdateStockPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/reports"
              element={session && (isAdminOrSuperAdmin || isCourier) ?<ReportsPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/central-orders"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <CentralOrderPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/central-order/:id"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <CentralOrderFormPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/central-order/new"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <CentralOrderFormPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/complete-delivery/:orderId"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <CompleteDeliveryPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/expenses"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <ExpenseReportsPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/financials"
              element={session && isAdminOrSuperAdmin ? <FinancialReportPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/financial-management"
              element={session && isAdminOrSuperAdmin ? <FinancialManagementPage /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/data-export"
              element={session && isAdminOrSuperAdmin ? <DataExportPage /> : <Navigate to="/dashboard" />}
            />
            <Route path="*" element={<Navigate to="/dashboard" />} />
            {isSuperAdmin && (
              <Route
                path="/users"
                element={<UserManagementPage />}
              />
            )}
          </Routes>
        </div>
      </main>
      <Toaster />
    </BrowserRouter>
  );
};

export default App;