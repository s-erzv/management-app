import { useEffect, useState } from 'react';
import { Loader2, Settings, Package, Users, Banknote } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import ProductSettings from '@/components/ProductSettings';
import UserManagementPage from '@/pages/UserManagementPage';
import CustomerStatusSettings from '@/components/CustomerStatusSettings';
import PaymentMethodsPage from '@/pages/PaymentMethodsPage';
import { useAuth } from '../contexts/AuthContext';

// Palet warna utama
const PRIMARY = '#10182b';

const SettingsPage = () => {
  const { userProfile, loading } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading) setPageLoading(false);
  }, [loading]);

  if (loading || pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <p className="text-center text-red-500">
          Gagal memuat profil pengguna. Silakan muat ulang halaman.
        </p>
      </div>
    );
  }

  const userRole = userProfile.role;
  const isSuperAdmin = userRole === 'super_admin';
  const isAdminOrSuperAdmin = isSuperAdmin || userRole === 'admin';

  if (!isAdminOrSuperAdmin) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <Card className="p-6 border border-gray-200 bg-white">
          <p className="text-center text-red-600">Anda tidak memiliki akses ke halaman ini.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: PRIMARY }}>
          <Settings className="h-8 w-8" />
          Pengaturan Aplikasi
        </h1>
      </div>

      <Card className="p-4 md:p-6 bg-white border border-gray-200 shadow-sm">
        <Tabs defaultValue="products" className="w-full">
          {/* TabsList dengan grid responsif */}
          <TabsList className="grid w-full justify-start grid-cols-1 gap-1 bg-transparent p-0 h-auto md:grid-cols-3">
            {isAdminOrSuperAdmin && (
              <TabsTrigger
                value="products"
                className="w-full text-xs sm:text-sm px-2 py-2 rounded-md data-[state=active]:bg-[#10182b] data-[state=active]:text-white"
              >
                <Package className="h-4 w-4 mr-1" />
                Manajemen Produk
              </TabsTrigger>
            )}

            {isAdminOrSuperAdmin && (
              <TabsTrigger
                value="customer-statuses"
                className="w-full text-xs sm:text-sm px-2 py-2 rounded-md data-[state=active]:bg-[#10182b] data-[state=active]:text-white"
              >
                <Settings className="h-4 w-4 mr-1" />
                Status Pelanggan
              </TabsTrigger>
            )}

            {isAdminOrSuperAdmin && (
              <TabsTrigger
                value="payment-methods"
                className="w-full text-xs sm:text-sm px-2 py-2 rounded-md data-[state=active]:bg-[#10182b] data-[state=active]:text-white"
              >
                <Banknote className="h-4 w-4 mr-1" />
                Metode Pembayaran
              </TabsTrigger>
            )}

            {isSuperAdmin && (
              <TabsTrigger
                value="users"
                className="w-full text-xs sm:text-sm px-2 py-2 rounded-md data-[state=active]:bg-[#10182b] data-[state=active]:text-white"
              >
                <Users className="h-4 w-4 mr-1" />
                Manajemen Pengguna
              </TabsTrigger>
            )}
          </TabsList>

          <div className="mt-4">
            {isAdminOrSuperAdmin && (
              <TabsContent value="products">
                <ProductSettings />
              </TabsContent>
            )}

            {isAdminOrSuperAdmin && (
              <TabsContent value="customer-statuses">
                <CustomerStatusSettings />
              </TabsContent>
            )}

            {isAdminOrSuperAdmin && (
              <TabsContent value="payment-methods">
                <PaymentMethodsPage />
              </TabsContent>
            )}

            {isSuperAdmin && (
              <TabsContent value="users">
                <UserManagementPage />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </Card>
    </div>
  );
};

export default SettingsPage;
