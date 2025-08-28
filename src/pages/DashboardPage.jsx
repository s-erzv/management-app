import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

import SuperAdminDashboard from '@/components/dashboards/SuperAdminDashboard';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import UserDashboard from '@/components/dashboards/UserDashboard';

const DashboardPage = () => {
  const { session, loading, userProfile } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    products: [],
    totalOrdersToday: 0,
    paidOrders: 0,
    unpaidOrders: 0,
    tasksToday: 0,
  });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session || !userProfile || loading) return;
      
      setDataLoading(true);
      try {
        await fetchData(userProfile.role, session.user.id);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchDashboardData();
  }, [session, userProfile, loading]);

  const fetchData = async (role, userId) => {
    try {
      // Ambil data produk
      const { data: productsData } = await supabase.from('products').select('*');

      if (role === 'super_admin' || role === 'admin') {
        const today = new Date().toISOString().split('T')[0];
        const { data: ordersToday } = await supabase
          .from('orders')
          .select('id, payment_status')
          .gte('created_at', `${today}T00:00:00Z`)
          .lte('created_at', `${today}T23:59:59Z`);

        setDashboardData({
          products: productsData || [],
          totalOrdersToday: ordersToday?.length || 0,
          paidOrders: ordersToday?.filter(o => o.payment_status === 'paid').length || 0,
          unpaidOrders: ordersToday?.filter(o => o.payment_status === 'unpaid').length || 0,
        });
      }

      if (role === 'user') {
        const today = new Date().toISOString().split('T')[0];
        const { data: tasks } = await supabase
          .from('orders')
          .select('id')
          .eq('courier_id', userId)
          .eq('planned_date', today)
          .neq('status', 'completed');
          
        setDashboardData({
          products: productsData || [],
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

  const { role, full_name } = userProfile;

  const renderDashboardComponent = () => {
    switch (role) {
      case 'super_admin':
        return <SuperAdminDashboard profile={userProfile} data={dashboardData} />;
      case 'admin':
        return <AdminDashboard profile={userProfile} data={dashboardData} />;
      case 'user':
        return <UserDashboard profile={userProfile} data={dashboardData} />;
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

  return (
    <div className="container mx-auto p-4 md:p-8">
      {renderDashboardComponent()}
    </div>
  );
};

export default DashboardPage;