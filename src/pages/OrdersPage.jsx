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
import { Loader2 } from 'lucide-react';
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
import AddOrderForm from '@/components/AddOrderForm'; 
import { useNavigate } from 'react-router-dom'; 

const OrdersPage = () => {
  const navigate = useNavigate();
  const { session, userRole } = useAuth();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  
  const [editForm, setEditForm] = useState({ customer_id: '', planned_date: '', notes: '' });
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);

  useEffect(() => {
    fetchOrdersAndCustomers();
  }, []);

  const fetchOrdersAndCustomers = async () => {
    setLoading(true);
    
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, phone),
        couriers:profiles (full_name),
        order_items (*, products(name, is_returnable))
      `)
      .order('created_at', { ascending: false });
    
    const { data: customersData } = await supabase
      .from('customers')
      .select('id, name');
    
    const { data: productsData } = await supabase
      .from('products')
      .select('*, is_returnable');

    if (ordersError) {
      console.error('Error fetching data:', ordersError);
      toast.error('Gagal mengambil data pesanan.');
    } else {
      setOrders(ordersData);
      setCustomers(customersData);
      setProducts(productsData);
    }
    setLoading(false);
  };
  
  const handleOpenEditModal = async (order) => {
    setCurrentOrder(order);
    if (order) {
      setEditForm({
        customer_id: order.customer_id,
        planned_date: order.planned_date,
        notes: order.notes,
      });
    } 
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setCurrentOrder(null);
    setEditForm({ customer_id: '', planned_date: '', notes: '' });
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };
  
  const handleEditFormSubmit = async (e) => {
    e.preventDefault();
    setIsEditLoading(true);

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

    toast.success('Pesanan berhasil diperbarui!');
    fetchOrdersAndCustomers();
    handleEditModalClose();
    setIsEditLoading(false);
  };
  
  const handleDeleteClick = async (orderId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pesanan ini?')) return;
    setLoading(true);

    const { error: paymentsError } = await supabase
      .from('payments')
      .delete()
      .eq('order_id', orderId);

    const { error: movementsError } = await supabase
      .from('stock_movements')
      .delete()
      .eq('order_id', orderId);

    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (paymentsError || movementsError || itemsError) {
      console.error('Error deleting related data:', paymentsError || movementsError || itemsError);
      toast.error('Gagal menghapus data terkait pesanan.');
      setLoading(false);
      return;
    }
    
    const { error: orderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (orderError) {
      console.error('Error deleting order:', orderError);
      toast.error('Gagal menghapus pesanan.');
    } else {
      toast.success('Pesanan berhasil dihapus.');
      setOrders(orders.filter(order => order.id !== orderId));
    }
    setLoading(false);
  };

  const calculateTotal = (items) => {
    return items.reduce((total, item) => total + (item.qty * item.price), 0);
  };

  const handleSendInvoice = async (order) => {
      setIsSendingInvoice(true);
      toast.loading('Membuat invoice PDF...', { id: 'invoice-toast' });

      try {
        const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-invoice-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ order_id: order.id }),
        });

        if (!response.ok) {
          throw new Error('Gagal membuat invoice PDF.');
        }

        const { pdfUrl } = await response.json();
        
        const invoiceNumber = order.invoice_number;
        const totalAmount = calculateTotal(order.order_items);
        
        const { data: company, error } = await supabase
          .from('companies')
          .select('name')
          .eq('id', order.company_id)
          .single();

        if (error) {
          console.error('Error fetching company:', error.message);
          throw new Error('Gagal mengambil nama perusahaan.');
        }

        const companyName = company ? company.name : 'Nama Perusahaan';

        const whatsappMessage = `Assalamualaikum warahmatullahi wabarakatuh.
  Yth. Bapak/Ibu ${order.customers.name},

  Dengan hormat, kami sampaikan tagihan untuk pesanan Anda dengan rincian berikut:
  Invoice No. ${invoiceNumber} senilai Rp${totalAmount}.
  Tautan invoice: ${pdfUrl}.

  Metode Pembayaran:

  Tunai (Cash) – dibayarkan saat serah terima/di lokasi.

  Transfer Bank (BSI)
  • Bank: Bank Syariah Indonesia (BSI)
  • No. Rekening: 7177559948
  • A.n.: M Hammam Jafar
  • Berita/Referensi: Invoice ${invoiceNumber} – ${order.customers.name}

  Setelah pembayaran, mohon kirimkan bukti transfer ke nomor ini dan mengonfirmasi pembayaran.
  Jazaakumullaahu khairan atas perhatian dan kerja samanya.
  Wassalamualaikum warahmatullahi wabarakatuh.

  Hormat kami,
  ${companyName}`;

        const whatsappUrl = `https://wa.me/${order.customers.phone}?text=${encodeURIComponent(whatsappMessage)}`;
        
        window.open(whatsappUrl, '_blank');
        
        toast.success('Invoice berhasil dikirim!', { id: 'invoice-toast' });

      } catch (error) {
        console.error('Error sending invoice:', error.message);
        toast.error(error.message, { id: 'invoice-toast' });
      } finally {
        setIsSendingInvoice(false);
      }
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manajemen Pesanan</h1>
        {userRole === 'admin' && (
          <Button onClick={() => setIsAddModalOpen(true)}>+ Tambah Pesanan</Button>
        )}
      </div>
      
      <AddOrderForm
        isOpen={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onOrderAdded={fetchOrdersAndCustomers}
      />

      <Dialog open={isEditModalOpen} onOpenChange={handleEditModalClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pesanan #{currentOrder?.id.slice(0,8)}</DialogTitle>
            <DialogDescription>
              Perbarui detail pesanan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Pelanggan</Label>
              <Select
                value={editForm.customer_id}
                onValueChange={(val) => setEditForm({ ...editForm, customer_id: val })}
                disabled={true}
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
            </div>
            <Input
              type="date"
              name="planned_date"
              value={editForm.planned_date}
              onChange={handleEditFormChange}
              required
            />
            <Input
              name="notes"
              placeholder="Catatan Pesanan (opsional)"
              value={editForm.notes}
              onChange={handleEditFormChange}
            />
            <Button type="submit" className="w-full" disabled={isEditLoading}>
              {isEditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Perbarui Pesanan'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomor Invoice</TableHead>
              <TableHead>ID Pesanan</TableHead>
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
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.invoice_number}</TableCell>
                <TableCell className="font-medium">{order.id.slice(0, 8)}...</TableCell>
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
                <TableCell>{order.status}</TableCell>
                <TableCell>
                  Rp{calculateTotal(order.order_items)}
                </TableCell>
                <TableCell>{order.couriers?.full_name ?? 'Belum Ditugaskan'}</TableCell>
                <TableCell className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${order.id}`)}>Detail</Button>
                  <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(order)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(order.id)}>Hapus</Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => handleSendInvoice(order)}
                    disabled={isSendingInvoice}
                  >
                    {isSendingInvoice ? 'Mengirim...' : 'Kirim Invoice'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
    </div>
  );
};

export default OrdersPage;