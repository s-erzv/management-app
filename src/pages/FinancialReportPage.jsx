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
import { Loader2, Banknote, CreditCard } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Separator } from '@/components/ui/separator';

const FinancialReportPage = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    totalBalance: 0,
    balances: [],
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

      // 2. Ambil semua pembayaran masuk dari orders
      const { data: incomingPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, method')
        .eq('company_id', companyId);
      if (paymentsError) throw paymentsError;
      
      // 3. Ambil semua pengeluaran dari laporan karyawan yang sudah paid
      const { data: expenseReports, error: expensesError } = await supabase
        .from('expense_reports')
        .select('total_amount, payment_method')
        .eq('company_id', companyId)
        .eq('status', 'paid');
      if (expensesError) throw expensesError;

      // 4. Ambil semua pengeluaran manual dari financial_transactions
      const { data: manualExpenses, error: manualExpensesError } = await supabase
          .from('financial_transactions')
          .select('amount, payment_method:payment_method_id(method_name)')
          .eq('company_id', companyId)
          .eq('type', 'expense');
      if (manualExpensesError) throw manualExpensesError;

      let totalCompanyBalance = 0;
      const balances = paymentMethods.map(method => {
        const incoming = incomingPayments
          .filter(p => p.method === method.method_name)
          .reduce((sum, p) => sum + p.amount, 0);

        const outgoingFromReports = expenseReports
          .filter(e => e.payment_method === method.method_name)
          .reduce((sum, e) => sum + e.total_amount, 0);
          
        const outgoingFromManual = manualExpenses
          .filter(me => me.payment_method?.method_name === method.method_name)
          .reduce((sum, me) => sum + me.amount, 0);
        
        const totalOutgoing = outgoingFromReports + outgoingFromManual;
        
        const balance = incoming - totalOutgoing;
        totalCompanyBalance += balance;

        return {
          id: method.id,
          method_name: method.method_name,
          type: method.type,
          account_name: method.account_name,
          account_number: method.account_number,
          balance: balance,
        };
      });

      setReportData({
        totalBalance: totalCompanyBalance,
        balances: balances,
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
      return type === 'cash' ? <Banknote className="h-6 w-6 text-primary" /> : <CreditCard className="h-6 w-6 text-primary" />;
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
      <h1 className="text-2xl font-bold mb-6">Laporan Keuangan</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Total Saldo Perusahaan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">
            {formatCurrency(reportData.totalBalance)}
          </p>
        </CardContent>
      </Card>
      
      <h2 className="text-xl font-bold mb-4">Rincian Saldo per Metode Pembayaran</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportData.balances.map(item => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {item.method_name}
              </CardTitle>
              {getIconForMethod(item.type)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(item.balance)}
              </div>
              {item.type === 'transfer' && (
                <p className="text-xs text-muted-foreground mt-2">
                  {item.account_name} ({item.account_number})
                </p>
              )}
               {item.type === 'cash' && (
                <p className="text-xs text-muted-foreground mt-2">
                  {item.account_name}
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