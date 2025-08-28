import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import OrderItems from '@/components/OrderItems';
import Payments from '@/components/Payments';

const OrderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [orderTotal, setOrderTotal] = useState(0);

  useEffect(() => {
    fetchData();
  }, [id, session]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data: profileData } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    setUserRole(profileData?.role);

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, phone, address),
        couriers:profiles (full_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching order details:', error);
      toast.error('Gagal mengambil detail pesanan.');
      setError(error);
      setOrder(null);
    } else if (!data) {
      toast.error('Pesanan tidak ditemukan.');
      setError({ message: 'Pesanan tidak ditemukan.' });
      setOrder(null);
    } else {
      setOrder(data);
    }
    setLoading(false);
  };
  
  const handleItemsUpdated = (items) => {
    const total = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    setOrderTotal(total);
  };
  
  const handlePaymentStatusUpdated = async (status) => {
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: status })
      .eq('id', order.id);

    if (error) {
      console.error('Error updating payment status:', error);
      toast.error('Gagal memperbarui status pembayaran.');
    } else {
      setOrder({ ...order, payment_status: status });
      toast.success('Status pembayaran berhasil diperbarui.');
    }
  };

  const updateOrderStatus = async (newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id);

    if (error) {
      console.error('Error updating order status:', error);
      toast.error('Gagal memperbarui status pesanan.');
    } else {
      setOrder({ ...order, status: newStatus });
      toast.success('Status pesanan berhasil diperbarui.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-center items-center h-64 flex-col space-y-4">
          <p className="text-xl text-red-500">Error: {error.message}</p>
          <Button onClick={() => navigate('/orders')}>Kembali ke daftar pesanan</Button>
        </div>
      </div>
    );
  }

  const isEditable = userRole === 'super_admin' || userRole === 'admin';
  const isCourier = userRole === 'user' && order.courier_id === session.user.id;
  const isOwner = session.user.id === order.created_by;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Detail Pesanan #{order.id.slice(0, 8)}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ringkasan Pesanan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Pelanggan</p>
                <p className="font-medium">{order.customers?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge>{order.status}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tanggal Pengiriman</p>
                <p className="font-medium">{order.planned_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Kurir</p>
                <p className="font-medium">{order.couriers?.full_name ?? 'Belum Ditugaskan'}</p>
              </div>
            </div>
            <Separator />
            <p className="text-sm text-gray-500">Catatan</p>
            <p>{order.notes ?? 'Tidak ada catatan.'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pembayaran</CardTitle>
          </CardHeader>
          <CardContent>
            <Payments
              orderId={order.id}
              isEditable={isEditable}
              orderTotal={orderTotal}
              onPaymentStatusUpdated={handlePaymentStatusUpdated}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Item Pesanan</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderItems orderId={order.id} isEditable={isEditable} onItemsUpdated={handleItemsUpdated} />
          </CardContent>
        </Card>

        {isCourier && order.status !== 'completed' && (
          <Card>
            <CardHeader>
              <CardTitle>Aksi Kurir</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => updateOrderStatus('sent')} disabled={order.status === 'sent'}>
                Tandai sebagai Dikirim
              </Button>
              <Button onClick={() => updateOrderStatus('completed')} className="ml-2">
                Selesaikan Pesanan
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OrderDetailsPage;