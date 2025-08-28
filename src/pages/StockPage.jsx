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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const StockPage = () => {
  const { companyId } = useAuth();
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [movements, setMovements] = useState([]);
  const [currentStock, setCurrentStock] = useState(0);
  const [loading, setLoading] = useState(true);

  // state modal detail
  const [openDetail, setOpenDetail] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailData, setDetailData] = useState([]);

  const [newMovementForm, setNewMovementForm] = useState({
    type: 'masuk',
    qty: '',
    notes: '',
  });

  useEffect(() => {
    fetchProducts();
  }, [companyId]);

  useEffect(() => {
    if (selectedProductId) {
      fetchMovements(selectedProductId);
    }
  }, [selectedProductId]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, is_returnable')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal memuat daftar produk.');
    } else {
      setProducts(data);
      if (data.length > 0) {
        setSelectedProductId(data[0].id);
      }
    }
    setLoading(false);
  };
  
  const fetchMovements = async (productId) => {
    setLoading(true);
    const { data: productData } = await supabase.from('products').select('stock').eq('id', productId).single();
    setCurrentStock(productData.stock);

    const { data: movementsData, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        products (name),
        orders (id, returned_qty, borrowed_qty, purchased_empty_qty, customers(name, phone))
      `)
      .eq('product_id', productId)
      .order('movement_date', { ascending: false });

    if (error) {
      console.error('Error fetching movements:', error);
      toast.error('Gagal memuat data pergerakan stok.');
    } else {
      setMovements(movementsData);
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

    const { type, qty, notes } = newMovementForm;
    const qtyValue = parseInt(qty);
    const newStock = type === 'masuk' ? (currentStock + qtyValue) : (currentStock - qtyValue);
    
    if (newStock < 0) {
      toast.error('Stok tidak bisa kurang dari 0.');
      setLoading(false);
      return;
    }
    
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProductId);

    if (updateError) {
      console.error('Error updating stock:', updateError);
      toast.error('Gagal memperbarui stok produk.');
      setLoading(false);
      return;
    }
    
    const { error: insertError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: selectedProductId,
        qty: qtyValue,
        type,
        notes,
        company_id: companyId,
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

  // fungsi ambil detail berdasarkan kategori
  const fetchDetail = async (category) => {
    let query = supabase.from('orders').select(`
      id,
      returned_qty,
      borrowed_qty,
      purchased_empty_qty,
      customers (name, phone)
    `).eq('company_id', companyId);

    if (category === 'dibeli') {
      query = query.gt('purchased_empty_qty', 0);
      setDetailTitle('Detail Galon Dibeli');
    }
    if (category === 'dikembalikan') {
      query = query.gt('returned_qty', 0);
      setDetailTitle('Detail Galon Dikembalikan');
    }
    if (category === 'dipinjam') {
      query = query.gt('borrowed_qty', 0);
      setDetailTitle('Detail Galon Dipinjam');
    }

    const { data, error } = await query;
    if (!error) {
      setDetailData(data);
      setOpenDetail(true);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">Manajemen Stok</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Stok Tersedia</CardTitle>
            <Select
              value={selectedProductId}
              onValueChange={(val) => {
                setSelectedProductId(val);
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
            <p className="text-4xl font-bold">
              {currentStock}
            </p>
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
      
      {/* Section untuk returnable */}
      {selectedProduct && selectedProduct.is_returnable && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Ringkasan Galon Returnable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg border bg-gray-50">
                <h3 className="text-lg font-semibold">Dibeli (Galon Kosong)</h3>
                <button
                  className="text-3xl font-bold text-purple-600 hover:underline"
                  onClick={() => fetchDetail('dibeli')}
                >
                  {movements
                    .filter(m => m.notes?.includes('dibeli galon kosong'))
                    .reduce((sum, m) => sum + m.qty, 0)}
                </button>
              </div>

              <div className="p-4 rounded-lg border bg-gray-50">
                <h3 className="text-lg font-semibold">Dikembalikan</h3>
                <button
                  className="text-3xl font-bold text-green-600 hover:underline"
                  onClick={() => fetchDetail('dikembalikan')}
                >
                  {movements
                    .filter(m => m.type === 'pengembalian')
                    .reduce((sum, m) => sum + m.qty, 0)}
                </button>
                <p className="text-sm text-gray-500">Stok kosong bertambah</p>
              </div>

              <div className="p-4 rounded-lg border bg-gray-50">
                <h3 className="text-lg font-semibold">Dipinjam</h3>
                <button
                  className="text-3xl font-bold text-yellow-600 hover:underline"
                  onClick={() => fetchDetail('dipinjam')}
                >
                  {movements
                    .filter(m => m.type === 'pinjam_kembali')
                    .reduce((sum, m) => sum + m.qty, 0)}
                </button>
                <p className="text-sm text-gray-500">Masih di customer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal detail */}
      <Dialog open={openDetail} onOpenChange={setOpenDetail}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {detailData.length > 0 ? (
              detailData.map(d => (
                <div key={d.id} className="p-2 border rounded-md">
                  <p className="font-medium">{d.customers?.name}</p>
                  <p className="text-sm text-gray-500">{d.customers?.phone}</p>
                  {d.returned_qty > 0 && <p>Returned: {d.returned_qty}</p>}
                  {d.borrowed_qty > 0 && <p>Borrowed: {d.borrowed_qty}</p>}
                  {d.purchased_empty_qty > 0 && <p>Purchased Empty: {d.purchased_empty_qty}</p>}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">Tidak ada data.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <h2 className="text-xl font-bold mt-8 mb-4">Log Pergerakan</h2>
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
                <TableCell>{m.type || m.item_type}</TableCell>
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
