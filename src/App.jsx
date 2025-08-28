import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';

import Navbar from './components/Navbar'; 
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import CalendarPage from './pages/CalendarPage';
import CourierPage from './pages/CourierPage';
import StockPage from './pages/StockPage';
import ReportsPage from './pages/ReportsPage';
import UserManagementPage from './pages/UserManagementPage';

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
  const { userRole, loading, userProfile } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  const isSuperAdmin = userRole === 'super_admin';
  const isAdminOrSuperAdmin = isSuperAdmin || userRole === 'admin';
  const isCourier = userRole === 'user';
  
  if (loading || !userProfile) {
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
            path="/users"
            element={session && isAdminOrSuperAdmin ? <UserManagementPage /> : <Navigate to="/dashboard" />}
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </>
  );
};

export default App;