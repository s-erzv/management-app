import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon, Users, ListOrdered } from 'lucide-react';
import { Loader2, Building2, BarChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from 'date-fns';

import SuperAdminDashboard from '@/components/dashboards/SuperAdminDashboard';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import UserDashboard from '@/components/dashboards/UserDashboard';

const DashboardPage = () => {
  const { session, loading, userProfile, companyId, setActiveCompany } = useAuth(); 
  const [dashboardData, setDashboardData] = useState({
    products: [],
    totalOrdersToday: 0,
    paidOrders: 0,
    unpaidOrders: 0,
    tasksToday: 0,
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [salesData, setSalesData] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session || !userProfile || loading) return;

      if (userProfile.role === 'super_admin' && !companyId) {
        setDataLoading(true);
        const { data: companiesData, error: companiesError } = await supabase.from('companies').select('id, name');
        if (companiesError) {
          console.error('Error fetching companies:', companiesError);
          setCompanies([]);
        } else {
          setCompanies(companiesData || []);
        }

        // Fetch sales data for all companies for the last 30 days
        const { data: sales, error: salesError } = await supabase
          .from('orders')
          .select('company_id, grand_total, created_at')
          .gte('created_at', subDays(new Date(), 30).toISOString());

        if (salesError) {
          console.error('Error fetching sales data:', salesError);
          setSalesData([]);
        } else {
          // Buat array dari semua tanggal dalam 30 hari terakhir
          const allDates = Array.from({ length: 30 }, (_, i) => 
            format(subDays(new Date(), 29 - i), 'yyyy-MM-dd')
          );

          const processedSales = sales.reduce((acc, sale) => {
            const date = format(new Date(sale.created_at), 'yyyy-MM-dd');
            const company = companiesData.find(c => c.id === sale.company_id)?.name || 'Unknown';
            if (!acc[date]) {
              acc[date] = { date: date };
            }
            acc[date][company] = (acc[date][company] || 0) + (sale.grand_total || 0);
            return acc;
          }, {});
          
          // Gabungkan data penjualan dengan semua tanggal, mengisi nilai 0 jika tidak ada penjualan
          const finalSalesData = allDates.map(date => {
            const dateData = processedSales[date] || { date };
            companiesData.forEach(company => {
              if (!dateData[company.name]) {
                dateData[company.name] = 0;
              }
            });
            return dateData;
          });

          setSalesData(finalSalesData);
        }

        setDataLoading(false);
        return;
      }
      
      if (!companyId) return;

      setDataLoading(true);
      try {
        await fetchData(userProfile.role, session.user.id, companyId);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchDashboardData();
  }, [session, userProfile, loading, companyId]);

  const fetchData = async (role, userId, currentCompanyId) => {
    try {
      const todayString = format(new Date(), 'yyyy-MM-dd');

      if (role === 'super_admin' || role === 'admin') {
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('company_id', currentCompanyId);
        
        const { data: ordersToday, error: ordersError } = await supabase
          .from('orders')
          .select('id, payment_status')
          .eq('company_id', currentCompanyId)
          .eq('planned_date', todayString);

        if (ordersError) {
          console.error('Error fetching orders for dashboard:', ordersError);
          setDashboardData({
            products: productsData || [],
            totalOrdersToday: 0,
            paidOrders: 0,
            unpaidOrders: 0,
          });
        } else {
          const unpaidCount = ordersToday?.filter(o => o.payment_status !== 'paid').length || 0;

          setDashboardData({
            products: productsData || [],
            totalOrdersToday: ordersToday?.length || 0,
            paidOrders: ordersToday?.filter(o => o.payment_status === 'paid').length || 0,
            unpaidOrders: unpaidCount,
          });
        }
      }

      if (role === 'user') {
        const { data: tasks } = await supabase
          .from('orders')
          .select('id')
          .eq('courier_id', userId)
          .eq('company_id', currentCompanyId)
          .eq('planned_date', todayString)
          .neq('status', 'completed');
          
        setDashboardData({
          tasksToday: tasks?.length || 0
        });
      }
    } catch (error) {
      console.error('Error in fetchData:', error);
      setDashboardData({
        products: [],
        totalOrdersToday: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        tasksToday: 0,
      });
    }
  };

  const renderDashboardComponent = () => {
    if (userProfile.role === 'super_admin' && !companyId) {
      return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl">
          <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Building2 className="h-8 w-8" />
            Pilih Perusahaan
          </h1>
          
          <Card className="mb-8 border-0 shadow-lg bg-white">
            <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
              <CardTitle className="text-xl flex items-center gap-2">
                <BarChart className="h-6 w-6" /> Tren Penjualan 30 Hari Terakhir
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {salesData && salesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {companies.map((company, index) => (
                      <Line
                        key={company.id}
                        type="monotone"
                        dataKey={company.name}
                        stroke={`hsl(${(index * 137.508) % 360}, 70%, 50%)`}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-40 text-muted-foreground">
                  Tidak ada data penjualan untuk ditampilkan.
                </div>
              )}
            </CardContent>
          </Card>
          
          <p className="text-muted-foreground mb-8">
            Silakan pilih perusahaan yang ingin Anda kelola atau pantau.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <Card 
                key={company.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
                onClick={() => setActiveCompany(company.id)}
              >
                <CardHeader>
                  <CardTitle>{company.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline">Masuk Dashboard</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    switch (userProfile.role) {
      case 'super_admin':
        return <AdminDashboard profile={userProfile} data={dashboardData} />;
      case 'admin':
        return <AdminDashboard profile={userProfile} data={dashboardData} />;
      case 'user':
        return <UserDashboard userId={userProfile.id} />;
      default:
        return (
          <Alert>
            <RocketIcon className="h-4 w-4" />
            <AlertTitle>Akses Dibatasi</AlertTitle>
            <AlertDescription>
              Role Anda tidak dikenali atau tidak memiliki hak akses ke halaman ini.
            </AlertDescription>
          </Alert>
        );
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <Alert variant="destructive">
        <RocketIcon className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Sesi tidak ditemukan. Silakan login kembali.
        </AlertDescription>
      </Alert>
    );
  }

  if (!userProfile) {
    return (
      <Alert variant="destructive">
        <RocketIcon className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Gagal memuat profil pengguna. Silakan coba login kembali.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      {renderDashboardComponent()}
    </div>
  );
};

export default DashboardPage;