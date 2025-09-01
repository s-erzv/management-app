// src/components/dashboards/UserDashboard.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
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
  CreditCard,
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

const UserDashboard = ({ profile, data }) => { // Ganti nama komponen menjadi UserDashboard dan terima props
  const { session } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    fetchData();
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    if (session) {
      const { data: tasksData, error: tasksError } = await supabase
        .from('orders')
        .select(`
          *,
          customers (name, address, phone),
          order_items (product_id, qty, price, item_type, products(name, is_returnable, company_id))
        `)
        .eq('courier_id', session.user.id)
        .order('planned_date', { ascending: true });

      if (tasksError) {
        console.error('Error fetching data:', tasksError);
        toast.error('Gagal memuat data tugas.');
      } else {
        const tasksWithTotals = tasksData.map(order => {
          const total = order.order_items.reduce((sum, item) => sum + (item.qty * item.price), 0);
          return { ...order, total };
        });
        
        const orderIds = tasksWithTotals.map(t => t.id);
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('order_id, amount')
          .in('order_id', orderIds);
          
        if (paymentsError) {
          console.error('Error fetching payments:', paymentsError);
        } else {
          const paymentsByOrderId = paymentsData.reduce((acc, curr) => {
            acc[curr.order_id] = (acc[curr.order_id] || 0) + curr.amount;
            return acc;
          }, {});

          const finalTasks = tasksWithTotals.map(task => ({
            ...task,
            total_paid: paymentsByOrderId[task.id] || 0,
            remaining_due: task.total - (paymentsByOrderId[task.id] || 0)
          }));
          setTasks(finalTasks);
        }
      }
    }
    setLoading(false);
  };
  
  const updateOrderStatus = async (order, newStatus) => {
    if (order.status === 'completed') {
      toast.error('Pesanan sudah selesai dan tidak bisa diperbarui lagi.');
      return;
    }
    setLoading(true);
    
    if (newStatus === 'sent') {
      const soldItems = order.order_items.filter(item => item.item_type === 'beli');
      if (soldItems.length > 0) {
        for (const item of soldItems) {
          const company_id = item.products.company_id;
          const { error } = await supabase
            .from('stock_movements')
            .insert({
              type: 'keluar',
              qty: item.qty,
              notes: `Galon keluar untuk pesanan #${order.id.slice(0, 8)} (dibeli)`,
              order_id: order.id,
              user_id: session.user.id,
              product_id: item.product_id,
              company_id: company_id
            });
          if (error) {
            console.error('Error recording stock movement:', error);
            toast.error('Gagal mencatat pergerakan stok.');
            setLoading(false);
            return;
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
      fetchData();
    }
    setLoading(false);
  };
  
  // PERBAIKAN: Ubah rute navigasi
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
    return sum + task.order_items.reduce((itemSum, item) => itemSum + item.qty, 0);
  }, 0);

  const getStatusBadge = (status) => {
    const statusConfig = {
      'draft': { variant: 'secondary', label: 'Menunggu', icon: Clock },
      'sent': { variant: 'default', label: 'Dikirim', icon: TruckIcon },
      'completed': { variant: 'success', label: 'Selesai', icon: CheckCircle2 }
    };
    
    const config = statusConfig[status] || statusConfig['draft'];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (remainingDue, totalPaid, total) => {
    if (remainingDue <= 0) {
      return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />Lunas</Badge>;
    } else if (totalPaid > 0) {
      return <Badge variant="warning" className="gap-1"><AlertCircle className="h-3 w-3" />Sebagian</Badge>;
    } else {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Belum Bayar</Badge>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const TaskCard = ({ task, isCompleted = false }) => (
    <Card className={`transition-all hover:shadow-lg ${isCompleted ? 'opacity-75' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Pesanan #{task.id.slice(0, 8)}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              {formatDate(task.planned_date)}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {getStatusBadge(task.status)}
            {getPaymentStatusBadge(task.remaining_due, task.total_paid, task.total)}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Customer Info */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">{task.customers?.name}</p>
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
          <p className="text-sm font-medium flex items-center gap-2">
            <PackageCheck className="h-4 w-4" />
            Detail Pesanan
          </p>
          <div className="bg-background border rounded-lg p-3 space-y-1">
            {task.order_items?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  {item.products?.name || 'Produk'} ({item.item_type})
                </span>
                <span className="font-medium">
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
            <span className="font-semibold">{formatCurrency(task.total)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sudah Dibayar</span>
            <span className="text-green-600 font-medium">{formatCurrency(task.total_paid)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1">
              <Banknote className="h-4 w-4" />
              Sisa Tagihan
            </span>
            <span className={`font-bold text-lg ${task.remaining_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(task.remaining_due)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {!isCompleted && (
          <div className="pt-2">
            {task.status === 'draft' && (
              <Button 
                onClick={() => updateOrderStatus(task, 'sent')} 
                className="w-full"
                disabled={loading}
              >
                <TruckIcon className="mr-2 h-4 w-4" />
                Mulai Pengiriman
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {task.status === 'sent' && (
              <Button 
                onClick={() => handleNavigateToCompletionPage(task.id)} // Menggunakan fungsi navigasi
                disabled={loading}
                className="w-full"
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
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <TruckIcon className="h-8 w-8 text-primary" />
          Dashboard Kurir
        </h1>
        <p className="text-muted-foreground">Kelola pengiriman dan pesanan Anda</p>
      </div>

      {/* Stats Cards */}
      {!loading && incompleteTasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tugas Hari Ini</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                {todayTasks.length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Aktif</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Clock className="h-6 w-6 text-orange-500" />
                {incompleteTasks.length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Barang Perlu Dikirim</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Box className="h-6 w-6 text-gray-700" />
                {totalItemsToDeliver}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <Card className="p-12">
          <div className="flex flex-col justify-center items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Memuat data pengiriman...</p>
          </div>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="active" className="gap-2">
              <Clock className="h-4 w-4" />
              Tugas Aktif ({incompleteTasks.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
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
              <Card className="p-12">
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <Package className="h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Tidak Ada Tugas Aktif</h3>
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
              <Card className="p-12">
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <History className="h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Belum Ada Riwayat</h3>
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