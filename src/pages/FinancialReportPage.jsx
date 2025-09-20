// src/pages/FinancialReportPage.jsx

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
import { Loader2, Banknote, CreditCard, PiggyBank, TrendingUp, TrendingDown, RefreshCcw, ArrowRightLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FinancialReportPage = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    totalBalance: 0,
    balances: {},
  });
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferForm, setTransferForm] = useState({
    amount: '',
    from_method_id: '',
    to_method_id: '',
    description: '',
  });

  useEffect(() => {
    if (companyId) {
      fetchFinancialData();
    }
  }, [companyId]);

  const fetchFinancialData = async () => {
    setLoading(true);

    try {
      const { data: allPaymentMethods, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('company_id', companyId);
      if (methodsError) throw methodsError;
      setPaymentMethods(allPaymentMethods);

      const initialBalances = allPaymentMethods.reduce((acc, method) => {
        acc[method.id] = {
          ...method,
          income: 0,
          expense: 0,
          balance: 0,
        };
        return acc;
      }, {});

      const { data: allTransactions, error: transactionsError } = await supabase
        .from('financial_transactions')
        .select('amount, type, payment_method_id, source_table')
        .eq('company_id', companyId);
      if (transactionsError) throw transactionsError;

      const { data: incomingPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, payment_method_id')
        .eq('company_id', companyId);
      if (paymentsError) throw paymentsError;

      const { data: expenseReports, error: expensesError } = await supabase
        .from('expense_reports')
        .select('total_amount, payment_method')
        .eq('company_id', companyId)
        .eq('status', 'paid');
      if (expensesError) throw expensesError;
      
      let totalCompanyBalance = 0;
      const balances = { ...initialBalances };
      
      // Proses transaksi dari orders
      for (const p of incomingPayments) {
        if (balances[p.payment_method_id]) {
          balances[p.payment_method_id].income += p.amount;
        }
      }

      // Proses transaksi manual & biaya transport dari orders
      for (const t of allTransactions) {
        if (t.source_table === 'orders' && t.type === 'income' && balances[t.payment_method_id]) {
             balances[t.payment_method_id].income += t.amount;
        } else if (t.source_table !== 'orders' && balances[t.payment_method_id]) {
          if (t.type === 'income') {
            balances[t.payment_method_id].income += t.amount;
          } else {
            balances[t.payment_method_id].expense += t.amount;
          }
        }
      }

      // Proses pengeluaran dari laporan pengeluaran
      for (const e of expenseReports) {
        const matchingMethod = allPaymentMethods.find(m => m.method_name === e.payment_method);
        if (matchingMethod) {
          balances[matchingMethod.id].expense += e.total_amount;
        }
      }

      for (const id in balances) {
        const balance = balances[id].income - balances[id].expense;
        balances[id].balance = balance;
        totalCompanyBalance += balance;
      }

      setReportData({
        totalBalance: totalCompanyBalance,
        balances: Object.values(balances),
      });

    } catch (error) {
      console.error('Error fetching financial data:', error);
      toast.error('Gagal memuat data keuangan.');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { amount, from_method_id, to_method_id, description } = transferForm;
    
    if (from_method_id === to_method_id) {
        toast.error('Metode sumber dan tujuan tidak boleh sama.');
        setIsSubmitting(false);
        return;
    }

    try {
        // Transaksi pengeluaran dari metode sumber
        const { error: expenseError } = await supabase
            .from('financial_transactions')
            .insert({
                company_id: companyId,
                type: 'expense',
                amount: parseFloat(amount),
                description: `Transfer keluar ke ${paymentMethods.find(m => m.id === to_method_id)?.method_name}. ${description}`,
                payment_method_id: from_method_id,
                source_table: 'transfer',
            });
        if (expenseError) throw expenseError;

        // Transaksi pemasukan ke metode tujuan
        const { error: incomeError } = await supabase
            .from('financial_transactions')
            .insert({
                company_id: companyId,
                type: 'income',
                amount: parseFloat(amount),
                description: `Transfer masuk dari ${paymentMethods.find(m => m.id === from_method_id)?.method_name}. ${description}`,
                payment_method_id: to_method_id,
                source_table: 'transfer',
            });
        if (incomeError) throw incomeError;

        toast.success('Transfer dana berhasil dicatat!');
        setIsTransferModalOpen(false);
        setTransferForm({ amount: '', from_method_id: '', to_method_id: '', description: '' });
        fetchFinancialData();

    } catch (error) {
        console.error('Error submitting transfer:', error);
        toast.error('Gagal mencatat transfer dana: ' + error.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };
  
  const getIconForMethod = (type) => {
      return type === 'cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#10182b]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6"> {/* Mengubah space-y-8 menjadi space-y-6 */}
      
      {/* Header Responsif */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3"> {/* Mengurangi mb-6 */}
        <h1 className="text-2xl font-bold text-[#10182b] flex items-center gap-2"> {/* Mengurangi ukuran font */}
          <PiggyBank className="h-6 w-6" />
          Laporan Keuangan
        </h1>
        {/* Tombol Aksi - Flex wrap dan full width di mobile */}
        <div className="flex flex-wrap w-full md:w-auto gap-2">
            <Button onClick={fetchFinancialData} variant="outline" className="w-full sm:w-auto text-[#10182b] hover:bg-gray-100 text-sm">
                <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={() => setIsTransferModalOpen(true)} className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#1a2542] text-sm">
                <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer Dana
            </Button>
        </div>
      </div>

      {/* Card Total Saldo */}
      <Card className="mb-4 border-0 shadow-lg bg-[#10182b] text-white"> {/* Mengurangi mb-6 */}
        <CardHeader className="p-4"> {/* Mengurangi padding p-6 */}
          <CardTitle className="text-sm font-medium opacity-80">Total Saldo Perusahaan</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0"> {/* Mengurangi padding p-6 */}
          <p className="text-3xl sm:text-4xl font-bold"> {/* Menyesuaikan ukuran font */}
            {formatCurrency(reportData.totalBalance)}
          </p>
        </CardContent>
      </Card>
      
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-[#10182b]"> {/* Mengurangi ukuran font */}
        Rincian Saldo per Metode Pembayaran
      </h2>
      
      {/* Rincian Saldo - 1 kolom di mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportData.balances.map(item => (
          <Card key={item.id} className="border border-gray-200 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-base font-semibold text-[#10182b]"> {/* Mengurangi ukuran font */}
                {item.method_name}
              </CardTitle>
              <div className="p-2 rounded-full bg-[#10182b] text-white">
                {item.type === 'cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-[#10182b]">
                {formatCurrency(item.balance)}
              </div>
              {/* Pemasukan/Pengeluaran - Menggunakan flex wrap di mobile jika perlu */}
              <div className="text-xs text-muted-foreground mt-2 flex flex-wrap justify-between items-center gap-2">
                <span>Pemasukan: <span className="font-semibold text-green-600">{formatCurrency(item.income)}</span></span>
                <span>Pengeluaran: <span className="font-semibold text-red-600">{formatCurrency(item.expense)}</span></span>
              </div>
              {item.type === 'transfer' && (
                <p className="text-xs text-muted-foreground mt-2">
                  {item.account_name} ({item.account_number})
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transfer Dana Modal */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="sm:max-w-md"> {/* Mengubah sm:max-w-[425px] menjadi sm:max-w-md */}
            <DialogHeader>
                <DialogTitle>Transfer Dana</DialogTitle>
                <DialogDescription>
                    Pindahkan dana antar metode pembayaran.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTransferSubmit} className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="from_method_id" className="text-sm">Dari Metode</Label>
                    <Select
                        value={transferForm.from_method_id}
                        onValueChange={(value) => setTransferForm(prev => ({ ...prev, from_method_id: value }))}
                        required
                    >
                        <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Pilih metode sumber" />
                        </SelectTrigger>
                        <SelectContent>
                            {paymentMethods.map(method => (
                                <SelectItem key={method.id} value={method.id}>
                                    {method.method_name} ({method.account_name})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="to_method_id" className="text-sm">Ke Metode</Label>
                    <Select
                        value={transferForm.to_method_id}
                        onValueChange={(value) => setTransferForm(prev => ({ ...prev, to_method_id: value }))}
                        required
                    >
                        <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Pilih metode tujuan" />
                        </SelectTrigger>
                        <SelectContent>
                            {paymentMethods.map(method => (
                                <SelectItem key={method.id} value={method.id}>
                                     {method.method_name} ({method.account_name})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="amount" className="text-sm">Nominal</Label>
                    <Input
                        id="amount"
                        type="number"
                        placeholder="Jumlah yang akan ditransfer"
                        value={transferForm.amount}
                        onChange={(e) => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                        required
                        className="text-sm"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="description" className="text-sm">Deskripsi</Label>
                    <Input
                        id="description"
                        placeholder="Contoh: Setor uang tunai ke bank"
                        value={transferForm.description}
                        onChange={(e) => setTransferForm(prev => ({ ...prev, description: e.target.value }))}
                        className="text-sm"
                    />
                </div>
                <DialogFooter className="mt-4">
                    <Button 
                        type="submit" 
                        disabled={isSubmitting || !transferForm.amount || !transferForm.from_method_id || !transferForm.to_method_id}
                        className="w-full text-sm h-10"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Catat Transfer'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialReportPage;