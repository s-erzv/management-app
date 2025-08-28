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
import { Loader2, Plus, X } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';

const OrdersPage = () => {
  const { session } = useAuth();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // State untuk Modal Tunggal (Add & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  
  // State untuk form
  const [orderForm, setOrderForm] = useState({ customer_id: '', planned_date: '', notes: '' });
  const [orderItems, setOrderItems] = useState([]);
  const [newItem, setNewItem] = useState({ product_id: '', qty: '' });
  const [isReturnableSelected, setIsReturnableSelected] = useState(false);

  useEffect(() => {
    fetchOrdersAndCustomers();
  }, []);

  const fetchOrdersAndCustomers = async () => {
    setLoading(true);
    
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name),
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
  
  const handleOpenModal = async (order = null) => {
    setCurrentOrder(order);
    if (order) {
      setOrderForm({
        customer_id: order.customer_id,
        planned_date: order.planned_date,
        notes: order.notes,
      });
      
      const { data: itemsData } = await supabase.from('order_items').select(`*, products(name, is_returnable)`).eq('order_id', order.id);
      const itemsWithNames = itemsData.map(item => ({
        product_id: item.product_id,
        product_name: item.products.name,
        qty: item.qty,
        price: item.price,
        is_returnable: item.products.is_returnable
      }));
      setOrderItems(itemsWithNames);
    } else {
      setOrderForm({ customer_id: '', planned_date: '', notes: '' });
      setOrderItems([]);
    }
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setCurrentOrder(null);
    setOrderForm({ customer_id: '', planned_date: '', notes: '' });
    setOrderItems([]);
    setNewItem({ product_id: '', qty: '' });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setOrderForm({ ...orderForm, [name]: value });
  };
  
  const handleItemAdd = () => {
    if (!newItem.product_id || !newItem.qty) {
      toast.error('Pilih produk dan masukkan jumlah.');
      return;
    }
    const selectedProduct = products.find(p => p.id === newItem.product_id);
    const itemToAdd = {
      product_id: newItem.product_id,
      product_name: selectedProduct.name,
      qty: parseInt(newItem.qty),
      price: selectedProduct.price,
      is_returnable: selectedProduct.is_returnable
    };
    setOrderItems([...orderItems, itemToAdd]);
    setNewItem({ product_id: '', qty: '' });
  };

  const handleItemRemove = (index) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      toast.error('Pesanan harus memiliki setidaknya satu item.');
      return;
    }
    setLoading(true);

    if (currentOrder) {
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update(orderForm)
        .eq('id', currentOrder.id);
      
      if (orderUpdateError) {
        console.error('Error updating order:', orderUpdateError);
        toast.error('Gagal memperbarui pesanan.');
        setLoading(false);
        return;
      }
      
      await supabase.from('order_items').delete().eq('order_id', currentOrder.id);
      const itemsToInsert = orderItems.map(item => ({
        order_id: currentOrder.id,
        product_id: item.product_id,
        qty: item.qty,
        price: item.price,
      }));
      const { error: itemsInsertError } = await supabase.from('order_items').insert(itemsToInsert);
      
      if (itemsInsertError) {
        console.error('Error updating order items:', itemsInsertError);
        toast.error('Gagal memperbarui item pesanan.');
      } else {
        toast.success('Pesanan berhasil diperbarui!');
        fetchOrdersAndCustomers();
        handleModalClose();
      }
    } else {
      const newOrder = {
        ...orderForm,
        created_by: session.user.id,
        status: 'draft',
        payment_status: 'unpaid',
      };
      const { data: insertedOrder, error: orderError } = await supabase
        .from('orders')
        .insert([newOrder])
        .select('id');
      
      if (orderError) {
        console.error('Error creating order:', orderError);
        toast.error('Gagal membuat pesanan.');
        setLoading(false);
        return;
      }
      
      const orderId = insertedOrder[0].id;
      const itemsToInsert = orderItems.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        qty: item.qty,
        price: item.price,
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      
      if (itemsError) {
        console.error('Error adding order items:', itemsError);
        toast.error('Gagal menambahkan item pesanan.');
        await supabase.from('orders').delete().eq('id', orderId);
      } else {
        toast.success('Pesanan berhasil dibuat!');
        fetchOrdersAndCustomers();
        handleModalClose();
      }
    }
    setLoading(false);
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

  const selectedProductIsReturnable = products.find(p => p.id === newItem.product_id)?.is_returnable;

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
        <Button onClick={() => handleOpenModal()}>+ Tambah Pesanan</Button>
      </div>
      
      <Dialog open={isModalOpen} onOpenChange={handleModalClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentOrder ? `Edit Pesanan #${currentOrder.id.slice(0,8)}` : 'Tambah Pesanan Baru'}</DialogTitle>
            <DialogDescription>
              {currentOrder ? 'Perbarui detail dan item pesanan.' : 'Isi detail pesanan dan pilih produk.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Pelanggan</Label>
              <Select
                value={orderForm.customer_id}
                onValueChange={(val) => setOrderForm({ ...orderForm, customer_id: val })}
                disabled={!!currentOrder}
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
              value={orderForm.planned_date}
              onChange={handleFormChange}
              required
            />
            <Input
              name="notes"
              placeholder="Catatan Pesanan (opsional)"
              value={orderForm.notes}
              onChange={handleFormChange}
            />
            
            <div className="space-y-2">
              <Label>Item Pesanan</Label>
              <div className="flex gap-2">
                <Select
                  value={newItem.product_id}
                  onValueChange={(val) => setNewItem({ ...newItem, product_id: val })}
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
                  value={newItem.qty}
                  onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                  min="1"
                />
                <Button type="button" onClick={handleItemAdd} disabled={loading} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {selectedProductIsReturnable && (
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="is_returnable"
                    checked={isReturnableSelected}
                    onCheckedChange={setIsReturnableSelected}
                  />
                  <label htmlFor="is_returnable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Galon Kembali (Kosong)
                  </label>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 mt-2">
                {orderItems.map((item, index) => (
                  <Badge key={index} variant="secondary">
                    {item.product_name} x{item.qty}
                    <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleItemRemove(index)} />
                  </Badge>
                ))}
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading || orderItems.length === 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (currentOrder ? 'Perbarui Pesanan' : 'Buat Pesanan')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID Pesanan</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Tanggal Pengiriman</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Harga</TableHead>
              <TableHead>Kurir</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
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
                  <Button variant="outline" size="sm" onClick={() => handleOpenModal(order)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(order.id)}>Hapus</Button>
                </TableCell>
              </TableRow>
            ))}
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