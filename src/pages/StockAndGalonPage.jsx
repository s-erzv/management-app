import { useEffect, useState, useMemo } from 'react';
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
import { Label } from '@/components/ui/label';

const StockAndGalonPage = () => {
  const { companyId } = useAuth();
  const [products, setProducts] = useState([]);
  const [debts, setDebts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [movements, setMovements] = useState([]);
  const [manualMovements, setManualMovements] = useState([]);
  
  const [currentProductStock, setCurrentProductStock] = useState(0);
  const [currentEmptyBottleStock, setCurrentEmptyBottleStock] = useState(0);

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
    movement_for: 'product_stock',
  });

  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  useEffect(() => {
    if (companyId) {
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (selectedProductId) {
      fetchStockValues(selectedProductId);
      fetchMovements(selectedProductId);
      const selectedProduct = products.find((p) => p.id === selectedProductId);
      if (selectedProduct && selectedProduct.is_returnable) {
        fetchGalonDebts(selectedProductId);
      } else {
        setDebts([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, products]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, is_returnable, empty_bottle_stock')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
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
  
  const fetchStockValues = async (productId) => {
    const { data, error } = await supabase
      .from('products')
      .select('stock, empty_bottle_stock')
      .eq('id', productId)
      .single();
    
    if (error) {
        console.error('Error fetching stock values:', error);
        setCurrentProductStock(0);
        setCurrentEmptyBottleStock(0);
    } else {
        setCurrentProductStock(Number(data?.stock || 0));
        setCurrentEmptyBottleStock(Number(data?.empty_bottle_stock || 0));
    }
  };

  const fetchMovements = async (productId) => {
    setLoading(true);
    const { data: movementsData, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        products (name),
        orders (id, customers(name, phone))
      `)
      .eq('product_id', productId)
      .order('movement_date', { ascending: false });

    if (error) {
      console.error('Error fetching movements:', error);
      toast.error('Gagal memuat data pergerakan stok.');
    } else {
      const list = movementsData || [];
      setMovements(list);
      setManualMovements(list.filter((m) => m.type === 'masuk' || m.type === 'keluar' || m.type === 'penyesuaian_stok'));
    }
    setLoading(false);
  };
  
  const fetchGalonDebts = async (productId) => { 
    if (!productId) {
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
          order_items(qty, product_id)
        ),
        product:product_id(id, name),
        returned_qty,
        borrowed_qty,
        purchased_empty_qty
      `)
      .eq('product_id', productId) 
      .eq('order.company_id', companyId)
      .or('borrowed_qty.gt.0,returned_qty.gt.0,purchased_empty_qty.gt.0');

    if (error) {
      console.error('Error fetching Product Returnable debts:', error);
      toast.error('Gagal memuat data utang Product Returnable.');
      setDebts([]);
      setRefreshing(false);
      return;
    }

    const grouped = (data || []).reduce((acc, row) => {
        const customerId = row.order.customer.id;
        const customerName = row.order.customer.name;
        const customerPhone = row.order.customer.phone;
        const prodId = row.product.id;
        const productName = row.product.name;
        
        // Dapatkan kuantitas produk yang dipesan (`orderedQty`)
        const orderedItem = Array.isArray(row.order.order_items) 
            ? row.order.order_items.find(item => item.product_id === prodId)
            : row.order.order_items;
        
        const orderedQty = Number(orderedItem?.qty || 0);

        if (!acc[customerId]) {
            acc[customerId] = {
                id: customerId,
                name: customerName,
                phone: customerPhone,
                products_debt: {},
                total_debt: 0,
            };
        }
        if (!acc[customerId].products_debt[prodId]) {
            acc[customerId].products_debt[prodId] = {
                product_id: prodId,
                product_name: productName,
                _events: [],
                outstanding: 0,
            };
        }

        const pd = acc[customerId].products_debt[prodId];
        const returned = Number(row.returned_qty || 0);
        const purchased = Number(row.purchased_empty_qty || 0);
        
        // HITUNG PERUBAHAN UTANG NETTO
        const netCustomerSupply = returned + purchased;
        const netChange = orderedQty - netCustomerSupply; 
        
        let netDebtChange = 0;
        
        if (netChange > 0) {
            netDebtChange = netChange; 
        } else if (netChange < 0) {
            netDebtChange = netChange; 
        }
        
        pd._events.push({
            date: row.order.delivered_at || row.order.created_at || '',
            id: row.order.id,
            net_change: netDebtChange,
        });

        return acc;
    }, {});
    
    // --- AKUMULASI UTANG DAN CLAMPING ---
    const finalDebts = [];

    Object.values(grouped).forEach((cust) => {
        let cumulativeDebtForCustomer = 0; 
        Object.values(cust.products_debt).forEach((pd) => {
            // Urutkan events secara kronologis
            pd._events.sort((a, b) => {
                const ta = a.date ? new Date(a.date).getTime() : 0;
                const tb = b.date ? new Date(b.date).getTime() : 0;
                if (ta !== tb) return ta - tb;
                return String(a.id).localeCompare(String(b.id)); 
            });
            
            let balance = 0;
            for (const ev of pd._events) {
                balance += ev.net_change; 
                // CLAMPING: Utang tidak pernah boleh negatif.
                balance = Math.max(0, balance);
            }
            
            pd.outstanding = balance;
            cumulativeDebtForCustomer += pd.outstanding;
            
            delete pd._events;
        });

        cust.total_debt = cumulativeDebtForCustomer;
        
        // Filter hanya pelanggan dengan utang > 0
        if (cust.total_debt > 0) {
             finalDebts.push(cust);
        }
    });

    setDebts(finalDebts);
    setRefreshing(false);
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewMovementForm({ ...newMovementForm, [name]: value });
  };
  
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { type, qty, notes, movement_for } = newMovementForm;
    const qtyValue = parseFloat(qty);
    
    if (movement_for === 'product_stock') {
      const { error: rpcError } = await supabase.rpc('update_product_stock', {
        product_id: selectedProductId,
        qty_to_add: type === 'masuk' ? qtyValue : -qtyValue,
      });

      if (rpcError) {
        console.error('Error updating product stock:', rpcError);
        toast.error('Gagal memperbarui stok produk.');
        setLoading(false);
        return;
      }
      
    } else { // movement_for === 'empty_bottle_stock'
      const { error: rpcError } = await supabase.rpc('update_empty_bottle_stock', {
        product_id: selectedProductId,
        qty_to_add: type === 'masuk' ? qtyValue : -qtyValue,
      });
      
      if (rpcError) {
        console.error('Error updating empty bottle stock:', rpcError);
        toast.error('Gagal memperbarui stok Kemasan Returnable.');
        setLoading(false);
        return;
      }
    }

    const { error: insertError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: selectedProductId,
        qty: qtyValue,
        type: type === 'masuk' ? 'masuk' : 'keluar',
        notes: `Penyesuaian manual: ${notes}`,
        company_id: companyId,
      });
    
    if (insertError) {
      console.error('Error adding movement:', insertError);
      toast.error('Gagal mencatat pergerakan stok.');
    } else {
      toast.success('Penyesuaian stok berhasil dicatat!');
      setNewMovementForm({ type: 'masuk', qty: '', notes: '', movement_for: 'product_stock' });
      fetchProducts();
    }
    setLoading(false);
  };
  
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const isReturnable = selectedProduct?.is_returnable;

  const toggleRow = (customerId) => {
    setExpandedCustomerId(expandedCustomerId === customerId ? null : customerId);
  };
  
  const galonMovements = useMemo(() => {
    if (!isReturnable) return {};
    const movementsByType = movements.reduce((acc, m) => {
      const type = m.type;
      if (!acc[type]) {
        acc[type] = 0;
      }
      acc[type] += Number(m.qty || 0);
      return acc;
    }, {});
    
    return {
      returnedFromCustomer: movementsByType['pengembalian'] || 0,
      purchasedFromCustomer: (movementsByType['galon_dibeli'] || 0),
      borrowed: (movementsByType['pinjam_kembali'] || 0) + (movementsByType['keluar_pinjam_dari_pusat'] || 0),
    };
  }, [movements, isReturnable]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#10182b]" />
      </div>
    );
  }

  return (
    // Mengurangi padding horizontal di mobile (p-4)
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
      {/* Mengurangi ukuran font judul di mobile */}
      <h1 className="text-2xl font-bold text-[#10182b] flex items-center gap-2">
        <Package className="h-6 w-6 md:h-8 md:w-8" />
        Manajemen Stok
      </h1>

      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center space-x-0 sm:space-x-4 space-y-2 sm:space-y-0 p-4 md:p-6">
          <CardTitle className="text-base font-semibold text-[#10182b] flex-shrink-0">
            Pilih Produk:
          </CardTitle>
          <Select
            id="product-select"
            value={selectedProductId || undefined}
            onValueChange={(val) => {
              setSelectedProductId(val);
              setActiveStockTab('summary');
            }}
          >
            <SelectTrigger className="w-full sm:w-[250px] text-sm">
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
        {/* Tabs List agar full width di mobile */}
        <TabsList className="w-full grid grid-cols-2 bg-gray-100 text-[#10182b]">
          <TabsTrigger value="summary" className="text-sm data-[state=active]:bg-[#10182b] data-[state=active]:text-white data-[state=active]:shadow-sm">Ringkasan Stok</TabsTrigger>
          <TabsTrigger value="adjustment" className="text-sm data-[state=active]:bg-[#10182b] data-[state=active]:text-white data-[state=active]:shadow-sm">Penyesuaian</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="pt-4 space-y-6">
          {/* Mengubah grid menjadi 1 kolom di mobile dan 2 di md */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="p-4">
                <CardTitle className="text-base text-[#10182b]">Stok Produk (Siap Jual)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-3xl font-bold text-[#10182b]">{currentProductStock}</p>
              </CardContent>
            </Card>
            {isReturnable && (
                <Card className="border-0 shadow-sm bg-white">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base text-[#10182b]">Stok Kemasan Kosong</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-3xl font-bold text-gray-500">{currentEmptyBottleStock}</p>
                  </CardContent>
                </Card>
            )}
          </div>

          {isReturnable && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="p-4">
                <CardTitle className="text-base text-[#10182b]">Ringkasan Product Returnable</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {/* Mengubah grid menjadi 1 kolom di mobile dan 3 di sm */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <h3 className="text-sm font-semibold text-[#10182b] mb-1">Diterima</h3>
                    <p className="text-2xl font-bold text-green-600">
                      {galonMovements.returnedFromCustomer}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <h3 className="text-sm font-semibold text-[#10182b] mb-1">Dibeli</h3>
                    <p className="text-2xl font-bold text-purple-600">
                      {galonMovements.purchasedFromCustomer}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <h3 className="text-sm font-semibold text-[#10182b] mb-1">Dipinjam</h3>
                    <p className="text-2xl font-bold text-yellow-600">
                      {galonMovements.borrowed}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isReturnable && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 md:p-6">
                <CardTitle className="text-base text-[#10182b]">Daftar Utang Kemasan Pelanggan</CardTitle>
                <Button 
                  onClick={() => fetchGalonDebts(selectedProductId)} 
                  disabled={loading || refreshing} 
                  variant="outline" 
                  className="w-full sm:w-auto text-[#10182b] hover:bg-gray-100 text-sm"
                >
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-md border-t overflow-x-auto">
                  <Table className="min-w-max">
                    <TableHeader>
                      <TableRow className="text-xs md:text-sm">
                        <TableHead className="min-w-[120px] text-[#10182b]">Pelanggan</TableHead>
                        <TableHead className="min-w-[100px] text-[#10182b]">Telepon</TableHead>
                        <TableHead className="min-w-[80px] text-[#10182b]">Utang</TableHead>
                        <TableHead className="min-w-[80px] text-[#10182b]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {debts.length > 0 ? (
                            debts.map((debt) => {
                                const pd = debt.products_debt[selectedProductId];
                                
                                if (!pd) {
                                    return null;
                                }

                                const isSettled = pd.outstanding <= 0;
                                
                                return (
                                    <TableRow
                                        key={debt.id}
                                        className={`${isSettled ? 'bg-gray-100 text-gray-500 text-xs' : 'cursor-pointer hover:bg-gray-50 text-xs'}`}
                                    >
                                        <TableCell className={`font-medium ${isSettled ? 'text-gray-500' : 'text-[#10182b]'}`}>
                                            {debt.name}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">{debt.phone}</TableCell>
                                        <TableCell>
                                            <Badge 
                                              variant="outline" 
                                              className={`text-xs whitespace-nowrap ${isSettled ? 'border-gray-300 text-gray-600' : 'border-red-300 text-red-700 bg-red-100'}`}
                                            >
                                                {pd.outstanding}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={isSettled ? "outline" : "destructive"} className="text-xs whitespace-nowrap">
                                                {isSettled ? "Lunas" : "Belum Lunas"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                                    Tidak ada utang kemasan untuk produk ini.
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
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base text-[#10182b]">Log Semua Pergerakan Stok</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border-t overflow-x-auto">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow className="text-xs md:text-sm">
                      <TableHead className="min-w-[100px] text-[#10182b]">Tanggal</TableHead>
                      <TableHead className="min-w-[120px] text-[#10182b]">Produk</TableHead>
                      <TableHead className="min-w-[80px] text-[#10182b]">Jenis</TableHead>
                      <TableHead className="min-w-[60px] text-[#10182b]">Jumlah</TableHead>
                      <TableHead className="min-w-[150px] text-[#10182b]">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id} className="text-xs md:text-sm">
                        <TableCell className="whitespace-nowrap">{new Date(m.movement_date).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell className="whitespace-nowrap">{m.products?.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{m.type || m.item_type}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{m.qty}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{m.notes}</TableCell>
                      </TableRow>
                    ))}
                    {movements.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
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
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base text-[#10182b]">Penyesuaian Stok</CardTitle>
              <CardDescription className="text-sm">
                Tambahkan stok masuk atau keluar secara manual.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="movement-for">Stok yang Disesuaikan</Label>
                  <Select
                    value={newMovementForm.movement_for}
                    onValueChange={(val) => setNewMovementForm({ ...newMovementForm, movement_for: val })}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Pilih Jenis Stok" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product_stock">Stok Produk</SelectItem>
                      {isReturnable && <SelectItem value="empty_bottle_stock">Stok Kemasan Returnable</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-type">Jenis Pergerakan</Label>
                  <Select
                    value={newMovementForm.type}
                    onValueChange={(val) => setNewMovementForm({ ...newMovementForm, type: val })}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Pilih Jenis Pergerakan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masuk">Stok Masuk</SelectItem>
                      <SelectItem value="keluar">Stok Keluar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-qty">Jumlah</Label>
                  <Input
                    type="number"
                    id="movement-qty"
                    name="qty"
                    placeholder="Jumlah Stok"
                    value={newMovementForm.qty}
                    onChange={handleInputChange}
                    required
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-notes">Catatan</Label>
                  <Input
                    id="movement-notes"
                    name="notes"
                    placeholder="Catatan (Opsional)"
                    value={newMovementForm.notes}
                    onChange={handleInputChange}
                    className="text-sm"
                  />
                </div>
                <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#20283b] text-sm" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Catat Penyesuaian'}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base text-[#10182b]">Riwayat Penyesuaian Manual</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border-t overflow-x-auto">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow className="text-xs md:text-sm">
                      <TableHead className="min-w-[100px] text-[#10182b]">Tanggal</TableHead>
                      <TableHead className="min-w-[120px] text-[#10182b]">Produk</TableHead>
                      <TableHead className="min-w-[80px] text-[#10182b]">Jenis</TableHead>
                      <TableHead className="min-w-[60px] text-[#10182b]">Jumlah</TableHead>
                      <TableHead className="min-w-[150px] text-[#10182b]">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualMovements.map((m) => (
                      <TableRow key={m.id} className="text-xs md:text-sm">
                        <TableCell className="whitespace-nowrap">{new Date(m.movement_date).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell className="whitespace-nowrap">{m.products?.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{m.type}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{m.qty}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{m.notes}</TableCell>
                      </TableRow>
                    ))}
                    {manualMovements.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
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
    </div>
  );
};

export default StockAndGalonPage;