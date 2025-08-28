import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ReportsPage = () => {
  const { session } = useAuth();
  const [reportsData, setReportsData] = useState({
    sales: 0,
    ordersCount: 0,
    stock: 0,
    topCouriers: [],
  });
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);
  
  useEffect(() => {
    if (products.length > 0) {
      if (!selectedProductId) {
        setSelectedProductId(products[0].id);
      }
      fetchReports();
    }
  }, [selectedProductId, dateRange, products]);
  
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal memuat daftar produk.');
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  const fetchReports = async () => {
    setLoading(true);
    const { startDate, endDate } = dateRange;
    
    // Fetch orders and payments
    const { data: ordersAndPayments, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        payment_status,
        courier_id,
        order_items (qty, price),
        payments (amount)
      `)
      .gte('created_at', startDate || '1900-01-01')
      .lte('created_at', endDate || new Date().toISOString().split('T')[0]);
      
    // Fetch stock movements for the selected product
    const { data: movements, error: movementsError } = await supabase
      .from('stock_movements')
      .select('type, qty')
      .eq('product_id', selectedProductId)
      .gte('movement_date', startDate || '1900-01-01')
      .lte('movement_date', endDate || new Date().toISOString().split('T')[0]);
      
    if (ordersError || movementsError) {
      console.error('Error fetching reports data:', ordersError || movementsError);
      toast.error('Gagal memuat data laporan.');
    } else {
      const totalSales = ordersAndPayments.reduce((sum, order) => {
        return sum + order.payments.reduce((paySum, payment) => paySum + parseFloat(payment.amount), 0);
      }, 0);
      
      const ordersCompleted = ordersAndPayments.filter(o => o.status === 'completed').length;
      
      const totalIn = movements.filter(m => m.type === 'masuk').reduce((sum, m) => sum + m.qty, 0);
      const totalOut = movements.filter(m => m.type === 'keluar').reduce((sum, m) => sum + m.qty, 0);
      const totalReturn = movements.filter(m => m.type === 'pengembalian').reduce((sum, m) => sum + m.qty, 0);
      const currentProductStock = products.find(p => p.id === selectedProductId)?.stock || 0;

      const courierPerformance = ordersAndPayments.reduce((acc, order) => {
        if (order.courier_id) {
          acc[order.courier_id] = (acc[order.courier_id] || 0) + 1;
        }
        return acc;
      }, {});
      
      const topCouriers = Object.entries(courierPerformance)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id, count]) => ({ id, count }));

      setReportsData({
        sales: totalSales,
        ordersCount: ordersCompleted,
        stock: currentProductStock,
        topCouriers: topCouriers,
      });
    }
    setLoading(false);
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange({ ...dateRange, [name]: value });
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
      <h1 className="text-2xl font-bold mb-6">Laporan & Analisis</h1>
      
      <div className="flex gap-4 mb-6">
        <Input
          type="date"
          name="startDate"
          placeholder="Dari Tanggal"
          value={dateRange.startDate}
          onChange={handleDateChange}
        />
        <Input
          type="date"
          name="endDate"
          placeholder="Sampai Tanggal"
          value={dateRange.endDate}
          onChange={handleDateChange}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Penjualan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">Rp{reportsData.sales}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pesanan Selesai</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{reportsData.ordersCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Stok Produk</span>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Pilih Produk" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{reportsData.stock}</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">Performa Kurir</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kurir ID</TableHead>
              <TableHead>Pesanan Selesai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportsData.topCouriers.map((courier, index) => (
              <TableRow key={index}>
                <TableCell>{courier.id.slice(0, 8)}</TableCell>
                <TableCell>{courier.count}</TableCell>
              </TableRow>
            ))}
            {reportsData.topCouriers.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Tidak ada data kurir.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ReportsPage;