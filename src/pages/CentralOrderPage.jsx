import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'react-hot-toast';
import { Loader2, PlusCircle, Clock, TruckIcon, PackageCheck, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const getStatusBadge = (status) => {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-200 text-[#10182b] flex items-center gap-1"><Clock className="h-3 w-3" /> Draft</Badge>;
    case 'paid':
      return <Badge className="bg-blue-500 text-white flex items-center gap-1"><TruckIcon className="h-3 w-3" /> Dibayar</Badge>;
    case 'received':
      return <Badge className="bg-green-500 text-white flex items-center gap-1"><PackageCheck className="h-3 w-3" /> Diterima</Badge>;
    default:
      return <Badge className="bg-gray-200 text-[#10182b] flex items-center gap-1">Tidak Dikenal</Badge>;
  }
};

const CentralOrderPage = () => {
  const { userProfile, loading: authLoading, companyId, session } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && companyId) {
      fetchCentralOrders();
    }
  }, [authLoading, companyId]);
  
  const fetchCentralOrders = async () => {
    setLoading(true);
    if (!companyId) return;

    const { data, error } = await supabase
      .from('central_orders')
      .select(`
        *,
        user:user_id(full_name),
        items:central_order_items(qty, price)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching central orders:', error);
      toast.error('Gagal memuat daftar pesanan pusat.');
    } else {
      const ordersWithTotals = data.map(order => {
        const total = order.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
        return { ...order, calculated_total: total };
      });
      setOrders(ordersWithTotals);
    }
    setLoading(false);
  };
  
  const handleDelete = async (orderId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pesanan pusat ini? Stok produk yang sudah diterima akan dikembalikan.')) return;
    setLoading(true);
    
    try {
        const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/manage-central-order-galons', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ orderId, companyId }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Gagal menghapus pesanan.');
        }

        toast.success('Pesanan berhasil dihapus dan stok dikembalikan!');
        fetchCentralOrders();
    } catch (error) {
        console.error('Error deleting central order:', error);
        toast.error('Gagal menghapus pesanan: ' + error.message);
    } finally {
        setLoading(false);
    }
  };
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Daftar Pesanan dari Pusat</h1>
        <Button onClick={() => navigate('/central-order/new')} className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90">
          <PlusCircle className="h-4 w-4 mr-2" /> Buat Pesanan Baru
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pesanan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Nomor Pesanan</TableHead>
                  <TableHead className="min-w-[150px]">Tanggal Pesan</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[150px]">Total Transaksi</TableHead>
                  <TableHead className="min-w-[150px]">Dibuat Oleh</TableHead>
                  <TableHead className="min-w-[100px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Tidak ada pesanan dari pusat.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell>{order.id.slice(0, 8)}</TableCell>
                      <TableCell>{order.order_date}</TableCell>
                      <TableCell>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell>{formatCurrency(order.calculated_total)}</TableCell>
                      <TableCell>{order.user?.full_name ?? 'N/A'}</TableCell>
                      <TableCell className="flex flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => navigate(`/central-order/${order.id}`)}
                        >
                          Detail
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => navigate(`/central-order/${order.id}`)}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(order.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CentralOrderPage;