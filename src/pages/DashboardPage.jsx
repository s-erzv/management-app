import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon, Users, ListOrdered } from 'lucide-react';
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
      const todayString = new Date().toISOString().split('T')[0];

      if (role === 'super_admin' || role === 'admin') {
        const { data: productsData } = await supabase.from('products').select('*');
        
        // Perbaikan: Ubah filter dari `created_at` ke `planned_date`
        const { data: ordersToday, error: ordersError } = await supabase
          .from('orders')
          .select('id, payment_status')
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

  const { role } = userProfile;

  const renderDashboardComponent = () => {
    switch (role) {
      case 'super_admin':
        return <SuperAdminDashboard profile={userProfile} data={dashboardData} />;
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

  return (
    <div className="container mx-auto p-4 md:p-8">
      {renderDashboardComponent()}
    </div>
  );
};

export default DashboardPage;