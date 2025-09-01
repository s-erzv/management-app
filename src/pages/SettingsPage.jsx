import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductSettings from '@/components/ProductSettings';
import UserManagementPage from '@/pages/UserManagementPage';
import CustomerStatusSettings from '@/components/CustomerStatusSettings'; 
import PaymentMethodsPage from '@/pages/PaymentMethodsPage'; // Tambahkan import PaymentMethodsPage
import { Loader2 } from 'lucide-react';

const SettingsPage = () => {
  const { userProfile, loading } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading) {
      setPageLoading(false);
    }
  }, [loading]);

  if (loading || pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <p className="text-center text-red-500">Gagal memuat profil pengguna. Silakan refresh halaman.</p>
      </div>
    );
  }

  const userRole = userProfile.role;
  const isSuperAdmin = userRole === 'super_admin';
  const isAdminOrSuperAdmin = isSuperAdmin || userRole === 'admin';

  if (!isAdminOrSuperAdmin) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <p className="text-center text-red-500">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Pengaturan Aplikasi</h1>
      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          {isAdminOrSuperAdmin && (
            <TabsTrigger value="products">Manajemen Produk</TabsTrigger>
          )}
          {isAdminOrSuperAdmin && (
            <TabsTrigger value="customer-statuses">Status Pelanggan</TabsTrigger>
          )}
          {isAdminOrSuperAdmin && ( // Tambahkan tab ini untuk admin & super admin
            <TabsTrigger value="payment-methods">Metode Pembayaran</TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="users">Manajemen Pengguna</TabsTrigger>
          )}
        </TabsList>
        {isAdminOrSuperAdmin && (
          <TabsContent value="products" className="pt-4">
            <ProductSettings />
          </TabsContent>
        )}
        {isAdminOrSuperAdmin && (
          <TabsContent value="customer-statuses" className="pt-4"> 
            <CustomerStatusSettings />
          </TabsContent>
        )}
        {isAdminOrSuperAdmin && ( 
          <TabsContent value="payment-methods" className="pt-4">
            <PaymentMethodsPage />
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="users" className="pt-4">
            <UserManagementPage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default SettingsPage;