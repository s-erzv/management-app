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
import { Loader2, Package, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const StockAndGalonPage = () => {
  const { companyId } = useAuth();
  const [products, setProducts] = useState([]);
  const [debts, setDebts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [movements, setMovements] = useState([]);
  const [manualMovements, setManualMovements] = useState([]);
  const [currentStock, setCurrentStock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStockTab, setActiveStockTab] = useState('summary');

  const [openDetail, setOpenDetail] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailData, setDetailData] = useState([]);
  
  const [newMovementForm, setNewMovementForm] = useState({
    type: 'masuk',
    qty: '',
    notes: '',
  });

  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  useEffect(() => {
    if (companyId) {
      fetchProducts();
    }
  }, [companyId]);

  useEffect(() => {
    if (selectedProductId) {
      fetchMovements(selectedProductId);
      const selectedProduct = products.find((p) => p.id === selectedProductId);
      if (selectedProduct && selectedProduct.is_returnable) {
        fetchGalonDebts(selectedProductId);
      } else {
        setDebts([]);
      }
    }
  }, [selectedProductId, products]);

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
      setProducts(data || []);
      if (data && data.length > 0) {
        setSelectedProductId(data[0].id);
      } else {
        setSelectedProductId(null);
      }
    }
    setLoading(false);
  };

  const fetchMovements = async (productId) => {
    setLoading(true);
    const { data: productData } = await supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();
    setCurrentStock(Number(productData?.stock || 0));

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
      const list = movementsData || [];
      setMovements(list);
      setManualMovements(list.filter((m) => m.type === 'masuk' || m.type === 'keluar'));
    }
    setLoading(false);
  };
  
  const fetchGalonDebts = async (productId) => {
  if (!productId) {
    console.error('Product ID is undefined, skipping fetch.');
    setDebts([]);
    setRefreshing(false);
    return;
  }
  setRefreshing(true);

  const { data, error } = await supabase
    .from('order_galon_items')
    .select(`
      order:order_id(
        id,
        created_at,
        delivered_at,
        customer:customer_id(id, name, phone),
        company_id
      ),
      product:product_id(id, name),
      returned_qty,
      borrowed_qty,
      purchased_empty_qty
    `)
    .or('borrowed_qty.gt.0,returned_qty.gt.0,purchased_empty_qty.gt.0')
    .eq('product_id', productId)
    .eq('order.company_id', companyId);

  if (error) {
    console.error('Error fetching galon debts:', error);
    toast.error('Gagal memuat data utang galon.');
    setDebts([]);
    setRefreshing(false);
    return;
  }

  // Group per customer → product + simpan event
  const grouped = (data || []).reduce((acc, row) => {
    const c = row.order.customer;
    const p = row.product;

    if (!acc[c.id]) {
      acc[c.id] = { id: c.id, name: c.name, phone: c.phone, products_debt: {} };
    }
    if (!acc[c.id].products_debt[p.id]) {
      acc[c.id].products_debt[p.id] = {
        product_id: p.id,
        product_name: p.name,
        total_borrowed_qty: 0,
        total_returned_qty: 0,
        total_purchased_qty: 0,
        _events: [],
        outstanding: 0,
      };
    }

    const pd = acc[c.id].products_debt[p.id];
    const borrowed = Number(row.borrowed_qty || 0);
    const returned = Number(row.returned_qty || 0);
    const purchased = Number(row.purchased_empty_qty || 0);

    pd.total_borrowed_qty += borrowed;
    pd.total_returned_qty += returned;
    pd.total_purchased_qty += purchased;

    pd._events.push({
      date: row.order.delivered_at || row.order.created_at || '',
      id: row.order.id,
      borrowed,
      returned,
      purchased,
    });

    return acc;
  }, {});

  // Fold kronologis: return dan purchased menutup utang
  Object.values(grouped).forEach((cust) => {
    Object.values(cust.products_debt).forEach((pd) => {
      pd._events.sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : 0;
        const tb = b.date ? new Date(b.date).getTime() : 0;
        if (ta !== tb) return ta - tb;
        return String(a.id).localeCompare(String(b.id)); // tie-breaker
      });
      let balance = 0;
      for (const ev of pd._events) {
        balance = Math.max(0, balance + ev.borrowed - ev.returned - ev.purchased);
      }
      pd.outstanding = balance;
      delete pd._events;
    });
  });

  setDebts(Object.values(grouped));
  setRefreshing(false);
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
      setDetailData(data || []);
      setOpenDetail(true);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const isReturnable = selectedProduct?.is_returnable;

  const toggleRow = (customerId) => {
    setExpandedCustomerId(expandedCustomerId === customerId ? null : customerId);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#10182b]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-8">
      <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
        <Package className="h-8 w-8" />
        Manajemen Stok & Utang Galon
      </h1>

      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center space-x-0 sm:space-x-4 space-y-2 sm:space-y-0">
          <CardTitle className="text-lg font-semibold text-[#10182b]">
            Pilih Produk
          </CardTitle>
          <Select
            id="product-select"
            value={selectedProductId || undefined}
            onValueChange={(val) => {
              setSelectedProductId(val);
              setActiveStockTab('summary');
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
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
        </CardHeader>
      </Card>
      
      <Tabs value={activeStockTab} onValueChange={(v) => setActiveStockTab(v)}>
        <TabsList className="w-full sm:w-auto grid grid-cols-2 bg-gray-100 text-[#10182b]">
          <TabsTrigger value="summary" className="data-[state=active]:bg-[#10182b] data-[state=active]:text-white data-[state=active]:shadow-sm">Ringkasan Stok</TabsTrigger>
          <TabsTrigger value="adjustment" className="data-[state=active]:bg-[#10182b] data-[state=active]:text-white data-[state=active]:shadow-sm">Penyesuaian Stok</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-[#10182b]">Stok Tersedia</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-[#10182b]">{currentStock}</p>
              </CardContent>
            </Card>
          </div>

          {isReturnable && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-[#10182b]">Ringkasan Galon Returnable</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-lg border bg-gray-50">
                    <h3 className="text-lg font-semibold text-[#10182b]">Dibeli (Galon Kosong)</h3>
                    <button
                      className="text-3xl font-bold text-purple-600 hover:underline"
                      onClick={() => fetchDetail('dibeli')}
                    >
                      {movements.filter((m) => m.type === 'galon_dibeli' || m.type === 'galon_dijual_ke_pusat').reduce((sum, m) => sum + Number(m.qty || 0), 0)}
                    </button>
                  </div>
                  <div className="p-4 rounded-lg border bg-gray-50">
                    <h3 className="text-lg font-semibold text-[#10182b]">Dikembalikan</h3>
                    <button
                      className="text-3xl font-bold text-green-600 hover:underline"
                      onClick={() => fetchDetail('dikembalikan')}
                    >
                      {movements.filter((m) => m.type === 'pengembalian' || m.type === 'galon_dikembalikan_ke_pusat').reduce((sum, m) => sum + Number(m.qty || 0), 0)}
                    </button>
                  </div>
                  <div className="p-4 rounded-lg border bg-gray-50">
                    <h3 className="text-lg font-semibold text-[#10182b]">Dipinjam</h3>
                    <button
                      className="text-3xl font-bold text-yellow-600 hover:underline"
                      onClick={() => fetchDetail('dipinjam')}
                    >
                      {movements.filter((m) => m.type === 'pinjam_kembali' || m.type === 'keluar_pinjam_dari_pusat').reduce((sum, m) => sum + Number(m.qty || 0), 0)}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isReturnable && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <CardTitle className="text-[#10182b]">Daftar Utang Galon Pelanggan</CardTitle>
                <Button onClick={() => fetchGalonDebts(selectedProductId)} disabled={loading || refreshing} variant="outline" className="text-[#10182b] hover:bg-gray-100">
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  <span className="ml-2">Refresh Data</span>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border-t overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px] text-[#10182b]">Pelanggan</TableHead>
                        <TableHead className="min-w-[150px] text-[#10182b]">Nomor Telepon</TableHead>
                        <TableHead className="min-w-[150px] text-[#10182b]">Galon Dipinjam</TableHead>
                        <TableHead className="min-w-[150px] text-[#10182b]">Galon Dikembalikan</TableHead>
                        <TableHead className="min-w-[150px] text-[#10182b]">Galon Dibeli</TableHead>
                        <TableHead className="min-w-[120px] text-[#10182b]">Sisa Utang</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debts.length > 0 ? (
                        debts.map((debt) => {
                          const pd = debt.products_debt[selectedProductId] || {
                            total_borrowed_qty: 0,
                            total_returned_qty: 0,
                            total_purchased_qty: 0,
                            outstanding: 0,
                          };
                          const isSettled = pd.outstanding === 0;

                          return (
                            <TableRow
                              key={debt.id}
                              className={`cursor-pointer ${isSettled ? 'bg-gray-100 text-gray-500 hover:bg-gray-100' : 'hover:bg-gray-50'}`}
                              onClick={() => toggleRow(debt.id)}
                            >
                              <TableCell className={`font-medium ${isSettled ? 'text-gray-500' : 'text-[#10182b]'}`}>
                                {debt.name}
                              </TableCell>
                              <TableCell>{debt.phone}</TableCell>
                              <TableCell>
                                <Badge className={`font-semibold ${isSettled ? 'bg-gray-300 text-gray-600' : 'bg-red-500 text-white'}`}>
                                  {pd.total_borrowed_qty} galon
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={`font-semibold ${isSettled ? 'bg-gray-300 text-gray-600' : 'bg-green-500 text-white'}`}>
                                  {pd.total_returned_qty} galon
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={`font-semibold ${isSettled ? 'bg-gray-300 text-gray-600' : 'bg-blue-500 text-white'}`}>
                                  {pd.total_purchased_qty} galon
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`${isSettled ? 'border-gray-300 text-gray-600' : 'border-red-300 text-red-700'}`}>
                                  {pd.outstanding} galon
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Tidak ada utang galon untuk produk ini.
                          </TableCell>
                        </TableRow>
                      )}

                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-[#10182b]">Log Semua Pergerakan Stok</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border-t overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px] text-[#10182b]">Tanggal</TableHead>
                      <TableHead className="text-[#10182b]">Produk</TableHead>
                      <TableHead className="text-[#10182b]">Jenis</TableHead>
                      <TableHead className="text-[#10182b]">Jumlah</TableHead>
                      <TableHead className="min-w-[200px] text-[#10182b]">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjustment" className="pt-4 space-y-6">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-[#10182b]">Penyesuaian Stok</CardTitle>
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
                <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#20283b]" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Catat Penyesuaian'}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-[#10182b]">Riwayat Penyesuaian Manual</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border-t overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px] text-[#10182b]">Tanggal</TableHead>
                      <TableHead className="text-[#10182b]">Produk</TableHead>
                      <TableHead className="text-[#10182b]">Jenis</TableHead>
                      <TableHead className="text-[#10182b]">Jumlah</TableHead>
                      <TableHead className="min-w-[200px] text-[#10182b]">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualMovements.map((m) => (
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
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={openDetail} onOpenChange={setOpenDetail}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#10182b]">{detailTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {detailData.length > 0 ? (
              detailData.map((d) => (
                <div key={d.id} className="p-2 border rounded-md">
                  <p className="font-medium">{d.customers?.name}</p>
                  <p className="text-sm text-gray-500">{d.customers?.phone}</p>
                  {d.returned_qty > 0 && <p>Dikembalikan: {d.returned_qty}</p>}
                  {d.borrowed_qty > 0 && <p>Dipinjam: {d.borrowed_qty}</p>}
                  {d.purchased_empty_qty > 0 && <p>Dibeli (Kosong): {d.purchased_empty_qty}</p>}
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