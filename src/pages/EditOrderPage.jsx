// src/pages/EditOrderPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, X, ArrowLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const EditOrderPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { session, companyId } = useAuth();
  
  const [order, setOrder] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [couriers, setCouriers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editForm, setEditForm] = useState({ 
    customer_id: '', 
    planned_date: '', 
    notes: '', 
    courier_ids: [] 
  });
  const [editItems, setEditItems] = useState([]);
  const [newEditItem, setNewEditItem] = useState({ 
    product_id: '', 
    qty: 0, 
    price: 0 
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    if (!orderId || !companyId) {
      toast.error('ID pesanan tidak valid.');
      navigate('/orders');
      return;
    }

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          customers (id, name, customer_status, phone, address),
          order_couriers (courier:profiles(id, full_name)),
          order_items (*, products(id, name, is_returnable))
        `)
        .eq('id', orderId)
        .single();
      
      if (orderError || !orderData) throw new Error('Pesanan tidak ditemukan.');

      const { data: customersData } = await supabase.from('customers').select('id, name, customer_status').eq('company_id', companyId);
      const { data: couriersData } = await supabase.from('profiles').select('id, full_name').eq('role', 'user').eq('company_id', companyId);
      const { data: productsData } = await supabase.from('products').select('id, name, company_id').eq('company_id', companyId);

      setOrder(orderData);
      setCustomers(customersData);
      setCouriers(couriersData);
      setProducts(productsData);

      setEditForm({
        customer_id: orderData.customer_id,
        planned_date: orderData.planned_date,
        notes: orderData.notes,
        courier_ids: orderData.order_couriers.map(c => c.courier.id),
      });

      setEditItems(orderData.order_items.map(item => ({
        product_id: item.product_id,
        product_name: item.products.name,
        qty: item.qty,
        price: item.price,
        item_type: item.item_type,
      })));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data pesanan: ' + error.message);
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  }, [orderId, companyId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };
  
  const handleEditCourierCheckboxChange = (courierId, checked) => {
    setEditForm(prevForm => {
      const newCourierIds = checked
        ? [...prevForm.courier_ids, courierId]
        : prevForm.courier_ids.filter(id => id !== courierId);
      return { ...prevForm, courier_ids: newCourierIds };
    });
  };

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
      order_id: orderId,
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
    setIsSubmitting(true);

    if (editItems.length === 0) {
      toast.error('Pesanan harus memiliki setidaknya satu item.');
      setIsSubmitting(false);
      return;
    }
    
    try {
      const payload = {
        orderId,
        orderDetails: { ...editForm, company_id: companyId },
        orderItems: editItems.map(item => ({
          product_id: item.product_id,
          qty: item.qty,
          price: item.price,
          item_type: item.item_type,
        })),
      };

      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/edit-order', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal memperbarui pesanan.');
      }
    
      toast.success('Pesanan berhasil diperbarui!');
      navigate('/orders');
    } catch (error) {
      console.error('Error updating order:', error.message);
      toast.error('Gagal memperbarui pesanan: ' + error.message);
    } finally {
      setIsSubmitting(false);
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
      <div className="flex flex-col justify-center items-center min-h-screen bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-[#10182b]" />
        <p className="mt-4 text-muted-foreground">Memuat detail pesanan...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-white">
        <p className="mt-4 text-red-500">Pesanan tidak ditemukan.</p>
        <Button onClick={() => navigate('/orders')} className="mt-4">Kembali ke Daftar Pesanan</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-[#10182b] hover:bg-gray-100">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
            Edit Pesanan #{order.invoice_number}
          </h1>
          <p className="text-muted-foreground">Perbarui detail pesanan ini.</p>
        </div>
      </div>
      
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-[#10182b]">Rincian Pesanan</CardTitle>
          <CardDescription>Perbarui informasi pelanggan, tanggal, dan item pesanan.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEditFormSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="customer_id">Pelanggan</Label>
              <Select
                name="customer_id"
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
            <div className="space-y-2">
              <Label htmlFor="planned_date">Tanggal Order</Label>
              <Input
                type="date"
                name="planned_date"
                value={editForm.planned_date}
                onChange={handleEditFormChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tugaskan Petugas (Opsional)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {couriers.map((courier) => (
                  <div key={courier.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-courier-${courier.id}`}
                      checked={editForm.courier_ids?.includes(courier.id)}
                      onCheckedChange={(checked) => handleEditCourierCheckboxChange(courier.id, checked)}
                    />
                    <Label htmlFor={`edit-courier-${courier.id}`}>
                      {courier.full_name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan Pesanan</Label>
              <Input
                name="notes"
                placeholder="Catatan Pesanan (opsional)"
                value={editForm.notes}
                onChange={handleEditFormChange}
              />
            </div>
            
            <Separator />

            <div className="space-y-2">
              <Label>Item Pesanan</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
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
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Jumlah"
                    name="qty"
                    value={newEditItem.qty}
                    onChange={handleNewEditItemChange}
                    disabled={!newEditItem.product_id}
                  />
                  <Button type="button" onClick={handleEditItemAdd} disabled={!newEditItem.product_id || newEditItem.qty <= 0} size="icon" className="bg-[#10182b] text-white hover:bg-[#20283b]">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Harga per item: {formatCurrency(newEditItem.price)}
              </p>

              <div className="flex flex-wrap gap-2 mt-2">
                {editItems.map((item, index) => (
                  <Badge key={index} variant="secondary" className="pr-1">
                    {item.product_name} x{item.qty} ({formatCurrency(item.price)})
                    <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleEditItemRemove(index)} />
                  </Badge>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#20283b]" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Perbarui Pesanan'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditOrderPage;