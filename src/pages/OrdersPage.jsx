// src/pages/OrdersPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
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
import { Loader2, Download, Plus, ListOrdered, Filter, TruckIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom'; 
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import AddPaymentModal from '@/components/AddPaymentModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Fungsi untuk mendapatkan badge status pengiriman yang dinamis
const getStatusBadge = (status) => {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-200 text-[#10182b] flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Menunggu</Badge>;
    case 'sent':
      return <Badge className="bg-[#10182b] text-white flex items-center gap-1"><TruckIcon className="h-3 w-3" /> Dalam Pengiriman</Badge>;
    case 'completed':
      return <Badge className="bg-green-500 text-white flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Selesai</Badge>;
    default:
      return <Badge className="bg-gray-200 text-[#10182b] capitalize">{status}</Badge>;
  }
};

// Fungsi baru untuk mendapatkan badge status pembayaran yang dinamis
const getPaymentStatusBadge = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'paid':
      return <Badge className="bg-green-500 text-white flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Lunas</Badge>;
    case 'unpaid':
      return <Badge className="bg-red-500 text-white flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Pending</Badge>;
    case 'partial':
      return <Badge className="bg-yellow-400 text-black flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Sebagian</Badge>;
    default:
      return <Badge className="bg-gray-200 text-[#10182b] capitalize">{status || 'unknown'}</Badge>;
  }
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const { userRole, companyId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [plannedDateStart, setPlannedDateStart] = useState('');
  const [plannedDateEnd, setPlannedDateEnd] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);

  const fetchOrdersAndCustomers = useCallback(async (filters = {}) => {
    setLoading(true);
    if (!companyId) return;

    let filteredOrderIds = null;
    if (filters.courier && filters.courier !== 'all') {
      const { data: matchingOrderCouriers, error: courierFilterError } = await supabase
        .from('order_couriers')
        .select('order_id')
        .eq('courier_id', filters.courier);

      if (courierFilterError) {
        console.error('Error fetching orders by courier:', courierFilterError);
        toast.error('Gagal memuat pesanan berdasarkan Petugas.');
        setLoading(false);
        return;
      }
      filteredOrderIds = matchingOrderCouriers.map(oc => oc.order_id);
    }

    let query = supabase
      .from('orders')
      .select(`
        *,
        customers (id, name, customer_status, phone, address),
        order_couriers (courier:profiles(id, full_name)),
        order_items (*, products(id, name, is_returnable)),
        payments (*)
      `)
      .order('created_at', { ascending: false })
      .eq('company_id', companyId);

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.paymentStatus && filters.paymentStatus !== 'all') {
      query = query.eq('payment_status', filters.paymentStatus);
    }

    if (filters.customer && filters.customer !== 'all') {
      query = query.eq('customer_id', filters.customer);
    }
    
    if (filters.plannedDateStart) {
        query = query.gte('planned_date', filters.plannedDateStart);
    }
    if (filters.plannedDateEnd) {
        query = query.lte('planned_date', filters.plannedDateEnd);
    }
    
    if (filteredOrderIds !== null) {
        if (filteredOrderIds.length === 0) {
            setOrders([]);
            setLoading(false);
            return;
        }
        query = query.in('id', filteredOrderIds);
    }

    const { data: ordersData, error: ordersError } = await query;
    const { data: customersData } = await supabase.from('customers').select('id, name, customer_status').eq('company_id', companyId);
    const { data: couriersData } = await supabase.from('profiles').select('id, full_name').eq('role', 'user').eq('company_id', companyId);

    if (ordersError) {
      console.error('Error fetching data:', ordersError);
      toast.error('Gagal mengambil data pesanan.');
    } else {
      setOrders(ordersData);
      setCustomers(customersData);
      setCouriers(couriersData);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if(companyId) {
        fetchOrdersAndCustomers();
    }
  }, [companyId, fetchOrdersAndCustomers]);
  
  const handlePaymentAdded = () => {
    // Refresh order data after payment
    fetchOrdersAndCustomers({ 
      status: statusFilter,
      paymentStatus: paymentStatusFilter,
      courier: courierFilter,
      customer: customerFilter,
      plannedDateStart: plannedDateStart,
      plannedDateEnd: plannedDateEnd,
    });
  };

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
        setOrders(orders.filter(order => order.id !== orderId));
    } catch (error) {
        console.error('Error deleting order:', error);
        toast.error('Gagal menghapus pesanan: ' + error.message);
    } finally {
        setLoading(false);
    }
  };

  const calculateTotal = (items) => {
    return items?.reduce((total, item) => total + (item.qty * item.price), 0) || 0;
  };
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };
  

  const handleExportToExcel = () => {
    const header = [
      "ID Pesanan", "Nomor Invoice", "Nama Pelanggan", "Alamat Pelanggan", "Telepon Pelanggan",
      "Tanggal Order", "Status Pengiriman", "Status Pembayaran", "Nama Petugas",
      "Total Harga", "Pembayaran Diterima", "Sisa Tagihan", "Galon Dikembalikan", 
      "Galon Dipinjam", "Kemasan Returnable Dibeli", "Biaya Transportasi", "Detail Produk", 
      "Bukti Pengiriman", "Riwayat Pembayaran"
    ];
    
    const csvRows = orders.map(order => {
      const totalPaid = order.payments ? order.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
      const totalOrderPrice = calculateTotal(order.order_items);
      const remainingDue = totalOrderPrice - totalPaid;

      const productsList = order.order_items
        .map(item => `${item.products.name} (${item.qty} x Rp${item.price})`)
        .join('; ');

      const couriersList = order.order_couriers
        .map(c => c.courier.full_name)
        .join(', ');
        
      const paymentsHistory = order.payments
        .map(p => `Rp${p.amount} (${p.method}, diterima oleh: ${p.received_by ?? 'N/A'})`)
        .join('; ');

      return [
        `"${order.id}"`,
        order.invoice_number,
        `"${order.customers?.name ?? 'N/A'}"`,
        `"${order.customers?.address ?? 'N/A'}"`,
        `"${order.customers?.phone ?? 'N/A'}"`,
        order.planned_date,
        order.status,
        order.payment_status,
        `"${couriersList || 'N/A'}"`,
        totalOrderPrice,
        totalPaid,
        remainingDue,
        order.returned_qty,
        order.borrowed_qty,
        order.purchased_empty_qty,
        order.transport_cost,
        `"${productsList}"`,
        order.proof_of_delivery_url,
        `"${paymentsHistory}"`
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + header.join(',') + "\n" + csvRows.join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "orders_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Data berhasil diekspor!');
  };

  const applyFilters = () => {
    fetchOrdersAndCustomers({
      status: statusFilter,
      paymentStatus: paymentStatusFilter,
      courier: courierFilter,
      customer: customerFilter,
      plannedDateStart: plannedDateStart,
      plannedDateEnd: plannedDateEnd,
    });
    setIsFilterModalOpen(false);
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setPaymentStatusFilter('all');
    setCourierFilter('all');
    setCustomerFilter('all');
    setPlannedDateStart('');
    setPlannedDateEnd('');
    fetchOrdersAndCustomers();
    setIsFilterModalOpen(false);
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
          <ListOrdered className="h-8 w-8" />
          Manajemen Pesanan
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setIsFilterModalOpen(true)} variant="outline" className="w-full sm:w-auto text-[#10182b] hover:bg-gray-100">
            <Filter className="h-4 w-4 mr-2" /> Filter
          </Button>
          {['admin', 'user'].includes(userRole) && (
            <Button onClick={() => navigate('/orders/add')} className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#20283b]">
              <Plus className="h-4 w-4 mr-2" /> Tambah Pesanan
            </Button>
          )}
          <Button onClick={handleExportToExcel} className="flex items-center gap-2 w-full sm:w-auto text-[#10182b] hover:bg-gray-100" variant="outline">
              <Download className="h-4 w-4" /> Export ke Excel
          </Button>
        </div>
      </div>
      
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="p-6">
          <CardTitle className="text-lg font-semibold text-[#10182b]">
            Daftar Pesanan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border-t overflow-x-auto">
            <Table className="table-auto min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#10182b]">No. Invoice</TableHead>
                  <TableHead className="min-w-[150px] text-[#10182b]">Pelanggan</TableHead>
                  <TableHead className="min-w-[150px] text-[#10182b]">Tgl. Pengiriman</TableHead>
                  <TableHead className="min-w-[200px] text-[#10182b]">Produk</TableHead>
                  <TableHead className="min-w-[150px] text-[#10182b]">Status Pengiriman</TableHead>
                  <TableHead className="min-w-[150px] text-[#10182b]">Status Pembayaran</TableHead>
                  <TableHead className="min-w-[150px] text-[#10182b]">Total Harga</TableHead>
                  <TableHead className="min-w-[150px] text-[#10182b]">Petugas</TableHead>
                  <TableHead className="min-w-[250px] text-[#10182b]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#10182b]" />
                    </TableCell>
                  </TableRow>
                ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium whitespace-nowrap">{order.invoice_number}</TableCell>
                    <TableCell className="whitespace-nowrap">{order.customers?.name ?? 'N/A'}</TableCell>
                    <TableCell className="whitespace-nowrap">{order.planned_date}</TableCell>
                    <TableCell>
                      <div className="grid">
                        {order.order_items.map(item => (
                          <Badge key={item.id} variant="secondary" className="text-[#10182b]">
                            <ol>
                              <li>{item.products.name} ({item.qty})</li>
                            </ol>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell>
                      {getPaymentStatusBadge(order.payment_status)}
                    </TableCell>
                   <TableCell>
                    {formatCurrency(order.grand_total || 0)}
                  </TableCell>
                    <TableCell>
                        {order.order_couriers && order.order_couriers.length > 0 ? (
                            <div className="flex flex-col space-y-1">
                                {order.order_couriers.map((c, index) => (
                                    <span key={index}>{c.courier?.full_name ?? 'Petugas tidak ditemukan'}</span>
                                ))}
                            </div>
                        ) : 'Belum Ditugaskan'}
                    </TableCell>
                    <TableCell className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${order.id}`)} className="text-[#10182b] hover:bg-gray-100">Detail</Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/orders/edit/${order.id}`)} className="text-[#10182b] hover:bg-gray-100">Edit</Button>
                      {(order.status === 'sent' || (order.status === 'completed' && order.payment_status !== 'paid')) && (
                         <Button onClick={() => { setSelectedOrderForPayment(order); setIsPaymentModalOpen(true); }} size="sm" className="bg-green-500 hover:bg-green-600 text-white">
                          Tambah Pembayaran
                        </Button>
                      )}
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(order.id)} className="bg-red-500 hover:bg-red-600 text-white">Hapus</Button>
                    </TableCell>
                  </TableRow>
                )))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Tidak ada data pesanan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
       <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        order={selectedOrderForPayment}
        onPaymentAdded={handlePaymentAdded}
      />
      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter Pesanan</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="statusFilter">Status Pengiriman</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua Status Pengiriman" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status Pengiriman</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Dikirim</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentStatusFilter">Status Pembayaran</Label>
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger className="w-full">
                      <SelectValue placeholder="Semua Status Pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">Semua Status Pembayaran</SelectItem>
                      <SelectItem value="paid">Lunas</SelectItem>
                      <SelectItem value="partial">Sebagian</SelectItem>
                      <SelectItem value="unpaid">Pending</SelectItem>
                  </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="courierFilter">Petugas</Label>
              <Select value={courierFilter} onValueChange={setCourierFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua Petugas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Petugas</SelectItem>
                  {couriers.map(courier => (
                    <SelectItem key={courier.id} value={courier.id}>{courier.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerFilter">Pelanggan</Label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua Pelanggan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pelanggan</SelectItem>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plannedDateStart">Dari Tanggal</Label>
                <Input
                  id="plannedDateStart"
                  type="date"
                  value={plannedDateStart}
                  onChange={(e) => setPlannedDateStart(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plannedDateEnd">Sampai Tanggal</Label>
                <Input
                  id="plannedDateEnd"
                  type="date"
                  value={plannedDateEnd}
                  onChange={(e) => setPlannedDateEnd(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetFilters} className="w-full">Reset</Button>
            <Button onClick={applyFilters} className="w-full">Terapkan Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersPage;