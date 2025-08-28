import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const StockPage = () => {
  const { session } = useAuth();
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [currentStock, setCurrentStock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newMovementForm, setNewMovementForm] = useState({
    type: 'masuk',
    qty: '',
    notes: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchMovements(selectedProduct);
    }
  }, [selectedProduct]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, is_returnable')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal memuat daftar produk.');
    } else {
      setProducts(data);
      if (data.length > 0) {
        setSelectedProduct(data[0]);
      }
    }
    setLoading(false);
  };

  const fetchMovements = async (product) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        products (name)
      `)
      .eq('product_id', product.id)
      .order('movement_date', { ascending: false });

    if (error) {
      console.error('Error fetching movements:', error);
      toast.error('Gagal memuat data pergerakan stok.');
    } else {
      setMovements(data);
      setCurrentStock(product.stock);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewMovementForm({ ...newMovementForm, [name]: value });
  };
  
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { type, qty } = newMovementForm;
    const qtyValue = parseInt(qty);
    const newStock = type === 'masuk' ? currentStock + qtyValue : currentStock - qtyValue;
    
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProduct.id);

    if (updateError) {
      console.error('Error updating stock:', updateError);
      toast.error('Gagal memperbarui stok produk.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: selectedProduct.id,
        ...newMovementForm
      });
    
    if (insertError) {
      console.error('Error adding movement:', insertError);
      toast.error('Gagal mencatat pergerakan stok.');
    } else {
      toast.success('Pergerakan stok berhasil dicatat!');
      setNewMovementForm({ type: 'masuk', qty: '', notes: '' });
      fetchProducts();
    }
    setLoading(false);
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
      <h1 className="text-2xl font-bold mb-6">Manajemen Stok</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Stok Tersedia</CardTitle>
            <Select
              value={selectedProduct?.id}
              onValueChange={(val) => {
                setSelectedProduct(products.find(p => p.id === val));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih Produk" />
              </SelectTrigger>
              <SelectContent>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{currentStock}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Catat Pergerakan Manual</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <Select
                value={newMovementForm.type}
                onValueChange={(val) => setNewMovementForm({ ...newMovementForm, type: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Jenis Pergerakan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="masuk">Stok Masuk</SelectItem>
                  <SelectItem value="keluar">Stok Keluar</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                name="qty"
                placeholder="Jumlah Stok"
                value={newMovementForm.qty}
                onChange={handleInputChange}
                required
              />
              <Input
                name="notes"
                placeholder="Catatan (Opsional)"
                value={newMovementForm.notes}
                onChange={handleInputChange}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Catat'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold mb-4">Log Pergerakan</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map(m => (
              <TableRow key={m.id}>
                <TableCell>{new Date(m.movement_date).toLocaleDateString()}</TableCell>
                <TableCell>{m.products?.name}</TableCell>
                {/* Tampilkan item_type dari pergerakan stok */}
                <TableCell>{m.item_type || m.type}</TableCell>
                <TableCell>{m.qty}</TableCell>
                <TableCell>{m.notes}</TableCell>
              </TableRow>
            ))}
            {movements.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Tidak ada data pergerakan stok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default StockPage;