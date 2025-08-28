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
  const { session, companyId } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [orderItems, setOrderItems] = useState([]);
  const [newItem, setNewItem] = useState({ product_id: '', qty: 0 });
  
  const [orderForm, setOrderForm] = useState({
    customer_id: '',
    planned_date: '',
    notes: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, [companyId]);

  const fetchInitialData = async () => {
    setLoading(true);
    
    const { data: customersData } = await supabase.from('customers').select('id, name');
    setCustomers(customersData);

    const { data: productsData } = await supabase.from('products').select('*');
    setProducts(productsData);

    if (companyId) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();
      if (companyData) {
        setCompanyName(companyData.name);
      }
    }
    
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
  
  const handleProductSelectChange = (val) => {
    setNewItem({ ...newItem, product_id: val });
  };

  const handleItemAdd = () => {
    if (!newItem.product_id || newItem.qty <= 0) {
      toast.error('Pilih produk dan masukkan jumlah.');
      return;
    }
    
    const selectedProduct = products.find(p => p.id === newItem.product_id);
    const itemToAdd = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      qty: newItem.qty,
      price: selectedProduct.price,
      item_type: 'beli'
    };

    setOrderItems([...orderItems, itemToAdd]);
    setNewItem({ product_id: '', qty: 0 });
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Server returned an error: ' + errorText);
      }

      const data = await response.json(); 

      toast.success('Pesanan berhasil dibuat!');
      onOrderAdded();
      onOpenChange(false);
      resetForm();

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
          <div className="space-y-2">
            <Label>Perusahaan</Label>
            <Input
              type="text"
              value={companyName || 'Memuat...'}
              disabled
            />
          </div>

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