// src/pages/GalonDebtPage.jsx
import { useEffect, useState } from 'react';
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
import { Loader2, Package, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const GalonDebtPage = () => {
  const { companyId } = useAuth();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      fetchGalonDebts();
      
      const channel = supabase
        .channel('galon_debt_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          console.log('Change received!', payload);
          fetchGalonDebts(); // Refresh data saat ada perubahan
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [companyId]);

  const fetchGalonDebts = async () => {
    setLoading(true);
    
    // Menggunakan RPC (Remote Procedure Call) untuk menghitung total utang galon per pelanggan
    const { data, error } = await supabase.rpc('get_customer_galon_debt', { p_company_id: companyId });

    if (error) {
      console.error('Error fetching galon debts:', error);
      toast.error('Gagal memuat data utang galon.');
    } else {
      setDebts(data);
    }
    setLoading(false);
  };
  
  const handleSettleDebt = async (customerId) => {
    if (!window.confirm('Apakah Anda yakin ingin menandai utang galon ini sebagai lunas? Tindakan ini tidak dapat diurungkan.')) {
      return;
    }
    
    setLoading(true);
    // Menggunakan RPC untuk memperbarui status utang galon
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
        Manajemen Utang Galon
      </h1>

      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-[#10182b]">Daftar Utang Galon Pelanggan</CardTitle>
          <Button onClick={fetchGalonDebts} disabled={loading} variant="outline" className="text-[#10182b] hover:bg-gray-100">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border-t overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#10182b]">Pelanggan</TableHead>
                  <TableHead className="text-[#10182b]">Nomor Telepon</TableHead>
                  <TableHead className="text-[#10182b]">Jumlah Galon Dipinjam</TableHead>
                  <TableHead className="w-[120px] text-[#10182b]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.length > 0 ? (
                  debts.map((debt) => (
                    <TableRow key={debt.customer_id}>
                      <TableCell className="font-medium text-[#10182b]">{debt.customer_name}</TableCell>
                      <TableCell>{debt.customer_phone}</TableCell>
                      <TableCell>{debt.total_borrowed_qty}</TableCell>
                      <TableCell>
                        <Button 
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
    </div>
  );
};

export default GalonDebtPage;