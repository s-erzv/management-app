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
import { Loader2, Package } from 'lucide-react';
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
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">Manajemen Utang Galon</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Daftar Utang Galon Pelanggan</CardTitle>
          <Button onClick={fetchGalonDebts}>Refresh Data</Button>
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
                          variant="secondary" 
                          size="sm" 
                          onClick={() => handleSettleDebt(debt.customer_id)}
                          disabled={loading}
                        >
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