import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Loader2, Package, PackageCheck, Banknote, PlusCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge'; // Pastikan Badge diimpor

const StockAndGalonPage = () => {
  const { companyId } = useAuth();
  const [products, setProducts] = useState([]);
  const [debts, setDebts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [movements, setMovements] = useState([]);
  const [manualMovements, setManualMovements] = useState([]);
  const [currentStock, setCurrentStock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // State baru untuk refresh
  const [activeTab, setActiveTab] = useState('stock');
  const [activeStockTab, setActiveStockTab] = useState('summary');

  const [openDetail, setOpenDetail] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailData, setDetailData] = useState([]);
  
  const [newMovementForm, setNewMovementForm] = useState({
    type: 'masuk',
    qty: '',
    notes: '',
  });

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
  }, [companyId]);

  useEffect(() => {
    if (selectedProductId) {
      fetchMovements(selectedProductId);
    }
  }, [selectedProductId]);
  
  useEffect(() => {
    if (companyId && activeTab === 'debt') {
      const channel = supabase
        .channel('galon_debt_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchGalonDebts();
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [companyId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    await fetchProducts();
    await fetchGalonDebts();
    setLoading(false);
  };

  const fetchProducts = async () => {
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
      setManualMovements(movementsData.filter(m => m.type === 'masuk' || m.type === 'keluar'));
    }
    setLoading(false);
  };
  
  const fetchGalonDebts = async () => {
    setRefreshing(true); // Mulai refresh
    const { data, error } = await supabase.rpc('get_customer_galon_debt', { p_company_id: companyId });
    if (error) {
      console.error('Error fetching galon debts:', error);
      toast.error('Gagal memuat data utang galon.');
    } else {
      setDebts(data);
    }
    setRefreshing(false); // Selesai refresh
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
      toast.success('Penyesuaian stok berhasil dicatat!');
      setNewMovementForm({ type: 'masuk', qty: '', notes: '' });
      fetchProducts();
    }
    setLoading(false);
  };
  
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
  
  const handleSettleDebt = async (customerId) => {
    if (!window.confirm('Apakah Anda yakin ingin menandai utang galon ini sebagai lunas? Tindakan ini tidak dapat diurungkan.')) {
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.rpc('settle_galon_debt', { p_customer_id: customerId });
    
    if (error) {
      console.error('Error settling debt:', error);
      toast.error('Gagal melunasi utang galon.');
    } else {
      toast.success('Utang galon berhasil dilunasi!');
      fetchGalonDebts();
    }
    setLoading(false);
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">Manajemen Stok & Utang Galon</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="stock" className="gap-2">
            <PackageCheck className="h-4 w-4" /> Stok Produk
          </TabsTrigger>
          <TabsTrigger value="debt" className="gap-2">
            <Banknote className="h-4 w-4" /> Utang Galon
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="pt-4 space-y-6">
          <div className="flex items-center space-x-4 mb-4">
            <Label htmlFor="product-select">Pilih Produk</Label>
            <Select
              id="product-select"
              value={selectedProductId}
              onValueChange={(val) => {
                setSelectedProductId(val);
                setActiveStockTab('summary');
              }}
            >
              <SelectTrigger className="w-[200px]">
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
          </div>
          
          <Tabs value={activeStockTab} onValueChange={setActiveStockTab}>
            <TabsList>
              <TabsTrigger value="summary">Ringkasan Stok</TabsTrigger>
              <TabsTrigger value="adjustment">Penyesuaian Stok</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="pt-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Stok Tersedia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">{currentStock}</p>
                  </CardContent>
                </Card>
              </div>

              {selectedProduct && selectedProduct.is_returnable && (
                <Card>
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
                          {movements.filter(m => m.notes?.includes('dibeli galon kosong')).reduce((sum, m) => sum + m.qty, 0)}
                        </button>
                      </div>
                      <div className="p-4 rounded-lg border bg-gray-50">
                        <h3 className="text-lg font-semibold">Dikembalikan</h3>
                        <button
                          className="text-3xl font-bold text-green-600 hover:underline"
                          onClick={() => fetchDetail('dikembalikan')}
                        >
                          {movements.filter(m => m.type === 'pengembalian').reduce((sum, m) => sum + m.qty, 0)}
                        </button>
                      </div>
                      <div className="p-4 rounded-lg border bg-gray-50">
                        <h3 className="text-lg font-semibold">Dipinjam</h3>
                        <button
                          className="text-3xl font-bold text-yellow-600 hover:underline"
                          onClick={() => fetchDetail('dipinjam')}
                        >
                          {movements.filter(m => m.type === 'pinjam_kembali').reduce((sum, m) => sum + m.qty, 0)}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <h2 className="text-xl font-bold mt-8 mb-4">Log Semua Pergerakan Stok</h2>
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
            </TabsContent>

            <TabsContent value="adjustment" className="pt-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Penyesuaian Stok</CardTitle>
                  <CardDescription>
                    Tambahkan stok masuk atau keluar secara manual.
                  </CardDescription>
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
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Catat Penyesuaian'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
              
              <h2 className="text-xl font-bold mt-8 mb-4">Riwayat Penyesuaian Manual</h2>
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
                    {manualMovements.map(m => (
                      <TableRow key={m.id}>
                        <TableCell>{new Date(m.movement_date).toLocaleDateString()}</TableCell>
                        <TableCell>{m.products?.name}</TableCell>
                        <TableCell>{m.type}</TableCell>
                        <TableCell>{m.qty}</TableCell>
                        <TableCell>{m.notes}</TableCell>
                      </TableRow>
                    ))}
                    {manualMovements.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Tidak ada data penyesuaian manual.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

          </Tabs>
        </TabsContent>

        <TabsContent value="debt" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Daftar Utang Galon Pelanggan</CardTitle>
              <Button onClick={fetchGalonDebts} disabled={loading || refreshing}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2">Refresh Data</span>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pelanggan</TableHead>
                      <TableHead>Nomor Telepon</TableHead>
                      <TableHead>Jumlah Galon Dipinjam</TableHead>
                      <TableHead className="w-[120px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debts.length > 0 ? (
                      debts.map((debt) => (
                        <TableRow key={debt.customer_id}>
                          <TableCell>{debt.customer_name}</TableCell>
                          <TableCell>{debt.customer_phone}</TableCell>
                          <TableCell>{debt.total_borrowed_qty}</TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleSettleDebt(debt.customer_id)}
                              disabled={loading}
                              className="bg-green-500 text-white hover:bg-green-600"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Lunas
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Tidak ada utang galon saat ini.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
    </div>
  );
};

export default StockAndGalonPage;