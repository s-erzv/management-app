// src/pages/OrdersPage.jsx
import { useEffect, useState } from 'react';
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
import { Loader2, Download, Plus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom'; 
import { Separator } from '@/components/ui/separator';

const getStatusVariant = (status) => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'sent':
      return 'secondary';
    case 'draft':
      return 'outline';
    default:
      return 'outline';
  }
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const { session, userRole, companyId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]); // Tambahkan state untuk produk
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  
  // Perbarui state untuk form edit
  const [editForm, setEditForm] = useState({ customer_id: '', planned_date: '', notes: '' });
  const [editItems, setEditItems] = useState([]); // State untuk item yang diedit
  const [newEditItem, setNewEditItem] = useState({ product_id: '', qty: 0, price: 0 }); // State untuk item baru
  const [isEditLoading, setIsEditLoading] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [courierFilter, setCourierFilter] = useState('');
  const [invoiceNumberStart, setInvoiceNumberStart] = useState('');
  const [invoiceNumberEnd, setInvoiceNumberEnd] = useState('');

  const fetchOrdersAndCustomers = async (filters = {}) => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select(`
        *,
        customers (id, name, customer_status, phone, address),
        couriers:profiles (id, full_name),
        order_items (*, products(id, name, is_returnable)),
        payments (*)
      `)
      .order('created_at', { ascending: false })
      .eq('company_id', companyId);

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.courier && filters.courier !== 'all') {
      query = query.eq('courier_id', filters.courier);
    }
    if (filters.invoiceStart) {
      query = query.gte('invoice_number', filters.invoiceStart);
    }
    if (filters.invoiceEnd) {
      query = query.lte('invoice_number', filters.invoiceEnd);
    }

    const { data: ordersData, error: ordersError } = await query;
    const { data: customersData } = await supabase.from('customers').select('id, name');
    const { data: couriersData } = await supabase.from('profiles').select('id, full_name').eq('role', 'user');
    const { data: productsData } = await supabase.from('products').select('id, name, is_returnable');

    if (ordersError) {
      console.error('Error fetching data:', ordersError);
      toast.error('Gagal mengambil data pesanan.');
    } else {
      setOrders(ordersData);
      setCustomers(customersData);
      setCouriers(couriersData);
      setProducts(productsData); // Set data produk
    }
    setLoading(false);
  };
  
  const applyFilters = () => {
    fetchOrdersAndCustomers({
      status: statusFilter,
      courier: courierFilter,
      invoiceStart: invoiceNumberStart,
      invoiceEnd: invoiceNumberEnd,
    });
  };

  useEffect(() => {
    if(companyId) {
        fetchOrdersAndCustomers();
    }
  }, [companyId]);
  
  const handleOpenEditModal = (order) => {
    setCurrentOrder(order);
    if (order) {
      setEditForm({
        customer_id: order.customer_id,
        planned_date: order.planned_date,
        notes: order.notes,
        courier_id: order.courier_id,
      });
      // Salin item pesanan yang sudah ada ke state editItems
      setEditItems(order.order_items.map(item => ({
        ...item,
        product_name: item.products.name,
      })));
    } 
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setCurrentOrder(null);
    setEditForm({ customer_id: '', planned_date: '', notes: '', courier_id: '' });
    setEditItems([]);
    setNewEditItem({ product_id: '', qty: 0, price: 0 });
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };

  // Tambahkan fungsi untuk mengubah kurir pada form edit
  const handleEditCourierChange = (val) => {
    setEditForm({ ...editForm, courier_id: val });
  };
  
  // Tambahkan fungsi untuk item baru di form edit
  const handleNewEditItemChange = (e) => {
    const { name, value } = e.target;
    setNewEditItem({ ...newEditItem, [name]: parseInt(value) || 0 });
  };
  
  const handleProductSelectChange = async (val) => {
    const selectedProduct = products.find((p) => p.id === val);
    const selectedCustomer = customers.find((c) => c.id === editForm.customer_id);

    if (!selectedCustomer) {
      toast.error('Data pelanggan tidak ditemukan.');
      return;
    }

    const { data: priceData, error } = await supabase
      .from('product_prices')
      .select('price')
      .eq('product_id', selectedProduct.id)
      .eq('customer_status', selectedCustomer.customer_status)
      .single();

    if (error) {
      console.error('Error fetching price:', error);
      toast.error('Gagal memuat harga produk.');
      return;
    }

    setNewEditItem({
      ...newEditItem,
      product_id: val,
      price: priceData?.price || 0,
    });
  };

  const handleEditItemAdd = () => {
    if (!newEditItem.product_id || newEditItem.qty <= 0) {
      toast.error('Pilih produk dan masukkan jumlah.');
      return;
    }

    const selectedProduct = products.find((p) => p.id === newEditItem.product_id);
    const itemToAdd = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      qty: newEditItem.qty,
      price: newEditItem.price,
      item_type: 'beli',
      order_id: currentOrder.id,
    };

    setEditItems([...editItems, itemToAdd]);
    setNewEditItem({ product_id: '', qty: 0, price: 0 });
  };

  const handleEditItemRemove = (index) => {
    const newItems = editItems.filter((_, i) => i !== index);
    setEditItems(newItems);
  };
  
  const handleEditFormSubmit = async (e) => {
    e.preventDefault();
    setIsEditLoading(true);

    if (editItems.length === 0) {
      toast.error('Pesanan harus memiliki setidaknya satu item.');
      setIsEditLoading(false);
      return;
    }
    
    // Perbarui data di tabel 'orders'
    const { error: orderUpdateError } = await supabase
        .from('orders')
        .update(editForm)
        .eq('id', currentOrder.id);
      
    if (orderUpdateError) {
      console.error('Error updating order:', orderUpdateError);
      toast.error('Gagal memperbarui pesanan.');
      setIsEditLoading(false);
      return;
    }

    // Sinkronisasi item pesanan: hapus semua dan masukkan yang baru
    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', currentOrder.id);
    
    if (deleteItemsError) {
      console.error('Error deleting old order items:', deleteItemsError);
      toast.error('Gagal menghapus item pesanan lama.');
      setIsEditLoading(false);
      return;
    }

    const itemsToInsert = editItems.map(item => ({
      order_id: currentOrder.id,
      product_id: item.product_id,
      qty: item.qty,
      price: item.price,
      item_type: item.item_type,
    }));
    
    const { error: insertItemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (insertItemsError) {
      console.error('Error inserting new order items:', insertItemsError);
      toast.error('Gagal menambahkan item pesanan baru.');
      setIsEditLoading(false);
      return;
    }
    
    toast.success('Pesanan berhasil diperbarui!');
    fetchOrdersAndCustomers();
    handleEditModalClose();
    setIsEditLoading(false);
  };
  
  const handleDeleteClick = async (orderId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pesanan ini?')) return;
    setLoading(true);
    
    // Gunakan Supabase Function untuk menghapus semua data terkait
    try {
        const { data, error } = await supabase.functions.invoke('delete-order', {
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
    return items.reduce((total, item) => total + (item.qty * item.price), 0);
  };
  
  const handleExportToExcel = () => {
    const header = [
      "ID Pesanan", "Nomor Invoice", "Nama Pelanggan", "Alamat Pelanggan", "Telepon Pelanggan",
      "Tanggal Pengiriman", "Status Pengiriman", "Status Pembayaran", "Nama Kurir",
      "Total Harga", "Pembayaran Diterima", "Sisa Tagihan", "Galon Dikembalikan", 
      "Galon Dipinjam", "Galon Kosong Dibeli", "Biaya Transportasi", "Detail Produk", 
      "Bukti Pengiriman", "Riwayat Pembayaran"
    ];
    
    const csvRows = orders.map(order => {
      const totalPaid = order.payments ? order.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
      const totalOrderPrice = calculateTotal(order.order_items);
      const remainingDue = totalOrderPrice - totalPaid;

      const productsList = order.order_items
        .map(item => `${item.products.name} (${item.qty} x Rp${item.price})`)
        .join('; ');

      const paymentsHistory = order.payments
        .map(p => `Rp${p.amount} (${p.method}, diterima oleh: ${p.received_by ?? 'N/A'})`)
        .join('; ');

      return [
        `"${order.id}"`, // ID Pesanan
        order.invoice_number, // Nomor Invoice
        `"${order.customers?.name ?? 'N/A'}"`, // Nama Pelanggan
        `"${order.customers?.address ?? 'N/A'}"`, // Alamat Pelanggan
        `"${order.customers?.phone ?? 'N/A'}"`, // Telepon Pelanggan
        order.planned_date, // Tanggal Pengiriman
        order.status, // Status Pengiriman
        order.payment_status, // Status Pembayaran
        `"${order.couriers?.full_name ?? 'N/A'}"`, // Nama Kurir
        totalOrderPrice, // Total Harga
        totalPaid, // Pembayaran Diterima
        remainingDue, // Sisa Tagihan
        order.returned_qty, // Galon Dikembalikan
        order.borrowed_qty, // Galon Dipinjam
        order.purchased_empty_qty, // Galon Kosong Dibeli
        order.transport_cost, // Biaya Transportasi
        `"${productsList}"`, // Detail Produk
        order.proof_of_delivery_url, // Bukti Pengiriman
        `"${paymentsHistory}"` // Riwayat Pembayaran
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

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manajemen Pesanan</h1>
        {userRole === 'admin' && (
          <Button onClick={() => navigate('/orders/add')}>+ Tambah Pesanan</Button>
        )}
      </div>
      
      <Dialog open={isEditModalOpen} onOpenChange={handleEditModalClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pesanan #{currentOrder?.invoice_number}</DialogTitle>
            <DialogDescription>
              Perbarui detail pesanan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Detail Pesanan</Label>
              <div className="space-y-2">
                <Select
                  value={editForm.customer_id}
                  onValueChange={(val) => setEditForm({ ...editForm, customer_id: val })}
                  disabled={true} // Pelanggan tidak dapat diubah
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih Pelanggan" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  name="planned_date"
                  value={editForm.planned_date}
                  onChange={handleEditFormChange}
                  required
                />
                <Select
                  name="courier_id"
                  value={editForm.courier_id}
                  onValueChange={handleEditCourierChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Tugaskan Kurir (Opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Tanpa Kurir</SelectItem>
                    {couriers.map((courier) => (
                      <SelectItem key={courier.id} value={courier.id}>
                        {courier.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  name="notes"
                  placeholder="Catatan Pesanan (opsional)"
                  value={editForm.notes}
                  onChange={handleEditFormChange}
                />
              </div>
            </div>
            
            <Separator />

            <div className="space-y-2">
              <Label>Item Pesanan</Label>
              <div className="flex gap-2">
                <Select
                  value={newEditItem.product_id}
                  onValueChange={handleProductSelectChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Produk" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Jumlah"
                  name="qty"
                  value={newEditItem.qty}
                  onChange={handleNewEditItemChange}
                  min="0"
                  disabled={!newEditItem.product_id}
                />
                <Button type="button" onClick={handleEditItemAdd} disabled={!newEditItem.product_id || newEditItem.qty <= 0} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mt-1">
                Harga per item: Rp{newEditItem.price.toLocaleString('id-ID')}
              </p>

              <div className="flex flex-wrap gap-2 mt-2">
                {editItems.map((item, index) => (
                  <Badge key={index} variant="secondary">
                    {item.product_name} x{item.qty} (Rp{item.price.toLocaleString('id-ID')})
                    <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleEditItemRemove(index)} />
                  </Badge>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isEditLoading}>
              {isEditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Perbarui Pesanan'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      
      <div className="mb-6 flex space-x-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Dikirim</SelectItem>
            <SelectItem value="completed">Selesai</SelectItem>
          </SelectContent>
        </Select>

        <Select value={courierFilter} onValueChange={setCourierFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter Kurir" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kurir</SelectItem>
            {couriers.map(courier => (
              <SelectItem key={courier.id} value={courier.id}>{courier.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Invoice dari..."
          type="number"
          value={invoiceNumberStart}
          onChange={(e) => setInvoiceNumberStart(e.target.value)}
          className="w-[180px]"
        />
        <Input
          placeholder="Invoice sampai..."
          type="number"
          value={invoiceNumberEnd}
          onChange={(e) => setInvoiceNumberEnd(e.target.value)}
          className="w-[180px]"
        />
        <Button onClick={applyFilters}>Filter</Button>
        <Button onClick={() => {
            setStatusFilter('all');
            setCourierFilter('all');
            setInvoiceNumberStart('');
            setInvoiceNumberEnd('');
            fetchOrdersAndCustomers();
        }} variant="outline">Reset</Button>
        <Button onClick={handleExportToExcel} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Export ke Excel
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomor Invoice</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Tanggal Pengiriman</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Harga</TableHead>
              <TableHead>Kurir</TableHead>
              <TableHead className="w-[150px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </TableCell>
              </TableRow>
            ) : (
            orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.invoice_number}</TableCell>
                <TableCell>{order.customers?.name ?? 'N/A'}</TableCell>
                <TableCell>{order.planned_date}</TableCell>
                <TableCell className="w-[200px]">
                  <div className="flex flex-wrap gap-1">
                    {order.order_items.map(item => (
                      <Badge key={item.id} variant="secondary">
                        {item.products.name} ({item.qty})
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(order.status)}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  Rp{calculateTotal(order.order_items)}
                </TableCell>
                <TableCell>{order.couriers?.full_name ?? 'Belum Ditugaskan'}</TableCell>
                <TableCell className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${order.id}`)}>Detail</Button>
                  <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(order)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(order.id)}>Hapus</Button>
                </TableCell>
              </TableRow>
            )))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Tidak ada data pesanan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default OrdersPage;