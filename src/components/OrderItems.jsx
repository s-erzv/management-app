import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const OrderItems = ({ orderId, isEditable, onItemsUpdated }) => {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ product_id: '', qty: '', price: '' });

  useEffect(() => {
    fetchData();
  }, [orderId]);

  const fetchData = async () => {
    setLoading(true);
    // Ubah kueri untuk mengambil kolom 'item_type' dari order_items
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select(`*, products (name, price, is_returnable)`)
      .eq('order_id', orderId);

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (itemsError || productsError) {
      console.error('Error fetching data:', itemsError || productsError);
      toast.error('Gagal memuat item pesanan.');
    } else {
      setItems(itemsData);
      setProducts(productsData);
      onItemsUpdated(itemsData);
    }
    setLoading(false);
  };

  const handleProductChange = (val) => {
    const selectedProduct = products.find(p => p.id === val);
    setNewItem({
      ...newItem,
      product_id: val,
      price: selectedProduct ? selectedProduct.price : '',
    });
  };

  const handleQtyChange = (e) => {
    const qty = e.target.value;
    setNewItem({ ...newItem, qty });
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase
      .from('order_items')
      .insert({
        order_id: orderId,
        product: newItem.product_id,
        qty: newItem.qty,
        price: newItem.price,
      })
      .select();

    if (error) {
      console.error('Error adding item:', error);
      toast.error('Gagal menambahkan item.');
    } else {
      toast.success('Item berhasil ditambahkan.');
      setNewItem({ product_id: '', qty: '', price: '' });
      fetchData();
    }
    setLoading(false);
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus item ini?')) return;
    setLoading(true);
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting item:', error);
      toast.error('Gagal menghapus item.');
    } else {
      toast.success('Item berhasil dihapus.');
      setItems(items.filter(item => item.id !== itemId));
      onItemsUpdated(items.filter(item => item.id !== itemId));
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isEditable && (
        <form onSubmit={handleAddItem} className="flex gap-2">
          <Select value={newItem.product_id} onValueChange={handleProductChange} required>
            <SelectTrigger className="w-1/2">
              <SelectValue placeholder="Pilih Produk" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Jumlah"
            className="w-1/4"
            value={newItem.qty}
            onChange={handleQtyChange}
            required
            min="1"
          />
          <Button type="submit" disabled={loading} className="w-1/4">
            Tambah
          </Button>
        </form>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produk</TableHead>
            <TableHead>Jumlah</TableHead>
            <TableHead>Harga</TableHead>
            {isEditable && <TableHead>Aksi</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              {/* Tampilkan item_type jika ada */}
              <TableCell className="font-medium">
                {item.products?.name ?? 'N/A'} {item.item_type ? `(${item.item_type})` : ''}
              </TableCell>
              <TableCell>{item.qty}</TableCell>
              <TableCell>Rp{item.price}</TableCell>
              {isEditable && (
                <TableCell>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(item.id)}>
                    Hapus
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={isEditable ? 4 : 3} className="text-center text-muted-foreground py-4">
                Tidak ada item di pesanan ini.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default OrderItems;