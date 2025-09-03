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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash, Send, Save } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const FinancialManagementPage = () => {
  const { companyId, userProfile, session } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: 'expense',
    amount: '',
    description: '',
    payment_method_id: '',
    proof: null,
  });
  const [paymentMethods, setPaymentMethods] = useState([]);

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
  }, [companyId]);
  
  const fetchData = async () => {
    setLoading(true);

    // Ambil riwayat transaksi dengan relasi ke payment_methods
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('financial_transactions')
      .select(`
        *,
        payment_method:payment_method_id (method_name)
      `)
      .eq('company_id', companyId)
      .order('transaction_date', { ascending: false });
    
    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      toast.error('Gagal memuat riwayat transaksi.');
    } else {
      setTransactions(transactionsData);
    }

    // Ambil metode pembayaran
    const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('id, method_name')
        .eq('company_id', companyId);
    
    if (!methodsError) {
        setPaymentMethods(methodsData);
    }
    
    setLoading(false);
  };
  
  const handleFormChange = (field, value) => {
    setNewTransaction(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    setNewTransaction(prev => ({ ...prev, proof: e.target.files[0] }));
  };
  
  const handleSubmitManualExpense = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { type, amount, description, payment_method_id, proof } = newTransaction;

    try {
      // Unggah bukti transfer jika ada
      let proofUrl = null;
      if (proof) {
        const fileExt = proof.name.split('.').pop();
        const filePath = `${companyId}/transactions/proofs/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('proofs')
          .upload(filePath, proof);

        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('proofs')
          .getPublicUrl(filePath);
        proofUrl = publicUrlData.publicUrl;
      }
      
      const { error: insertError } = await supabase
        .from('financial_transactions')
        .insert({
          company_id: companyId,
          type: 'expense',
          amount: parseFloat(amount),
          description: description,
          payment_method_id: payment_method_id,
          proof_url: proofUrl,
          source_table: 'manual_expense',
        });
        
      if (insertError) throw insertError;

      toast.success('Pengeluaran berhasil dicatat!');
      setNewTransaction({
        type: 'expense',
        amount: '',
        description: '',
        payment_method_id: '',
        proof: null,
      });
      fetchData();

    } catch (error) {
      console.error('Error submitting manual expense:', error);
      toast.error('Gagal mencatat pengeluaran: ' + error.message);
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
      <h1 className="text-2xl font-bold mb-6">Manajemen Keuangan</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Catat Pengeluaran Manual</CardTitle>
          <CardDescription>
            Input pengeluaran yang tidak terkait dengan order/delivery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitManualExpense} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Nominal</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Jumlah pengeluaran"
                  value={newTransaction.amount}
                  onChange={(e) => handleFormChange('amount', e.target.value)}
                  min="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_method_id">Metode Pembayaran</Label>
                <Select
                  value={newTransaction.payment_method_id}
                  onValueChange={(value) => handleFormChange('payment_method_id', value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.method_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Keperluan/Deskripsi</Label>
              <Input
                id="description"
                type="text"
                placeholder="Contoh: Pembelian alat tulis kantor"
                value={newTransaction.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="proof">Bukti Transfer/Pembayaran</Label>
              <Input
                id="proof"
                type="file"
                onChange={handleFileChange}
                accept="image/*"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Catat Pengeluaran'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
              <CardTitle>Riwayat Transaksi Keuangan</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="rounded-md border overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Tanggal</TableHead>
                              <TableHead>Tipe</TableHead>
                              <TableHead>Jumlah</TableHead>
                              <TableHead>Deskripsi</TableHead>
                              <TableHead>Metode</TableHead>
                              <TableHead>Bukti</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {transactions.map((t) => (
                              <TableRow key={t.id}>
                                  <TableCell>{new Date(t.transaction_date).toLocaleDateString()}</TableCell>
                                  <TableCell>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {t.type}
                                    </span>
                                  </TableCell>
                                  <TableCell>Rp{t.amount.toLocaleString('id-ID')}</TableCell>
                                  <TableCell>{t.description}</TableCell>
                                  <TableCell>{t.payment_method?.method_name || '-'}</TableCell>
                                  <TableCell>
                                    {t.proof_url ? (
                                      <a href={t.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                        Lihat Bukti
                                      </a>
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>
                              </TableRow>
                          ))}
                          {transactions.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                Belum ada riwayat transaksi.
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

export default FinancialManagementPage;