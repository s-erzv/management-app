import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductSettings from '@/components/ProductSettings';
import UserManagementPage from '@/pages/UserManagementPage'; // Path ini mungkin perlu disesuaikan

const SettingsPage = () => {
  const { userRole, loadingRole } = useAuth();
  const isSuperAdmin = userRole === 'super_admin';
  const isAdminOrSuperAdmin = isSuperAdmin || userRole === 'admin';

  if (loadingRole) {
    return <p>Memuat pengaturan...</p>;
  }

  if (!isAdminOrSuperAdmin) {
    return <p>Anda tidak memiliki akses ke halaman ini.</p>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Pengaturan Aplikasi</h1>
      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          {isAdminOrSuperAdmin && (
            <TabsTrigger value="products">Manajemen Produk</TabsTrigger>
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