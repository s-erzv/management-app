
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon, Users, Package, ListOrdered, CheckCircle2, AlertCircle, LayoutDashboard as DashboardIcon, Truck, UserCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; 
import UserManagementPage from '@/pages/UserManagementPage'; 
import UserDashboard from '@/components/dashboards/UserDashboard'; 

const AdminDashboard = ({ profile, data }) => {
  const { companyId } = useAuth();
  const [selectedProductId, setSelectedProductId] = useState(data.products[0]?.id);
  const selectedProduct = data.products.find(p => p.id === selectedProductId);
  const [activeTab, setActiveTab] = useState('overview'); 
  const [couriers, setCouriers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  
  useEffect(() => {
    const fetchCouriers = async () => {
      if (companyId) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('company_id', companyId)
          .eq('role', 'user');
        
        if (error) {
          console.error("Error fetching couriers:", error);
        } else {
          setCouriers(data);
        }
      }
    };
    
    fetchCouriers();
  }, [companyId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">
            Halo, {profile.full_name}! 👋
          </h2>
          <p className="text-muted-foreground text-sm">
            Selamat datang kembali. Berikut adalah ringkasan operasional harian perusahaan Anda.
          </p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          className="
            w-full
            flex flex-row flex-wrap sm:flex-nowrap
            items-stretch justify-start
            gap-2 md:gap-3
            bg-white border border-gray-200 rounded-xl p-1
            mb-3
          "
        >
          <TabsTrigger
            value="overview"
            className="
              w-full sm:w-auto
              min-w-0
              flex items-center gap-2
              px-3 py-2 rounded-lg text-sm font-semibold text-gray-700
              data-[state=active]:bg-[#10182b] data-[state=active]:text-white
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
            "
          >
            <DashboardIcon className="h-4 w-4" />
            <span className="truncate">Ringkasan Admin</span>
          </TabsTrigger>

          <TabsTrigger
            value="courier-dashboard"
            className="
              w-full sm:w-auto
              min-w-0
              flex items-center gap-2
              px-3 py-2 rounded-lg text-sm font-semibold text-gray-700
              data-[state=active]:bg-[#10182b] data-[state=active]:text-white
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
            "
          >
            <Truck className="h-4 w-4" />
            <span className="truncate">Dashboard Kurir</span>
          </TabsTrigger>

          <TabsTrigger
            value="user-management"
            className="
              w-full sm:w-auto
              min-w-0
              flex items-center gap-2
              px-3 py-2 rounded-lg text-sm font-semibold text-gray-700
              data-[state=active]:bg-[#10182b] data-[state=active]:text-white
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
            "
          >
            <Users className="h-4 w-4" />
            <span className="truncate">Manajemen Pengguna</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Order Hari Ini</CardTitle>
                <ListOrdered className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalOrdersToday}</div>
                <p className="text-xs text-muted-foreground">Order masuk hari ini</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Order Lunas</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.paidOrders}</div>
                <p className="text-xs text-muted-foreground">Pembayaran lunas hari ini</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Order Belum Lunas</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.unpaidOrders}</div>
                <p className="text-xs text-muted-foreground">Pembayaran belum lunas hari ini</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stok Produk</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex items-center space-x-2">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue placeholder="Pilih Produk" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.products.map(product => (
                      <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xl font-bold">
                  {selectedProduct?.stock ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Alert>
            <RocketIcon className="h-4 w-4" />
            <AlertTitle>Manajemen</AlertTitle>
            <AlertDescription>
              Anda memiliki hak untuk mengelola produk dan pengguna dengan role 'user'.
            </AlertDescription>
          </Alert>
        </TabsContent>
        
        <TabsContent value="courier-dashboard" className="pt-4">
          <div className="mb-4 flex items-center space-x-2">
            <UserCircle2 className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">Pilih Kurir:</span>
            <Select onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Pilih Kurir" />
              </SelectTrigger>
              <SelectContent>
                {couriers.map(courier => (
                  <SelectItem key={courier.id} value={courier.id}>
                    {courier.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedUserId ? (
            <UserDashboard userId={selectedUserId} />
          ) : (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center space-y-3 text-center">
                <Truck className="h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Pilih Kurir untuk Melihat Dashboard</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Pilih salah satu kurir dari dropdown di atas untuk melihat detail pengiriman dan tugas mereka.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="user-management" className="pt-4">
          <UserManagementPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;