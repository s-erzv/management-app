import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Loader2, Package, RefreshCw, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Fungsi untuk menghitung sisa utang galon
const calculateRemainingDebt = (delivered, returned, purchased) => {
  return delivered - returned - purchased;
};

const GalonDebtPage = () => {
  const { companyId } = useAuth();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  useEffect(() => {
    if (companyId) {
      fetchGalonDebts();
      
      const channel = supabase
        .channel('galon_debt_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_galon_items' }, () => {
          fetchGalonDebts();
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [companyId]);

  const fetchGalonDebts = async () => {
    setLoading(true);
    setRefreshing(true);
    
    // Query baru yang lebih efisien, langsung mengambil data dari order_galon_items
    const { data, error } = await supabase
      .from('order_galon_items')
      .select(`
        order:order_id(
          customer:customer_id(id, name, phone)
        ),
        product:product_id(id, name),
        borrowed_qty
      `)
      .gt('borrowed_qty', 0) // Perbaikan: Filter utang yang lebih dari 0
      .eq('order.company_id', companyId); // Perbaikan: Tambah filter company_id

    if (error) {
      console.error('Error fetching Product Returnable debts:', error);
      toast.error('Gagal memuat data utang Product Returnable.');
      setDebts([]);
    } else {
        // Kelompokkan data per pelanggan dan per produk di frontend
        const groupedDebts = data.reduce((acc, row) => {
            const customerId = row.order.customer.id;
            const customerName = row.order.customer.name;
            const customerPhone = row.order.customer.phone;
            const productId = row.product.id;
            const productName = row.product.name;
            const borrowedQty = row.borrowed_qty;

            if (!acc[customerId]) {
                acc[customerId] = {
                    id: customerId,
                    name: customerName,
                    phone: customerPhone,
                    products_debt: {},
                    total_debt: 0,
                };
            }
            if (!acc[customerId].products_debt[productId]) {
                acc[customerId].products_debt[productId] = {
                    product_id: productId,
                    product_name: productName,
                    total_debt_qty: 0,
                };
            }
            acc[customerId].products_debt[productId].total_debt_qty += borrowedQty;
            acc[customerId].total_debt += borrowedQty;
            return acc;
        }, {});
        
        setDebts(Object.values(groupedDebts));
    }
    setLoading(false);
    setRefreshing(false);
  };
  
  const handleSettleDebt = async (customerId) => {
    if (!window.confirm('Apakah Anda yakin ingin menandai utang Product Returnable ini sebagai lunas? Tindakan ini tidak dapat diurungkan.')) {
      return;
    }
    
    setLoading(true);
    // Menggunakan RPC untuk memperbarui status utang galon
    const { error } = await supabase.rpc('settle_galon_debt', { p_customer_id: customerId });
    
    if (error) {
      console.error('Error settling debt:', error);
      toast.error('Gagal melunasi utang Product Returnable.');
    } else {
      toast.success('Utang Product Returnable berhasil dilunasi!');
      fetchGalonDebts();
    }
    setLoading(false);
  };
  
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
        Manajemen Utang Product Returnable
      </h1>

      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-[#10182b]">Daftar Utang Product Returnable Pelanggan</CardTitle>
          <Button onClick={fetchGalonDebts} disabled={loading || refreshing} variant="outline" className="text-[#10182b] hover:bg-gray-100">
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
                  <TableHead className="min-w-[150px] text-[#10182b]">Total Utang Product Returnable</TableHead>
                  <TableHead className="min-w-[120px] text-[#10182b]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.length > 0 ? (
                  debts.map((debt) => (
                    <>
                      <TableRow key={debt.id} className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRow(debt.id)}>
                        <TableCell className="font-medium text-[#10182b] flex items-center gap-2">
                          {expandedCustomerId === debt.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {debt.name}
                        </TableCell>
                        <TableCell>{debt.phone}</TableCell>
                        <TableCell>
                           <Badge variant="destructive" className="bg-red-500 text-white font-semibold">
                             {debt.total_debt} Product Returnable
                           </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); handleSettleDebt(debt.id); }}
                            disabled={loading}
                            className="bg-green-500 text-white hover:bg-green-600"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Lunas
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedCustomerId === debt.id && (
                        <TableRow>
                          <TableCell colSpan={4} className="p-4 bg-gray-100 border-l-2 border-l-[#10182b]">
                            <h4 className="font-semibold text-[#10182b] mb-2">Rincian Utang</h4>
                            <div className="space-y-1 text-sm">
                              {Object.values(debt.products_debt).map(productDebt => (
                                <div key={productDebt.product_id} className="flex justify-between items-center py-1">
                                  <span className="font-medium">{productDebt.product_name}</span>
                                  <Badge className="bg-red-500 text-white">{productDebt.total_debt_qty} Product Returnable</Badge>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Tidak ada utang Product Returnable saat ini.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GalonDebtPage;