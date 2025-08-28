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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const OrderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  useEffect(() => {
    fetchData();
  }, [id, session]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    // Fetch user role
    const { data: profileData } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    setUserRole(profileData?.role);

    // Fetch order details
    const { data, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, phone, address),
        couriers:profiles (full_name),
        order_items (*)
      `)
      .eq('id', id)
      .single();


    if (orderError) {
      console.error('Error fetching order details:', orderError);
      toast.error('Gagal mengambil detail pesanan.');
      setError(orderError);
      setOrder(null);
    } else if (!data) {
      toast.error('Pesanan tidak ditemukan.');
      setError({ message: 'Pesanan tidak ditemukan.' });
      setOrder(null);
    } else {
      setOrder(data);
      // Fetch payments for this order
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', data.id)
        .order('created_at', { ascending: false });

      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
      } else {
        setPayments(paymentsData);
      }
    }
    setLoading(false);
  };
  
  const handleItemsUpdated = (items) => {
    if (order) {
      const updatedOrder = { ...order, order_items: items };
      setOrder(updatedOrder);
    }
  };

  const calculateTotal = (items) => {
    return items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  };
  
  const calculateTotalPaid = () => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  };
  
  const handleAddPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Jumlah pembayaran tidak valid.');
      return;
    }
    
    setLoading(true);
    
    // Ambil company_id dari objek order yang sudah di-fetch
    const orderCompanyId = order.company_id;

    // Insert new payment record
    const { data: newPayment, error: insertError } = await supabase
      .from('payments')
      .insert({
        order_id: order.id,
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        paid_at: new Date().toISOString(),
        company_id: orderCompanyId, // Baris ini ditambahkan
      })
      .select();

    if (insertError) {
      console.error('Error adding payment:', insertError);
      toast.error('Gagal menambahkan pembayaran.');
      setLoading(false);
      return;
    }
    
    // Update order payment status
    const totalPaidAfterNew = calculateTotalPaid() + parseFloat(paymentAmount);
    const orderTotal = calculateTotal(order.order_items);
    let newStatus = 'unpaid';
    if (totalPaidAfterNew >= orderTotal) {
      newStatus = 'paid';
    } else if (totalPaidAfterNew > 0) {
      newStatus = 'partial';
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: newStatus })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating payment status:', updateError);
      toast.error('Gagal memperbarui status pembayaran.');
    } else {
      toast.success('Pembayaran berhasil ditambahkan dan status diperbarui.');
      setPaymentAmount('');
      setPayments([...payments, ...newPayment]);
      setOrder({ ...order, payment_status: newStatus });
    }
    setLoading(false);
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
  
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pembayaran ini?')) return;
    setLoading(true);

    const { error: deleteError } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (deleteError) {
      console.error('Error deleting payment:', deleteError);
      toast.error('Gagal menghapus pembayaran.');
    } else {
      toast.success('Pembayaran berhasil dihapus.');
      fetchData(); // Refresh data untuk mendapatkan status pembayaran terbaru
    }
    setLoading(false);
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
  
  const orderTotal = calculateTotal(order?.order_items || []);
  const totalPaid = calculateTotalPaid();
  const remainingDue = orderTotal - totalPaid;

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
                <p className="text-sm text-gray-500">Status Pengiriman</p>
                <Badge>{order.status}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status Pembayaran</p>
                <Badge variant={
                  order.payment_status === 'paid' ? 'secondary' :
                  order.payment_status === 'unpaid' ? 'destructive' : 'default'
                }>
                  {order.payment_status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Harga</p>
                <p className="font-medium">Rp{orderTotal}</p>
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

        {isEditable && (
          <Card>
            <CardHeader>
              <CardTitle>Aksi Admin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Status Pembayaran:</p>
                <Badge 
                  variant={
                    order.payment_status === 'paid' ? 'secondary' :
                    order.payment_status === 'unpaid' ? 'destructive' : 'default'
                  }
                  className="w-fit"
                >
                  {order.payment_status}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium flex justify-between">
                  <span>Total yang sudah dibayar:</span>
                  <span className="font-bold">Rp{totalPaid}</span>
                </div>
                <div className="text-sm font-medium flex justify-between">
                  <span>Sisa tagihan:</span>
                  <span className="font-bold text-red-600">Rp{remainingDue}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-lg font-semibold">Tambah Pembayaran</h4>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="amount">Jumlah Pembayaran</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Masukkan jumlah..."
                  />
                </div>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="payment-method">Metode Pembayaran</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Tunai (Cash)</SelectItem>
                      <SelectItem value="transfer_bsi">Transfer BSI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod === 'transfer_bsi' && (
                  <div className="mt-2 p-3 rounded-md border bg-gray-50 text-sm">
                    <p className="font-semibold">Detail Transfer:</p>
                    <p>Bank: Bank Syariah Indonesia (BSI)</p>
                    <p>No. Rekening: 7177559948</p>
                    <p>A.n: M Hammam Jafar</p>
                  </div>
                )}
                <Button onClick={handleAddPayment} className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambahkan Pembayaran'}
                </Button>
              </div>
              
              <Separator />
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Bukti Pengiriman</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {order.proof_of_delivery_url ? (
                    <img
                      src={order.proof_of_delivery_url}
                      alt="Bukti Pengiriman"
                      className="w-full max-w-sm rounded-md border"
                    />
                  ) : (
                    <p className="text-sm text-gray-500">Belum ada bukti pengiriman.</p>
                  )}
                  <p>Galon Dikembalikan: {order.returned_qty}</p>
                  <p>Galon Dipinjam: {order.borrowed_qty}</p>
                  <p>Biaya Transportasi: Rp{order.transport_cost}</p>
                </CardContent>
              </Card>


              <div className="space-y-2">
                <h4 className="text-lg font-semibold">Riwayat Pembayaran</h4>
                {payments.length > 0 ? (
                  payments.map((p, index) => (
                    <div key={p.id} className="flex justify-between items-center text-sm">
                      <p>
                        Pembayaran #{payments.length - index}: Rp{p.amount} ({p.method})
                      </p>
                      <Button variant="destructive" size="sm" onClick={() => handleDeletePayment(p.id)}>Hapus</Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Belum ada pembayaran.</p>
                )}
              </div>
              
            </CardContent>
          </Card>
        )}

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