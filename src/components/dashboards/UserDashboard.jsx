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
  Box,
  Pencil, 
  Trash2, 
  Plus,
  Search, // Ditambahkan
  Info // Ditambahkan
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import AddPaymentModal from '@/components/AddPaymentModal';
import { Input } from '@/components/ui/input'; // Ditambahkan
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'; // Ditambahkan


const UserDashboard = ({ userId }) => {
  const navigate = useNavigate();
  const { session, userRole, companyId } = useAuth();
  const currentUserId = session?.user?.id;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  
  // --- States Baru untuk Filter ---
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  // ---------------------------------

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

  const handleDeleteClick = async (orderId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pesanan ini?')) return;
    setLoading(true);
    
    try {
        const { data, error } = await supabase.functions.invoke('delete-order', {
            method: 'DELETE',
            body: { orderId: orderId, companyId: companyId },
        });

        if (error) {
            throw error;
        }

        if (data.error) {
            throw new Error(data.error);
        }

        toast.success('Pesanan berhasil dihapus.');
        fetchData(userId);
    } catch (error) {
        console.error('Error deleting order:', error);
        toast.error('Gagal menghapus pesanan: ' + error.message);
    } finally {
        setLoading(false);
    }
  };

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
          // Stok sudah pernah dicatat, lewati langkah ini.
          console.log(`Stok untuk pesanan ${order.id} sudah pernah dicatat, lewati langkah update.`);
        } else {
          // Belum ada pergerakan stok keluar, lakukan pengurangan stok dan catat pergerakan.
          for (const item of soldItems) {
            // Ambil stok produk saat ini
            const { data: productData, error: productFetchError } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.product_id)
                .single();

            if (productFetchError) {
                throw productFetchError;
            }

            const currentStock = productData.stock;
            const newStock = currentStock - item.qty;

            // Perbarui stok produk
            const { error: stockUpdateError } = await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', item.product_id);

            if (stockUpdateError) {
                throw stockUpdateError;
            }

            // Catat pergerakan stok
            const { error: insertError } = await supabase
                .from('stock_movements')
                .insert({
                  type: 'keluar',
                  qty: item.qty,
                  notes: `Kemasan Returnable keluar untuk pesanan #${order.id.slice(0, 8)} (dibeli)`,
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

      // Perbarui status pesanan utama setelah semua operasi selesai
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
    } catch (e) {
      console.error('Error in updateOrderStatus:', e);
      toast.error('Terjadi kesalahan saat memperbarui pesanan: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleNavigateToCompletionPage = (orderId) => {
    navigate(`/complete-delivery/${orderId}`);
  };

  const handlePaymentAdded = () => {
    fetchData(userId);
  };

  // --- Filter Logic ---
  const filteredTasks = tasks.filter(task => {
    // Filter by Name/ID
    const matchesSearch = task.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          String(task.id).slice(0, 8).includes(searchQuery);

    // Filter by Delivery Status
    const matchesDeliveryStatus = deliveryFilter === 'all' || task.status === deliveryFilter;

    // Filter by Payment Status (using derived status based on remaining_due)
    const derivedPaymentStatus = task.remaining_due <= 0.0001 ? 'paid' : (task.total_paid > 0 ? 'partial' : 'unpaid');
    const matchesPaymentStatus = paymentFilter === 'all' || derivedPaymentStatus === paymentFilter;

    return matchesSearch && matchesDeliveryStatus && matchesPaymentStatus;
  });

  const incompleteTasks = filteredTasks.filter(task => 
    task.status !== 'completed' || task.remaining_due > 0.0001
  );
  const completedTasks = filteredTasks.filter(task => 
    task.status === 'completed' && task.remaining_due <= 0.0001
  );
  // --------------------
  
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
  
  const handleCardClick = (orderId) => {
    navigate(`/orders/${orderId}`);
  };

  const TaskCard = ({ task, isCompleted = false }) => (
    <Card 
      className={`border-0 shadow-sm transition-all hover:shadow-lg ${isCompleted ? 'opacity-75' : 'cursor-pointer hover:border-[#10182b] border-2'}`}
      onClick={() => handleCardClick(task.id)}
    >
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
        
        {/* Catatan Pesanan (Ditambahkan) */}
        {task.notes && (
          <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2 text-[#10182b]">
                  <Info className="h-4 w-4" />
                  Catatan
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700 italic">{task.notes}</p>
              </div>
          </div>
        )}

        {/* Order Items */}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2 text-[#10182b]">
            <PackageCheck className="h-4 w-4" />
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
          <div className="pt-2 flex flex-wrap gap-2">
            
            {/* Tombol Edit */}
            {(task.status === 'draft' || task.status === 'sent') && (
              <Button 
                onClick={(e) => { e.stopPropagation(); navigate(`/orders/edit/${task.id}`); }}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}

            {/* Tombol Hapus */}
            {(task.status === 'draft' || task.status === 'sent') && (
              <Button 
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(task.id); }}
                disabled={loading}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4" /> Hapus
              </Button>
            )}
            
            {/* Primary Action Button (Start Delivery) */}
            {task.status === 'draft' && (
              <Button 
                onClick={(e) => { e.stopPropagation(); updateOrderStatus(task, 'sent'); }} 
                className="w-full bg-[#10182b] text-white hover:bg-[#20283b]"
                disabled={loading}
              >
                <TruckIcon className="mr-2 h-4 w-4" /> Mulai Pengiriman
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}

            {/* Primary Action Button (Complete Order) */}
            {task.status === 'sent' && (
              <Button 
                onClick={(e) => { e.stopPropagation(); handleNavigateToCompletionPage(task.id); }}
                disabled={loading}
                className="w-full bg-[#10182b] text-white hover:bg-[#20283b]"
                variant="default"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Selesaikan Pesanan
              </Button>
            )}

            {/* Tambah Pembayaran Button (Visible if remaining due > 0) */}
            {task.remaining_due > 0.0001 && (
              <Button
                onClick={(e) => { e.stopPropagation(); setSelectedOrderForPayment(task); setIsPaymentModalOpen(true); }}
                disabled={loading}
                className="w-full bg-green-500 text-white hover:bg-green-600"
                variant="default"
              >
                <Banknote className="mr-2 h-4 w-4" /> Tambah Pembayaran
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
          Dashboard Petugas
        </h1>
        {/* Tombol Tambah Pesanan */}
        <Button onClick={() => navigate('/orders/add')} className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#20283b]">
            <Plus className="h-4 w-4 mr-2" /> Tambah Pesanan
        </Button>
      </div>

      {/* --- Filter Section (Ditambahkan) --- */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Cari nama pelanggan / ID pesanan"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 w-full"
          />
        </div>

        {/* Delivery Status Filter */}
        <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Status Pengiriman" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Pengiriman</SelectItem>
            <SelectItem value="draft">Menunggu (Draft)</SelectItem>
            <SelectItem value="sent">Dikirim (Sent)</SelectItem>
            <SelectItem value="completed">Selesai (Completed)</SelectItem>
          </SelectContent>
        </Select>

        {/* Payment Status Filter */}
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Status Pembayaran" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Pembayaran</SelectItem>
            <SelectItem value="paid">Lunas</SelectItem>
            <SelectItem value="partial">Sebagian</SelectItem>
            <SelectItem value="unpaid">Belum Bayar</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* ------------------------------------ */}

      {/* Stats Cards */}
      {/* Bagian ini hanya ditampilkan jika user adalah Petugas yang sedang login */}
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
      <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        order={selectedOrderForPayment}
        onPaymentAdded={handlePaymentAdded}
      />
    </div>
  );
};

export default UserDashboard;