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
    <div className="space-y-6 container mx-auto p-4 md:p-8 max-w-7xl"> {/* ⬅️ tweak: bungkus container biar padding/width konsisten */}
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
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full"> {/* ⬅️ tweak: pastikan w-full */}
         <TabsList className="grid w-full justify-start grid-cols-1 gap-1 md:gap-2 bg-transparent p-0 h-auto md:grid-cols-3"> {/* ⬅️ tweak: md:gap-2 */}
            <TabsTrigger
              value="overview"
              className="w-full text-xs sm:text-sm px-2 py-2 rounded-md data-[state=active]:bg-[#10182b] data-[state=active]:text-white"
            >
              <span className="truncate">Ringkasan Admin</span>
            </TabsTrigger>

            <TabsTrigger
              value="courier-dashboard"
              className="w-full text-xs sm:text-sm px-2 py-2 rounded-md data-[state=active]:bg-[#10182b] data-[state=active]:text-white"
            >
              <span className="truncate">Dashboard Petugas</span>
            </TabsTrigger>

            <TabsTrigger
              value="user-management"
              className="w-full text-xs sm:text-sm px-2 py-2 rounded-md data-[state=active]:bg-[#10182b] data-[state=active]:text-white"
            >
              <span className="truncate">Manajemen Pengguna</span>
            </TabsTrigger>
          </TabsList>

        <TabsContent value="overview" className="mt-4 pt-4 space-y-6"> {/* ⬅️ tweak: tambah mt-4 supaya ada jarak dari TabsList */}
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
                <CardTitle className="text-sm font-medium">Order Pending</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.unpaidOrders}</div>
                <p className="text-xs text-muted-foreground">Pembayaran Pending hari ini</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stok Produk</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex items-center flex-wrap gap-2"> {/* ⬅️ tweak: flex-wrap + gap biar nggak nimpah */}
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="w-[120px] sm:w-[160px] h-8"> {/* ⬅️ tweak: tambah sm:w-[160px] (w lama tetap ada) */}
                    <SelectValue placeholder="Pilih Produk" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.products.map(product => (
                      <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xl font-bold min-w-[3ch]"> {/* ⬅️ tweak: min-w biar angka nggak lompat-lompat */}
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
        
        <TabsContent value="courier-dashboard" className="mt-4 pt-4"> {/* ⬅️ tweak: tambah mt-4 */}
          <div className="mb-4 flex items-center flex-wrap gap-2"> {/* ⬅️ tweak: flex-wrap + gap-2 */}
            <UserCircle2 className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">Pilih Petugas:</span>
            <Select onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[200px] sm:w-[240px]"> {/* ⬅️ tweak: tambah sm:w */}
                <SelectValue placeholder="Pilih Petugas" />
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
                <h3 className="text-lg font-semibold">Pilih Petugas untuk Melihat Dashboard</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Pilih salah satu Petugas dari dropdown di atas untuk melihat detail pengiriman dan tugas mereka.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="user-management" className="mt-4 pt-4"> {/* ⬅️ tweak: tambah mt-4 */}
          <UserManagementPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
