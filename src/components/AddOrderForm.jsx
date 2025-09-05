// src/components/AddOrderForm.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import CustomerForm from './CustomerForm';
import { Separator } from '@/components/ui/separator';

const AddOrderForm = () => {
  const { session, companyId, userProfile } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orderItems, setOrderItems] = useState([]);
  const [newItem, setNewItem] = useState({ product_id: '', qty: 0, price: 0 });
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [orderForm, setOrderForm] = useState({
    customer_id: '',
    planned_date: getTodayDate(),
    notes: '',
    courier_ids: [], // Mengubah dari single courier_id ke array
  });

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchInitialData();
    }
  }, [companyId]);

  useEffect(() => {
    if (selectedCustomerId && newItem.product_id) {
      handleProductSelectChange(newItem.product_id);
    }
  }, [selectedCustomerId]);

  const fetchInitialData = async () => {
    setLoading(true);

    const { data: customersData, error: customersError } = await supabase
      .from('customers')
      .select('id, name, customer_status')
      .eq('company_id', companyId);
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*, is_returnable')
      .eq('company_id', companyId);
    const { data: couriersData, error: couriersError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'user')
      .eq('company_id', companyId);

    if (customersError || productsError || couriersError) {
      console.error('Error fetching initial data:', customersError || productsError || couriersError);
      toast.error('Gagal memuat data awal.');
    } else {
      setCustomers(customersData ? customersData.filter(c => c.id) : []);
      setProducts(productsData ? productsData.filter(p => p.id) : []);
      setCouriers(couriersData ? couriersData.filter(c => c.id) : []);
    }

    setLoading(false);
  };

  const handleOrderFormChange = (e) => {
    const { name, value } = e.target;
    setOrderForm({ ...orderForm, [name]: value });
  };

  const handleCustomerChange = (val) => {
    setSelectedCustomerId(val);
    setOrderForm({ ...orderForm, customer_id: val });
  };
  
  // Mengubah handleCourierChange menjadi handleCourierCheckboxChange
  const handleCourierCheckboxChange = (courierId, checked) => {
    setOrderForm(prevForm => {
      const newCourierIds = checked
        ? [...prevForm.courier_ids, courierId]
        : prevForm.courier_ids.filter(id => id !== courierId);
      return { ...prevForm, courier_ids: newCourierIds };
    });
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem({ ...newItem, [name]: parseInt(value) || 0 });
  };

  const handleProductSelectChange = async (val) => {
    if (!selectedCustomerId) {
      toast.error('Pilih pelanggan terlebih dahulu.');
      setNewItem({ product_id: '', qty: 0, price: 0 });
      return;
    }

    const selectedProduct = products.find((p) => p.id === val);
    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

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

    setNewItem({
      ...newItem,
      product_id: val,
      price: priceData?.price || 0,
    });
  };

  const handleItemAdd = () => {
    if (!newItem.product_id || newItem.qty <= 0) {
      toast.error('Pilih produk dan masukkan jumlah.');
      return;
    }

    const selectedProduct = products.find((p) => p.id === newItem.product_id);
    const itemToAdd = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      qty: newItem.qty,
      price: newItem.price,
      item_type: 'beli',
    };

    setOrderItems([...orderItems, itemToAdd]);
    setNewItem({ product_id: '', qty: 0, price: 0 });
  };

  const handleItemRemove = (index) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!companyId) {
      toast.error('Anda tidak dapat membuat pesanan karena tidak terhubung dengan perusahaan.');
      setLoading(false);
      return;
    }

    if (orderItems.length === 0) {
      toast.error('Pesanan harus memiliki setidaknya satu item.');
      return;
    }

    setLoading(true);

    const payload = {
      orderForm: {
        ...orderForm,
        created_by: session.user.id,
        company_id: companyId,
        courier_ids: orderForm.courier_ids.length > 0 ? orderForm.courier_ids : null, // Mengirim array courier_ids
      },
      orderItems,
    };

    try {
      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Server returned an error: ' + errorText);
      }

      toast.success('Pesanan berhasil dibuat!');
      navigate('/orders'); 
    } catch (error) {
      console.error('Error creating order:', error.message);
      toast.error('Gagal membuat pesanan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setOrderForm({ customer_id: '', planned_date: '', notes: '', courier_ids: [] });
    setSelectedCustomerId('');
    setOrderItems([]);
    setNewItem({ product_id: '', qty: 0, price: 0 });
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
        <h1 className="text-2xl font-bold">Tambah Pesanan Baru</h1>
        <Button onClick={() => navigate('/orders')} variant="outline">Kembali</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Detail Pesanan</Label>
              <div className="space-y-2">
                <Select
                  name="customer_id"
                  value={selectedCustomerId}
                  onValueChange={handleCustomerChange}
                  required
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
                    <div className="p-1">
                      <Button
                        type="button"
                        className="w-full justify-start gap-2"
                        variant="ghost"
                        onClick={() => setIsCustomerModalOpen(true)}
                      >
                        <Plus className="h-4 w-4" /> Tambah Pelanggan Baru
                      </Button>
                    </div>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  name="planned_date"
                  value={orderForm.planned_date}
                  onChange={handleOrderFormChange}
                  required
                />
                 {/* Mengganti Select dengan Checkbox untuk kurir */}
                 <div className="space-y-2">
                  <Label>Tugaskan Kurir (Opsional)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {couriers.map((courier) => (
                      <div key={courier.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`courier-${courier.id}`}
                          checked={orderForm.courier_ids.includes(courier.id)}
                          onCheckedChange={(checked) => handleCourierCheckboxChange(courier.id, checked)}
                        />
                        <Label htmlFor={`courier-${courier.id}`}>
                          {courier.full_name}
                        </Label>
                      </div>
                    ))}
                  </div>
                 </div>
                <Input
                  type="text"
                  name="notes"
                  placeholder="Catatan (opsional)"
                  value={orderForm.notes}
                  onChange={handleOrderFormChange}
                />
              </div>
            </div>

            <Separator />
            <div className="space-y-2">
              <label>Item Pesanan</label>
              <div className="flex gap-2">
                <Select
                  value={newItem.product_id}
                  onValueChange={handleProductSelectChange}
                  disabled={!selectedCustomerId}
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
                  value={newItem.qty}
                  onChange={handleNewItemChange}
                  min="0"
                  disabled={!newItem.product_id}
                />
                <Button type="button" onClick={handleItemAdd} disabled={loading || !newItem.product_id || newItem.qty <= 0} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mt-1">
                Harga per item: Rp{newItem.price.toLocaleString('id-ID')}
              </p>

              <div className="flex flex-wrap gap-2 mt-2">
                {orderItems.map((item, index) => (
                  <Badge key={index} variant="secondary">
                    {item.product_name} x{item.qty} (Rp{item.price.toLocaleString('id-ID')})
                    <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleItemRemove(index)} />
                  </Badge>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || orderItems.length === 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buat Pesanan'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <CustomerForm
        isOpen={isCustomerModalOpen}
        onOpenChange={setIsCustomerModalOpen}
        onCustomerAdded={(newCustomer) => {
          setCustomers([...customers, newCustomer]);
          setSelectedCustomerId(newCustomer.id);
          setOrderForm({ ...orderForm, customer_id: newCustomer.id });
          setIsCustomerModalOpen(false);
          toast.success('Pelanggan baru berhasil ditambahkan dan dipilih.');
        }}
      />
    </div>
  );
};

export default AddOrderForm;