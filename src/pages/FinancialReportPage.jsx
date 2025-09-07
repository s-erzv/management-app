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
import { Loader2, Banknote, CreditCard, PiggyBank, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Separator } from '@/components/ui/separator';

const FinancialReportPage = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    totalBalance: 0,
    balances: {},
  });

  useEffect(() => {
    if (companyId) {
      fetchFinancialData();
    }
  }, [companyId]);

  const fetchFinancialData = async () => {
    setLoading(true);

    try {
      // 1. Ambil semua metode pembayaran perusahaan
      const { data: paymentMethods, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('company_id', companyId);
      if (methodsError) throw methodsError;

      // Inisialisasi struktur data saldo per metode pembayaran
      const initialBalances = paymentMethods.reduce((acc, method) => {
        acc[method.id] = {
          ...method,
          income: 0,
          expense: 0,
          balance: 0,
        };
        return acc;
      }, {});

      // 2. Ambil semua pembayaran masuk dari orders
      const { data: incomingPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, payment_method_id')
        .eq('company_id', companyId);
      if (paymentsError) throw paymentsError;

      // 3. Ambil semua pengeluaran dari laporan karyawan yang sudah paid
      const { data: expenseReports, error: expensesError } = await supabase
        .from('expense_reports')
        .select('total_amount, payment_method')
        .eq('company_id', companyId)
        .eq('status', 'paid');
      if (expensesError) throw expensesError;

      // 4. Ambil semua transaksi manual
      const { data: manualTransactions, error: manualTransactionsError } = await supabase
        .from('financial_transactions')
        .select('amount, type, payment_method_id')
        .eq('company_id', companyId);
      if (manualTransactionsError) throw manualTransactionsError;

      // Proses data transaksi dan hitung saldo
      let totalCompanyBalance = 0;
      const balances = { ...initialBalances };

      // a. Proses pemasukan dari orders
      for (const p of incomingPayments) {
        if (balances[p.payment_method_id]) {
          balances[p.payment_method_id].income += p.amount;
        }
      }

      // b. Proses transaksi manual (pemasukan & pengeluaran)
      for (const t of manualTransactions) {
        if (balances[t.payment_method_id]) {
          if (t.type === 'income') {
            balances[t.payment_method_id].income += t.amount;
          } else {
            balances[t.payment_method_id].expense += t.amount;
          }
        }
      }
      
      // c. Proses pengeluaran dari laporan pengeluaran
      for (const e of expenseReports) {
        const matchingMethod = paymentMethods.find(m => m.method_name === e.payment_method);
        if (matchingMethod) {
          balances[matchingMethod.id].expense += e.total_amount;
        }
      }

      // Hitung saldo akhir dan total saldo perusahaan
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };
  
  const getIconForMethod = (type) => {
      return type === 'cash' ? <Banknote className="h-6 w-6 text-white" /> : <CreditCard className="h-6 w-6 text-white" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#10182b]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
          <PiggyBank className="h-8 w-8" />
          Laporan Keuangan
        </h1>
      </div>

      <Card className="mb-6 border-0 shadow-lg bg-[#10182b] text-white">
        <CardHeader className="p-6">
          <CardTitle className="text-sm font-medium opacity-80">Total Saldo Perusahaan</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <p className="text-4xl font-bold">
            {formatCurrency(reportData.totalBalance)}
          </p>
        </CardContent>
      </Card>
      
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-[#10182b]">
        Rincian Saldo per Metode Pembayaran
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportData.balances.map(item => (
          <Card key={item.id} className="border border-gray-200 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold text-[#10182b]">
                {item.method_name}
              </CardTitle>
              <div className="p-2 rounded-full bg-[#10182b] text-white">
                {item.type === 'cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#10182b]">
                {formatCurrency(item.balance)}
              </div>
              <div className="text-sm text-muted-foreground mt-2 flex justify-between items-center">
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
    </div>
  );
};

export default FinancialReportPage;