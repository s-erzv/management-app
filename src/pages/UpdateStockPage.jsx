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
import { Loader2, Box, Save, History } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const UpdateStockPage = () => {
  const { companyId, userProfile, session } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualCounts, setManualCounts] = useState({});
  const [stockDifferences, setStockDifferences] = useState([]);
  const [reconciliationId, setReconciliationId] = useState(null);

  useEffect(() => {
    if (companyId) {
      fetchProducts();
      fetchReconciliationsHistory();
    }
  }, [companyId]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

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
    const differences = products.map(product => {
      const manualCount = parseFloat(manualCounts[product.id]) || 0;
      const systemStock = parseFloat(product.stock) || 0;
      const difference = manualCount - systemStock;
      return {
        product_id: product.id,
        name: product.name,
        system_stock: systemStock,
        physical_count: manualCount,
        difference,
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">Update Stok</h1>
      <p className="text-muted-foreground mb-4">
        Periksa dan input jumlah stok fisik di gudang, lalu bandingkan dengan data di sistem.
      </p>

      <form onSubmit={handleReconcile}>
        <Card className="overflow-x-auto mb-6">
          <CardHeader>
            <CardTitle>Input Stok Fisik</CardTitle>
            <CardDescription>
              Masukkan jumlah stok yang ada di gudang untuk setiap produk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Metrik</TableHead>
                    {products.map(product => (
                      <TableHead key={product.id}>{product.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Stok Sistem</TableCell>
                    {products.map(product => (
                      <TableCell key={product.id}>{product.stock}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Stok Fisik</TableCell>
                    {products.map(product => (
                      <TableCell key={product.id}>
                        <Input
                          type="number"
                          placeholder="Jumlah"
                          value={manualCounts[product.id]}
                          onChange={(e) => handleManualCountChange(product.id, e.target.value)}
                          min="0"
                          className="max-w-[100px]"
                          required
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  {stockDifferences.length > 0 && (
                    <TableRow>
                      <TableCell className="font-medium">Perbedaan</TableCell>
                      {stockDifferences.map(diff => (
                        <TableCell key={diff.product_id} className={diff.difference > 0 ? 'text-green-600 font-semibold' : diff.difference < 0 ? 'text-red-600 font-semibold' : ''}>
                          {diff.difference > 0 ? `+${diff.difference}` : diff.difference}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90">
                <Box className="h-4 w-4 mr-2" /> Bandingkan Stok
              </Button>
              {stockDifferences.length > 0 && (
                <Button onClick={handleAutomaticAdjustment} disabled={isSubmitting} variant="secondary" className="w-full sm:w-auto">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Sesuaikan Stok Otomatis
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
      
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><History className="h-5 w-5" /> Riwayat Update Stok</h2>
        <Card className="overflow-x-auto">
          <CardHeader>
            <CardTitle>Riwayat Update Stok</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Tanggal</TableHead>
                    <TableHead className="min-w-[150px]">Dibuat Oleh</TableHead>
                    {products.map(product => (
                      <TableHead key={product.id}>{product.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliations.length > 0 ? (
                    reconciliations.map(rec => (
                      <TableRow key={rec.id}>
                        <TableCell>{new Date(rec.reconciliation_date).toLocaleDateString()}</TableCell>
                        <TableCell>{rec.user?.full_name ?? 'N/A'}</TableCell>
                        {products.map(product => {
                          const item = rec.items.find(i => i.product_id === product.id);
                          if (!item) return <TableCell key={product.id}>-</TableCell>;
                          const cellClass = item.difference > 0 ? 'text-green-600 font-semibold' : item.difference < 0 ? 'text-red-600 font-semibold' : 'text-gray-500';
                          const displayValue = `${item.physical_count} (${item.difference > 0 ? `+${item.difference}` : item.difference})`;
                          return <TableCell key={product.id} className={cellClass}>{displayValue}</TableCell>;
                        })}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={products.length + 2} className="text-center text-muted-foreground py-8">
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