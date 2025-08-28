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
  const { session } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [orderItems, setOrderItems] = useState([]);
  const [newItem, setNewItem] = useState({ product_id: '', qty: '' });
  
  const [galonForm, setGalonForm] = useState({ returned_qty: 0, borrowed_qty: 0, purchase_price: 0 });
  const [isGalonProduct, setIsGalonProduct] = useState(false);
  
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
    setNewItem({ ...newItem, [name]: value });
    
    if (name === 'product_id') {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct && selectedProduct.name.toLowerCase().includes('galon')) {
        setIsGalonProduct(true);
      } else {
        setIsGalonProduct(false);
        setGalonForm({ returned_qty: 0, borrowed_qty: 0, purchase_price: 0 });
      }
    }
  };
  
  const handleGalonFormChange = (e) => {
    const { name, value } = e.target;
    setGalonForm({ ...galonForm, [name]: value });
  };

  const handleItemAdd = () => {
    if (!newItem.product_id || !newItem.qty) {
      toast.error('Pilih produk dan masukkan jumlah.');
      return;
    }
    const selectedProduct = products.find(p => p.id === newItem.product_id);
    
    // Logic untuk galon
    if (isGalonProduct) {
      const totalGalon = parseInt(newItem.qty);
      const totalReturnedAndBorrowed = parseInt(galonForm.returned_qty) + parseInt(galonForm.borrowed_qty);

      if (totalReturnedAndBorrowed > totalGalon) {
        toast.error('Jumlah galon yang dikembalikan dan dipinjam tidak boleh melebihi total pesanan.');
        return;
      }
      
      const purchasedQty = totalGalon - totalReturnedAndBorrowed;
      
      const itemsToInsert = [];

      if (galonForm.returned_qty > 0) {
        itemsToInsert.push({
          product_id: newItem.product_id,
          product_name: `${selectedProduct.name} (Kembali)`,
          qty: parseInt(galonForm.returned_qty),
          price: 0,
          returned_qty: parseInt(galonForm.returned_qty),
          borrowed_qty: null,
          purchase_price: null,
        });
      }

      if (galonForm.borrowed_qty > 0) {
        itemsToInsert.push({
          product_id: newItem.product_id,
          product_name: `${selectedProduct.name} (Pinjam)`,
          qty: parseInt(galonForm.borrowed_qty),
          price: 0,
          returned_qty: null,
          borrowed_qty: parseInt(galonForm.borrowed_qty),
          purchase_price: null,
        });
      }

      if (purchasedQty > 0) {
         itemsToInsert.push({
            product_id: newItem.product_id,
            product_name: `${selectedProduct.name} (Beli)`,
            qty: purchasedQty,
            price: galonForm.purchase_price,
            returned_qty: null,
            borrowed_qty: null,
            purchase_price: galonForm.purchase_price,
         });
      }
      
      setOrderItems([...orderItems, ...itemsToInsert]);
    } else {
      const itemToAdd = {
        product_id: newItem.product_id,
        product_name: selectedProduct.name,
        qty: parseInt(newItem.qty),
        price: selectedProduct.price,
        returned_qty: null,
        borrowed_qty: null,
        purchase_price: null,
      };
      setOrderItems([...orderItems, itemToAdd]);
    }
    
    setNewItem({ product_id: '', qty: '' });
    setIsGalonProduct(false);
    setGalonForm({ returned_qty: 0, borrowed_qty: 0, purchase_price: 0 });
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
    
    const newOrder = {
      ...orderForm,
      created_by: session.user.id,
      status: 'draft',
      payment_status: 'unpaid',
      courier_id: null,
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
      returned_qty: item.returned_qty,
      borrowed_qty: item.borrowed_qty,
      purchase_price: item.purchase_price,
    }));
    
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);
      
    if (itemsError) {
      console.error('Error adding order items:', itemsError);
      toast.error('Gagal menambahkan item pesanan.');
      await supabase.from('orders').delete().eq('id', orderId);
    } else {
      toast.success('Pesanan berhasil dibuat!');
      onOrderAdded();
      onOpenChange(false);
    }
    setLoading(false);
  };
  
  const resetForm = () => {
    setOrderForm({ customer_id: '', planned_date: '', notes: '' });
    setOrderItems([]);
    setNewItem({ product_id: '', qty: '' });
    setIsGalonProduct(false);
    setGalonForm({ returned_qty: 0, borrowed_qty: 0, purchase_price: 0 });
  };
  
  const handleProductSelectChange = (val) => {
    setNewItem({ ...newItem, product_id: val });
    const selectedProduct = products.find(p => p.id === val);
    if (selectedProduct && selectedProduct.name.toLowerCase().includes('galon')) {
      setIsGalonProduct(true);
    } else {
      setIsGalonProduct(false);
      setGalonForm({ returned_qty: 0, borrowed_qty: 0, purchase_price: 0 });
    }
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
            <Label>Detail Pesanan</Label>
            <Select
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
              name="notes"
              placeholder="Catatan Pesanan (opsional)"
              value={orderForm.notes}
              onChange={handleOrderFormChange}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Item Pesanan</Label>
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
                min="1"
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
                  value={galonForm.returned_qty}
                  onChange={handleGalonFormChange}
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Jumlah Galon Dipinjam"
                  name="borrowed_qty"
                  value={galonForm.borrowed_qty}
                  onChange={handleGalonFormChange}
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Harga Galon Dibeli"
                  name="purchase_price"
                  value={galonForm.purchase_price}
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