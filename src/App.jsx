import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import Navbar from './components/Navbar'; 

import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import UserManagementPage from './pages/UserManagementPage';
import SettingsPage from './pages/SettingsPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import CalendarPage from './pages/CalendarPage';
import CourierPage from './pages/CourierPage';
import StockPage from './pages/StockPage';
import ReportsPage from './pages/ReportsPage';

const App = () => {
  const { session, loading } = useAuth();
   
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppContent session={session} />
    </BrowserRouter>
  );
};

const AppContent = ({ session }) => {
  const { userRole, loadingRole } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  const isSuperAdmin = userRole === 'super_admin';
  const isAdminOrSuperAdmin = isSuperAdmin || userRole === 'admin';
  const isCourier = userRole === 'user';
  
  if (loadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <>
      {!isLoginPage && <Navbar />} 
      <main>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          {/* Rute yang dilindungi oleh login */}
          <Route
            path="/dashboard"
            element={session ? <DashboardPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/courier"
            element={session && isCourier ? <CourierPage /> : <Navigate to="/dashboard" />}
          />
          <Route
            path="/calendar"
            element={session && isAdminOrSuperAdmin ? <CalendarPage /> : <Navigate to="/dashboard" />}
          />
          
          {/* Rute yang dapat diakses oleh Super Admin dan Admin */}
          <Route
            path="/settings"
            element={session && (userRole === 'super_admin' || userRole === 'admin') ? <SettingsPage /> : <Navigate to="/dashboard" />}
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
          
          {/* Rute khusus Super Admin */}
          <Route
            path="/settings/users"
            element={session && isSuperAdmin ? <UserManagementPage /> : <Navigate to="/dashboard" />}
          />

          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </>
  );
};

export default App;
