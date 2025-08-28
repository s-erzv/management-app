import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CalendarPage = () => {
  const { userRole, companyId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCourierId, setSelectedCourierId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    
    // DEBUGGING: Log nilai-nilai sebelum kueri dijalankan
    console.log('Fetching data...');
    console.log('Current user role:', userRole);
    console.log('Current user company ID:', companyId);

    // Fetch orders
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name),
        couriers:profiles (full_name)
      `)
      .order('planned_date', { ascending: true })
      // Tambahkan filter berdasarkan companyId
      .eq('company_id', companyId); 

    // Fetch couriers based on user role and company ID
    let couriersQuery = supabase
      .from('profiles')
      .select('id, full_name');
    
    // Asumsi: Super admin dapat melihat semua kurir (user)
    if (userRole === 'super_admin') {
      couriersQuery = couriersQuery.eq('role', 'user');
    } else {
      // Admin/User hanya dapat melihat kurir di perusahaan mereka
      couriersQuery = couriersQuery
        .eq('role', 'user')
        .eq('company_id', companyId);
    }
    
    const { data: couriersData, error: couriersError } = await couriersQuery;

    if (ordersError || couriersError) {
      console.error('Error fetching data:', ordersError || couriersError);
      toast.error('Gagal memuat data.');
    } else {
      setOrders(ordersData);
      setCouriers(couriersData);
      console.log('Fetched orders:', ordersData);
      console.log('Fetched couriers:', couriersData);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
  }, [userRole, companyId]);

  const handleOpenAssignModal = (order) => {
    setSelectedOrder(order);
    setSelectedCourierId(order.courier_id || '');
    setIsAssignModalOpen(true);
  };

  const handleAssignCourier = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('orders')
      .update({ courier_id: selectedCourierId })
      .eq('id', selectedOrder.id);
    
    if (error) {
      console.error('Error assigning courier:', error);
      toast.error('Gagal menugaskan kurir.');
    } else {
      toast.success('Kurir berhasil ditugaskan!');
      fetchData(); // Refresh data
      setIsAssignModalOpen(false);
      setSelectedOrder(null);
      setSelectedCourierId('');
    }
    setLoading(false);
  };
  
  const ordersByDate = orders.reduce((acc, order) => {
    const date = order.planned_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(order);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">Jadwal Pengiriman</h1>
      <div className="space-y-6">
        {Object.keys(ordersByDate).length === 0 ? (
          <p className="text-center text-muted-foreground">Tidak ada jadwal pengiriman.</p>
        ) : (
          Object.keys(ordersByDate).map(date => (
            <div key={date}>
              <h2 className="text-xl font-semibold mb-2">{date}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ordersByDate[date].map(order => (
                  <Card key={order.id}>
                    <CardHeader>
                      <CardTitle>Pesanan #{order.id.slice(0, 8)}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm">Pelanggan: <span className="font-medium">{order.customers?.name}</span></p>
                      <div className="text-sm">
                        Status: <Badge>{order.status}</Badge>
                      </div>
                      <p className="text-sm">Kurir: <span className="font-medium">{order.couriers?.full_name ?? 'Belum Ditugaskan'}</span></p>
                      <Button className="w-full mt-2" onClick={() => handleOpenAssignModal(order)}>
                        {order.courier_id ? 'Ubah Kurir' : 'Atur Kurir'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tugaskan Kurir</DialogTitle>
            <DialogDescription>
              Pilih kurir untuk pesanan #{selectedOrder?.id?.slice(0, 8)}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssignCourier}>
            <div className="space-y-4">
              <Select onValueChange={setSelectedCourierId} value={selectedCourierId}>
                <SelectTrigger>
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tugaskan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;