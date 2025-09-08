// src/components/dashboards/UserDashboard.jsx
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Package, 
  MapPin, 
  Calendar,
  CheckCircle2,
  Clock,
  TruckIcon,
  AlertCircle,
  User,
  Phone,
  ArrowRight,
  History,
  PackageCheck,
  Banknote,
  Box
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

const UserDashboard = ({ userId }) => {
  const navigate = useNavigate();
  const { session, userRole } = useAuth();
  const currentUserId = session?.user?.id;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  const fetchData = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          customers (name, address, phone),
          order_items (product_id, qty, price, item_type, products(name, is_returnable, company_id)),
          payments (amount),
          order_couriers(courier_id)
        `)
        .order('created_at', { ascending: false });
        
      if (ordersError) {
        throw ordersError;
      }
      
      const courierTasks = ordersData.filter(order => 
        order.order_couriers.some(oc => oc.courier_id === id)
      );

      const finalTasks = courierTasks.map(task => {
        // PERBAIKAN LOGIKA: Hitung ulang total pesanan dari order_items jika grand_total tidak valid
        const calculatedTotal = (task.order_items || []).reduce((sum, item) => sum + (item.qty * item.price), 0);
        const total = (task.grand_total > 0) ? task.grand_total : calculatedTotal;
        
        const totalPaid = (task.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
        
        return { 
          ...task,
          total,
          total_paid: totalPaid,
          remaining_due: total - totalPaid,
        };
      });
      
      setTasks(finalTasks);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data tugas.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchData(userId);
    }
  }, [userId, fetchData]);

  const updateOrderStatus = async (order, newStatus) => {
    if (order.status === 'completed') {
      toast.error('Pesanan sudah selesai dan tidak bisa diperbarui lagi.');
      return;
    }
    setLoading(true);
    
    try {
      if (newStatus === 'sent') {
        const soldItems = (order.order_items || []).filter((item) => item.item_type === 'beli');
 
        const { data: existingMoves, error: existingErr } = await supabase
          .from('stock_movements')
          .select('id')
          .eq('order_id', order.id)
          .eq('type', 'keluar');

        if (existingErr) {
          toast.error('Gagal mengecek pergerakan stok.');
          setLoading(false);
          return;
        }

        if (existingMoves && existingMoves.length > 0) {
          // Sudah ada pergerakan stok keluar → jangan insert lagi
          console.log(`Stok untuk order ${order.id} sudah pernah dicatat, skip insert.`);
        } else {
          // Belum ada → lakukan insert stok keluar
          for (const item of soldItems) {
            const { error: insertError } = await supabase
              .from('stock_movements')
              .insert({
                type: 'keluar',
                qty: item.qty,
                notes: `Galon keluar untuk pesanan #${order.id.slice(0, 8)} (dibeli)`,
                order_id: order.id,
                user_id: userId,
                product_id: item.product_id,
                company_id: item.products.company_id,
              });

            if (insertError) {
              throw insertError;
            }
          }
        }
      }


      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) {
        console.error('Error updating status:', error);
        toast.error('Gagal memperbarui status.');
      } else {
        toast.success('Status berhasil diperbarui!');
        fetchData(userId);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleNavigateToCompletionPage = (orderId) => {
    navigate(`/complete-delivery/${orderId}`);
  };

  const incompleteTasks = tasks.filter(task => task.status !== 'completed');
  const completedTasks = tasks.filter(task => task.status === 'completed');
  
  const todayTasks = incompleteTasks.filter(task => {
    const taskDate = new Date(task.planned_date);
    const today = new Date();
    return taskDate.toDateString() === today.toDateString();
  });
  
  const totalItemsToDeliver = incompleteTasks.reduce((sum, task) => {
    return sum + (task.order_items || []).reduce((itemSum, item) => itemSum + item.qty, 0);
  }, 0);

  const getStatusBadge = (status) => {
    const statusConfig = {
      'draft': { variant: 'secondary', label: 'Menunggu', icon: Clock, className: 'bg-gray-200 text-[#10182b]' },
      'sent': { variant: 'default', label: 'Dikirim', icon: TruckIcon, className: 'bg-[#10182b] text-white' },
      'completed': { variant: 'success', label: 'Selesai', icon: CheckCircle2, className: 'bg-green-500 text-white' }
    };
    
    const config = statusConfig[status] || statusConfig['draft'];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (remainingDue, totalPaid) => {
    if (remainingDue <= 0.0001) {
      return <Badge variant="success" className="gap-1 bg-green-500 text-white"><CheckCircle2 className="h-3 w-3" />Lunas</Badge>;
    } else if (totalPaid > 0) {
      return <Badge variant="warning" className="gap-1 bg-yellow-400 text-black"><AlertCircle className="h-3 w-3" />Sebagian</Badge>;
    } else {
      return <Badge variant="destructive" className="gap-1 bg-red-500 text-white"><AlertCircle className="h-3 w-3" />Belum Bayar</Badge>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount ?? 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const TaskCard = ({ task, isCompleted = false }) => (
    <Card className={`border-0 shadow-sm transition-all hover:shadow-lg ${isCompleted ? 'opacity-75' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2 text-[#10182b]">
              <Package className="h-4 w-4 text-[#10182b]" />
              Pesanan #{String(task.id).slice(0, 8)}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{formatDate(task.planned_date)}</span>
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {getStatusBadge(task.status)}
            {getPaymentStatusBadge(task.remaining_due, task.total_paid)}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Customer Info */}
        <div className="bg-gray-100 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm text-[#10182b]">{task.customers?.name}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">{task.customers?.address}</p>
          </div>
          {task.customers?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{task.customers?.phone}</p>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2 text-[#10182b]">
            <PackageCheck className="h-4 w-4 text-[#10182b]" />
            Detail Pesanan
          </p>
          <div className="bg-white border rounded-lg p-3 space-y-1">
            {(task.order_items || []).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  {item.products?.name || 'Produk'} ({item.item_type})
                </span>
                <span className="font-medium text-[#10182b]">
                  {item.qty} x {formatCurrency(item.price)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Payment Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Pesanan</span>
            <span className="font-semibold text-[#10182b]">{formatCurrency(task.total)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sudah Dibayar</span>
            <span className="text-green-600 font-medium">{formatCurrency(task.total_paid)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1 text-[#10182b]">
              <Banknote className="h-4 w-4" />
              Sisa Tagihan
            </span>
            <span className={`font-bold text-lg ${task.remaining_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(task.remaining_due)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {(userId === currentUserId || userRole === 'admin') && !isCompleted && (
          <div className="pt-2">
            {task.status === 'draft' && (
              <Button 
                onClick={() => updateOrderStatus(task, 'sent')} 
                className="w-full bg-[#10182b] text-white hover:bg-[#20283b]"
                disabled={loading}
              >
                <TruckIcon className="mr-2 h-4 w-4" />
                Mulai Pengiriman
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {task.status === 'sent' && (
              <Button 
                onClick={() => handleNavigateToCompletionPage(task.id)}
                disabled={loading}
                className="w-full bg-[#10182b] text-white hover:bg-[#20283b]"
                variant="default"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Selesaikan Pesanan
              </Button>
            )}
          </div>
        )}

        {/* Completed Info */}
        {isCompleted && task.delivered_at && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Diselesaikan pada {formatDate(task.delivered_at)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
          <TruckIcon className="h-8 w-8" />
          Dashboard Kurir
        </h1>
        <p className="text-muted-foreground">Kelola pengiriman dan pesanan Anda</p>
      </div>

      {/* Stats Cards */}
      {/* Bagian ini hanya ditampilkan jika user adalah kurir yang sedang login */}
      {currentUserId && userId === currentUserId && !loading && incompleteTasks.length > 0 && (
        // === BAGIAN YANG DIUBAH UNTUK TAMPILAN MOBILE ===
        <div className="flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-x-hidden md:pb-0 mb-6">
          <Card className="border-0 shadow-sm bg-white min-w-[180px] md:min-w-0">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">Tugas Hari Ini</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-[#10182b] flex items-center gap-2">
                <Package className="h-5 w-5 md:h-6 md:w-6 text-[#10182b]" />
                {todayTasks.length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-white min-w-[180px] md:min-w-0">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">Total Aktif</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-[#10182b] flex items-center gap-2">
                <Clock className="h-5 w-5 md:h-6 md:w-6 text-[#10182b]" />
                {incompleteTasks.length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-white min-w-[180px] md:min-w-0">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">Barang Perlu Dikirim</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-[#10182b] flex items-center gap-2">
                <Box className="h-5 w-5 md:h-6 md:w-6 text-[#10182b]" />
                {totalItemsToDeliver}
              </div>
            </CardContent>
          </Card>
        </div>
        // ===============================================
      )}

      {loading ? (
        <Card className="p-12 border-0 shadow-sm bg-white">
          <div className="flex flex-col justify-center items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-[#10182b]" />
            <p className="text-muted-foreground">Memuat data pengiriman...</p>
          </div>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-gray-100 text-[#10182b]">
            <TabsTrigger value="active" className="gap-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white data-[state=active]:shadow-sm">
              <Clock className="h-4 w-4" />
              Tugas Aktif ({incompleteTasks.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white data-[state=active]:shadow-sm">
              <History className="h-4 w-4" />
              Riwayat ({completedTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {incompleteTasks.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {incompleteTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <Card className="p-12 border-0 shadow-sm bg-white">
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <Package className="h-12 w-12 text-[#10182b]" />
                  <h3 className="text-lg font-semibold text-[#10182b]">Tidak Ada Tugas Aktif</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Semua pengiriman telah diselesaikan. Silakan cek kembali nanti untuk tugas baru.
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {completedTasks.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {completedTasks.map(task => (
                  <TaskCard key={task.id} task={task} isCompleted />
                ))}
              </div>
            ) : (
              <Card className="p-12 border-0 shadow-sm bg-white">
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <History className="h-12 w-12 text-[#10182b]" />
                  <h3 className="text-lg font-semibold text-[#10182b]">Belum Ada Riwayat</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Riwayat pengiriman yang telah diselesaikan akan muncul di sini.
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default UserDashboard;