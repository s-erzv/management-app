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
      <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h1 className="text-xl font-bold text-[#10182b]">
            Daftar Pesanan dari Pusat
          </h1>
          <Button onClick={() => navigate('/central-order/new')} className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90 text-sm">
            <PlusCircle className="h-4 w-4 mr-2" /> Buat Pesanan Baru
          </Button>
        </div>

        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg font-semibold text-[#10182b]">Riwayat Pesanan</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md border-t overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow className="text-xs md:text-sm">
                    <TableHead className="min-w-[100px] text-[#10182b]">No. Pesanan</TableHead>
                    <TableHead className="min-w-[120px] text-[#10182b]">Tanggal</TableHead>
                    <TableHead className="min-w-[100px] text-[#10182b]">Status</TableHead>
                    <TableHead className="min-w-[120px] text-[#10182b]">Total</TableHead>
                    <TableHead className="min-w-[120px] text-[#10182b]">Dibuat Oleh</TableHead>
                    <TableHead className="min-w-[120px] text-[#10182b]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                        Tidak ada pesanan dari pusat.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map(order => (
                      <TableRow key={order.id} className="text-xs md:text-sm">
                        <TableCell className="font-medium whitespace-nowrap">{order.id.slice(0, 8)}</TableCell>
                        <TableCell className="whitespace-nowrap">{order.order_date}</TableCell>
                        <TableCell>
                          {/* Asumsi getStatusBadge sudah menangani responsivitas Badge */}
                          {getStatusBadge(order.status)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatCurrency(order.calculated_total)}</TableCell>
                        <TableCell className="whitespace-nowrap">{order.user?.full_name ?? 'N/A'}</TableCell>
                        {/* Kolom Aksi: Menggunakan gap kecil dan tombol ikon di mobile */}
                        <TableCell className="flex items-center gap-1">
                          <Button 
                            variant="outline" 
                            size="xs" // Menggunakan ukuran ekstra kecil
                            onClick={() => navigate(`/central-order/${order.id}`)}
                            className="text-xs hidden sm:inline-flex" // Sembunyikan tombol "Detail" di mobile
                          >
                            Detail
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => navigate(`/central-order/${order.id}`)}
                            title="Detail/Edit"
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(order.id)}
                            title="Hapus"
                            className="h-8 w-8"
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