// src/pages/FinancialManagementPage.jsx

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
import { Loader2, Plus, Trash, Eye, FileText, PiggyBank, TrendingUp, TrendingDown, Download, ListOrdered, ReceiptText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const FinancialManagementPage = () => {
  const { companyId, userProfile, session } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('expense');
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

    const [
      { data: manualTransactions, error: manualTransactionsError },
      { data: orderPayments, error: orderPaymentsError },
      { data: expenseReports, error: expenseReportsError },
      { data: allPaymentMethods, error: methodsError },
    ] = await Promise.all([
      // Perubahan di sini: Kecualikan transaksi yang berasal dari 'orders'
      supabase.from('financial_transactions')
        .select(`*, payment_method:payment_method_id (method_name, account_name, type)`)
        .eq('company_id', companyId)
        .neq('source_table', 'orders')
        .order('transaction_date', { ascending: false }),
      supabase.from('payments')
        .select(`*, payment_method:payment_method_id (method_name, account_name, type), orders:order_id(invoice_number, customers(name))`)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase.from('expense_reports')
        .select(`*, user:user_id(full_name)`)
        .eq('company_id', companyId)
        .eq('status', 'paid') 
        .order('report_date', { ascending: false }),
      supabase.from('payment_methods')
        .select('id, method_name, account_name, type')
        .eq('company_id', companyId),
    ]);

    if (manualTransactionsError || orderPaymentsError || expenseReportsError || methodsError) {
      console.error('Error fetching all financial data:', { manualTransactionsError, orderPaymentsError, expenseReportsError, methodsError });
      toast.error('Gagal memuat riwayat transaksi keuangan.');
    } else {
      setPaymentMethods(allPaymentMethods);

      const combinedTransactions = [];

      manualTransactions.forEach(t => {
        combinedTransactions.push({
          id: t.id,
          date: t.transaction_date,
          type: t.type,
          amount: t.amount,
          description: t.description,
          method: t.payment_method?.method_name || '-',
          methodType: t.payment_method?.type || '-',
          account: t.payment_method?.account_name || '-',
          source: t.source_table === 'manual_transaction' ? 'Manual' : 'Biaya Transportasi',
          proofUrl: t.proof_url,
        });
      });

      orderPayments.forEach(p => {
        combinedTransactions.push({
          id: p.id,
          date: p.paid_at,
          type: 'income',
          amount: p.amount,
          description: `Pembayaran pesanan #${p.orders?.invoice_number}`,
          method: p.payment_method?.method_name || '-',
          methodType: p.payment_method?.type || '-',
          account: p.payment_method?.account_name || '-',
          source: `Order #${p.orders?.invoice_number}`,
          proofUrl: p.proof_url,
        });
      });

      expenseReports.forEach(e => {
        const matchingMethod = allPaymentMethods.find(m => m.method_name === e.payment_method);
        combinedTransactions.push({
          id: e.id,
          date: e.report_date,
          type: 'expense',
          amount: e.total_amount,
          description: `Reimbursement untuk ${e.user?.full_name}`,
          method: method?.method_name || e.payment_method,
          methodType: method?.type || '-',
          account: method?.account_name || '-',
          source: 'Laporan Pengeluaran',
          proofUrl: null, 
        });
      });

      combinedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(combinedTransactions);
    }
    
    setLoading(false);
  };
  
  const handleFormChange = (field, value) => {
    setNewTransaction(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    setNewTransaction(prev => ({ ...prev, proof: e.target.files[0] }));
  };
  
  const handleTabChange = (value) => {
      setActiveTab(value);
      setNewTransaction({
          type: value,
          amount: '',
          description: '',
          payment_method_id: '',
          proof: null,
      });
  };

  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { type, amount, description, payment_method_id, proof } = newTransaction;

    try {
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
          type: type,
          amount: parseFloat(amount),
          description: description,
          payment_method_id: payment_method_id,
          proof_url: proofUrl,
          source_table: 'manual_transaction',
        });
        
      if (insertError) throw insertError;

      toast.success(`${type === 'income' ? 'Pemasukan' : 'Pengeluaran'} berhasil dicatat!`);
      setNewTransaction({
        type: activeTab,
        amount: '',
        description: '',
        payment_method_id: '',
        proof: null,
      });
      fetchData();

    } catch (error) {
      console.error('Error submitting manual expense:', error);
      toast.error('Gagal mencatat transaksi: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#10182b]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <PiggyBank className="h-6 w-6 text-[#10182b]" />
        Manajemen Keuangan
      </h1>

      <Card className="mb-8 border-0 shadow-lg bg-white">
        <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
          <CardTitle className="text-xl flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Catat Transaksi Manual
          </CardTitle>
          <CardDescription className="text-gray-200">
            Input pengeluaran atau pemasukan yang tidak terkait dengan order.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 lg:p-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense" className="gap-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white">
                <TrendingDown className="h-4 w-4" /> Pengeluaran
              </TabsTrigger>
              <TabsTrigger value="income" className="gap-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white">
                <TrendingUp className="h-4 w-4" /> Pemasukan
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmitTransaction} className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Nominal</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Jumlah transaksi"
                  value={newTransaction.amount}
                  onChange={(e) => handleFormChange('amount', e.target.value)}
                  
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

            <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Catat Transaksi'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-gray-100 to-gray-50 rounded-t-lg border-b">
              <CardTitle className="text-xl text-[#10182b] flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Riwayat Transaksi Keuangan
              </CardTitle>
          </CardHeader>
          <CardContent className="p-4 lg:p-6">
              <div className="rounded-md border overflow-x-auto max-h-96">
                  <Table>
                      <TableHeader>
                          <TableRow className="bg-gray-50">
                              <TableHead className="min-w-[120px]">Tanggal</TableHead>
                              <TableHead className="min-w-[100px]">Tipe</TableHead>
                              <TableHead className="min-w-[150px]">Jumlah</TableHead>
                              <TableHead className="min-w-[200px]">Deskripsi</TableHead>
                              <TableHead className="min-w-[150px]">Metode</TableHead>
                              <TableHead className="min-w-[150px]">Sumber</TableHead>
                              <TableHead className="min-w-[150px]">Bukti</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {transactions.map((t) => (
                              <TableRow key={t.id}>
                                  <TableCell>{new Date(t.date).toLocaleDateString('id-ID')}</TableCell>
                                  <TableCell>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                                    </span>
                                  </TableCell>
                                  <TableCell>Rp{t.amount.toLocaleString('id-ID')}</TableCell>
                                  <TableCell>{t.description}</TableCell>
                                  <TableCell>{`${t.method}${t.account && t.methodType === 'transfer' ? ` (${t.account})` : ''}`}</TableCell>
                                  <TableCell>{t.source}</TableCell>
                                  <TableCell>
                                    {t.proofUrl ? (
                                      <a href={t.proofUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
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
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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