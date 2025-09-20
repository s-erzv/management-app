import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, Box, Save, History, Filter, Package } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const UpdateStockPage = () => {
  const { companyId, userProfile, session } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualCounts, setManualCounts] = useState({});
  const [stockDifferences, setStockDifferences] = useState([]);
  const [reconciliationId, setReconciliationId] = useState(null);
  const [stockTypeToReconcile, setStockTypeToReconcile] = useState('product_stock'); 
  
  const canAdjustStock = userProfile?.role === 'admin' || userProfile?.role === 'super_admin' || userProfile?.role === 'user';

  useEffect(() => {
    if (companyId) {
      fetchCategories();
      fetchProducts();
      fetchReconciliationsHistory();
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchProducts();
    }
  }, [companyId, selectedCategory, stockTypeToReconcile]);

  
  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching categories:', error);
      toast.error('Gagal memuat kategori.');
    } else {
      setCategories(data);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('id, name, stock, empty_bottle_stock, is_returnable')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (selectedCategory !== 'all') {
      query = query.eq('category_id', selectedCategory);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal memuat data produk.');
      setProducts([]);
    } else {
      setProducts(data);
      const initialCounts = data.reduce((acc, product) => {
        acc[product.id] = '';
        return acc;
      }, {});

      setManualCounts(initialCounts);
    }
    setLoading(false);
  };
  
  const fetchReconciliationsHistory = async () => {
    const { data, error } = await supabase
      .from('stock_reconciliations')
      .select(`
        *,
        user:user_id(full_name)
      `)
      .eq('company_id', companyId)
      .order('reconciliation_date', { ascending: false });
      
    if (error) {
      console.error('Error fetching reconciliations:', error);
      toast.error('Gagal memuat riwayat update stok.');
      setReconciliations([]);
    } else {
      setReconciliations(data);
    }
  };

  const handleManualCountChange = (productId, value) => {
    setManualCounts(prev => ({
      ...prev,
      [productId]: value,
    }));
  };

  const handleReconcile = (e) => {
    e.preventDefault();
    const differences = products
      .filter(p => stockTypeToReconcile === 'product_stock' || p.is_returnable)
      .map(product => {
      const manualCount = parseFloat(manualCounts[product.id]) || 0;
      
      const systemStockValue = stockTypeToReconcile === 'product_stock' 
          ? parseFloat(product.stock) || 0
          : parseFloat(product.empty_bottle_stock) || 0;
          
      const difference = manualCount - systemStockValue;
      return {
        product_id: product.id,
        name: product.name,
        system_stock: systemStockValue,
        physical_count: manualCount,
        difference,
        stock_type: stockTypeToReconcile, 
      };
    });
    setStockDifferences(differences);
  };
  
  const handleAutomaticAdjustment = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        reconciliationItems: stockDifferences,
        companyId: companyId,
        userId: userProfile.id,
        stockType: stockTypeToReconcile, 
      };

      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/adjust-stock-reconciliation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform automatic adjustment.');
      }

      toast.success('Penyesuaian stok otomatis berhasil!');
      setStockDifferences([]);
      fetchProducts();
      fetchReconciliationsHistory();
    } catch (error) {
      console.error('Error during automatic adjustment:', error);
      toast.error('Gagal melakukan penyesuaian stok otomatis: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayProducts = products.filter(p => 
    stockTypeToReconcile === 'product_stock' 
      ? true 
      : p.is_returnable ?? true 
  );



  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    // Mengurangi padding horizontal di mobile (p-4)
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
      <h1 className="text-xl font-bold mb-3 text-[#10182b]">
        <Package className="h-5 w-5 mr-2 inline-block" />
        Update Stok Fisik
      </h1>
      <p className="text-sm text-muted-foreground mb-4">
        Periksa dan input jumlah stok fisik di gudang, lalu bandingkan dengan data di sistem.
      </p>

      <form onSubmit={handleReconcile}>
        <Card className="shadow-sm bg-white">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base text-[#10182b]">Input Stok Fisik</CardTitle>
            <CardDescription className="text-sm">
              Masukkan jumlah stok yang ada di gudang untuk setiap produk.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            {/* Filter & Kontrol: Dibuat Flex Col di Mobile */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
              
              {/* Filter Kategori - Full width di mobile */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                <Label className="text-sm font-medium text-gray-700">Filter Kategori:</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-full sm:w-[200px] text-sm">
                    <SelectValue placeholder="Semua Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pemilihan Tipe Stok - Full width di mobile */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                  <Label className="text-sm font-medium text-gray-700">Tipe Stok:</Label>
                  <Select
                      value={stockTypeToReconcile}
                      onValueChange={setStockTypeToReconcile}
                  >
                      <SelectTrigger className="w-full sm:w-[200px] text-sm">
                          <SelectValue placeholder="Stok Produk" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="product_stock">Stok Produk</SelectItem>
                          <SelectItem value="empty_bottle_stock">Stok Kemasan Returnable</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
            </div>

            {/* TABEL INPUT DAN STOK */}
            <div className="overflow-x-auto rounded-md border">
              <Table className="table-auto min-w-max">
                <TableHeader>
                  <TableRow className="text-xs md:text-sm bg-gray-50">
                    <TableHead className="min-w-[100px] text-[#10182b] font-semibold sticky left-0 bg-gray-50 z-10">Metrik</TableHead>
                    {displayProducts.map(product => (
                      // Lebar kolom dibuat lebih kecil
                      <TableHead className="min-w-[80px] text-center" key={product.id}>
                          <span className="truncate block max-w-[80px]">{product.name}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="text-xs md:text-sm">
                    <TableCell className="font-medium sticky left-0 bg-white z-10">Stok Sistem</TableCell>
                    {displayProducts.map(product => (
                      <TableCell key={product.id} className="text-center font-medium">
                        {/* Tampilkan Stok Sistem yang benar */}
                        {stockTypeToReconcile === 'product_stock' ? product.stock : product.empty_bottle_stock}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="text-xs md:text-sm">
                    <TableCell className="font-medium sticky left-0 bg-white z-10">Stok Fisik</TableCell>
                    {displayProducts.map(product => (
                      <TableCell key={product.id} className="p-1">
                        <Input
                          type="number"
                          placeholder="Jml"
                          value={manualCounts[product.id]}
                          onChange={(e) => handleManualCountChange(product.id, e.target.value)}
                          className="w-full max-w-[70px] text-center text-xs h-8"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  {stockDifferences.length > 0 && (
                    <TableRow className="text-xs md:text-sm">
                      <TableCell className="font-bold sticky left-0 bg-white z-10">Perbedaan</TableCell>
                      {stockDifferences.map(diff => (
                        <TableCell 
                          key={diff.product_id} 
                          className={`text-center font-bold ${diff.difference > 0 ? 'text-green-600' : diff.difference < 0 ? 'text-red-600' : ''}`}
                        >
                          {diff.difference > 0 ? `+${diff.difference}` : diff.difference}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Tombol Aksi - Full width di mobile */}
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90 text-sm">
                <Box className="h-4 w-4 mr-2" /> Bandingkan Stok
              </Button>
              {stockDifferences.length > 0 && canAdjustStock && (
                <Button onClick={handleAutomaticAdjustment} disabled={isSubmitting} variant="secondary" className="w-full sm:w-auto text-sm">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Sesuaikan Stok Otomatis
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
      
      {/* Riwayat Update Stok */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-[#10182b]"><History className="h-4 w-4" /> Riwayat Update Stok</h2>
        <Card className="shadow-sm bg-white">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base">Riwayat Update Stok</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto rounded-md border-t">
              <Table className="table-auto min-w-max">
                <TableHeader>
                  <TableRow className="text-xs md:text-sm bg-gray-50">
                    <TableHead className="min-w-[100px] sticky left-0 bg-gray-50 z-10">Tanggal</TableHead>
                    <TableHead className="min-w-[120px]">Dibuat Oleh</TableHead>
                    {products.map(product => (
                      <TableHead className="min-w-[80px] text-center" key={product.id}>
                        <span className="truncate block max-w-[80px]">{product.name}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliations.length > 0 ? (
                    reconciliations.map(rec => (
                      <TableRow key={rec.id} className="text-xs md:text-sm">
                        <TableCell className="whitespace-nowrap sticky left-0 bg-white z-10">{new Date(rec.reconciliation_date).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell className="whitespace-nowrap">{rec.user?.full_name ?? 'N/A'}</TableCell>
                        {products.map(product => {
                          const item = rec.items.find(i => i.product_id === product.id);
                          if (!item) return <TableCell key={product.id}>-</TableCell>;
                          const cellClass = item.difference > 0 ? 'text-green-600 font-semibold' : item.difference < 0 ? 'text-red-600 font-semibold' : 'text-gray-500';
                          // Tampilkan (diff) hanya jika ada perbedaan
                          const diffDisplay = item.difference !== 0 ? ` (${item.difference > 0 ? `+${item.difference}` : item.difference})` : '';
                          const displayValue = `${item.physical_count}${diffDisplay}`;
                          return <TableCell key={product.id} className={cellClass + ' text-center'}>{displayValue}</TableCell>;
                        })}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={products.length + 2} className="text-center text-muted-foreground py-8 text-sm">
                        Belum ada riwayat update stok.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UpdateStockPage;