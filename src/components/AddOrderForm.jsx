// src/components/AddOrderForm.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

const AddOrderForm = ({ isOpen, onOpenChange, onOrderAdded }) => {
  const { session, companyId } = useAuth(); // Dapatkan companyId dari useAuth
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [orderItems, setOrderItems] = useState([]);
  const [newItem, setNewItem] = useState({ product_id: '', qty: 0 });
  
  const [isGalonProduct, setIsGalonProduct] = useState(false);
  const [galonDetail, setGalonDetail] = useState({ returned_qty: 0, borrowed_qty: 0, purchase_price: 0 });
  
  const [orderForm, setOrderForm] = useState({
    customer_id: '',
    planned_date: '',
    notes: '',
  });

  useEffect(() => {
    fetchCustomersAndProducts();
  }, []);

  const fetchCustomersAndProducts = async () => {
    setLoading(true);
    const { data: customersData } = await supabase.from('customers').select('id, name');
    const { data: productsData } = await supabase.from('products').select('*');
    
    setCustomers(customersData);
    setProducts(productsData);
    setLoading(false);
  };
  
  const handleOrderFormChange = (e) => {
    const { name, value } = e.target;
    setOrderForm({ ...orderForm, [name]: value });
  };
  
  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem({ ...newItem, [name]: parseInt(value) || 0 });
  };
  
  const handleGalonFormChange = (e) => {
    const { name, value } = e.target;
    setGalonDetail({ ...galonDetail, [name]: parseFloat(value) || 0 });
  };

  const handleProductSelectChange = (val) => {
    const selectedProduct = products.find(p => p.id === val);
    setNewItem({ ...newItem, product_id: val });
    
    if (selectedProduct && selectedProduct.is_returnable) {
      setIsGalonProduct(true);
      setGalonDetail({ returned_qty: 0, borrowed_qty: 0, purchase_price: selectedProduct.price });
    } else {
      setIsGalonProduct(false);
      setGalonDetail({ returned_qty: 0, borrowed_qty: 0, purchase_price: 0 });
    }
  };

  const handleItemAdd = () => {
    if (!newItem.product_id || newItem.qty <= 0) {
      toast.error('Pilih produk dan masukkan jumlah.');
      return;
    }
    
    const selectedProduct = products.find(p => p.id === newItem.product_id);
    let itemsToAdd = [];

    if (isGalonProduct) {
      const totalGalon = newItem.qty;
      const { returned_qty, borrowed_qty, purchase_price } = galonDetail;
      const purchased_qty = totalGalon - returned_qty - borrowed_qty;

      if (returned_qty + borrowed_qty > totalGalon) {
        toast.error('Jumlah galon kembali dan pinjam tidak boleh melebihi jumlah total.');
        return;
      }
      
      if (returned_qty > 0) {
        itemsToAdd.push({
          product_id: selectedProduct.id,
          product_name: `${selectedProduct.name} (Kembali)`,
          qty: returned_qty,
          price: 0,
          item_type: 'kembali'
        });
      }
      if (borrowed_qty > 0) {
        itemsToAdd.push({
          product_id: selectedProduct.id,
          product_name: `${selectedProduct.name} (Pinjam)`,
          qty: borrowed_qty,
          price: 0,
          item_type: 'pinjam'
        });
      }
      if (purchased_qty > 0) {
        itemsToAdd.push({
          product_id: selectedProduct.id,
          product_name: `${selectedProduct.name} (Beli)`,
          qty: purchased_qty,
          price: purchase_price,
          item_type: 'beli'
        });
      }
    } else {
      itemsToAdd.push({
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        qty: newItem.qty,
        price: selectedProduct.price,
        item_type: 'beli'
      });
    }

    setOrderItems([...orderItems, ...itemsToAdd]);
    setNewItem({ product_id: '', qty: 0 });
    setIsGalonProduct(false);
    setGalonDetail({ returned_qty: 0, borrowed_qty: 0, purchase_price: 0 });
  };
  
  const handleItemRemove = (index) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };
  
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    console.log('companyId dari useAuth:', companyId); 
    if (orderItems.length === 0) {
      toast.error('Pesanan harus memiliki setidaknya satu item.');
      return;
    }
    
    setLoading(true);
    
     const payload = {
        orderForm: { ...orderForm, created_by: session.user.id, company_id: companyId },
        orderItems,
    };

    try {
        const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(payload),
        });

        // Tambahkan pengecekan ini
        console.log('Response status:', response.status); // Cek status HTTP
        const text = await response.text();
        console.log('Response body:', text); // Lihat apa isinya

        if (!response.ok) {
            throw new Error('Server returned an error: ' + text);
        }

        const data = JSON.parse(text); // Menggunakan JSON.parse sebagai alternatif

        // ... lanjutkan kode Anda seperti sebelumnya
        toast.success('Pesanan berhasil dibuat!');
        onOrderAdded();
        onOpenChange(false);

    } catch (error) {
        console.error('Error creating order:', error.message);
        toast.error('Gagal membuat pesanan: ' + error.message);
    } finally {
        setLoading(false);
    }
    };
  
  const resetForm = () => {
    setOrderForm({ customer_id: '', planned_date: '', notes: '' });
    setOrderItems([]);
    setNewItem({ product_id: '', qty: 0 });
    setIsGalonProduct(false);
    setGalonDetail({ returned_qty: 0, borrowed_qty: 0, purchase_price: 0 });
  };
  

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent onEscapeKeyDown={resetForm} onPointerDownOutside={resetForm}>
        <DialogHeader>
          <DialogTitle>Tambah Pesanan Baru</DialogTitle>
          <DialogDescription>
            Isi detail pesanan dan pilih produk yang akan dibeli.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label>Detail Pesanan</label>
            <div className="space-y-2">
              <Select
                name="customer_id"
                value={orderForm.customer_id}
                onValueChange={(val) => setOrderForm({ ...orderForm, customer_id: val })}
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
                value={orderForm.planned_date}
                onChange={handleOrderFormChange}
                required
              />
              <Input
                type="text"
                name="notes"
                placeholder="Catatan (opsional)"
                value={orderForm.notes}
                onChange={handleOrderFormChange}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label>Item Pesanan</label>
            <div className="flex gap-2">
              <Select
                value={newItem.product_id}
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
                value={newItem.qty}
                onChange={handleNewItemChange}
                min="0"
              />
              <Button type="button" onClick={handleItemAdd} disabled={loading} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {isGalonProduct && (
              <div className="space-y-2 border p-4 rounded-md">
                <p className="font-semibold">Detail Galon</p>
                <Input
                  type="number"
                  placeholder="Jumlah Galon Kembali"
                  name="returned_qty"
                  value={galonDetail.returned_qty}
                  onChange={handleGalonFormChange}
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Jumlah Galon Dipinjam"
                  name="borrowed_qty"
                  value={galonDetail.borrowed_qty}
                  onChange={handleGalonFormChange}
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Harga Galon Dibeli"
                  name="purchase_price"
                  value={galonDetail.purchase_price}
                  onChange={handleGalonFormChange}
                  min="0"
                />
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buat Pesanan'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddOrderForm;