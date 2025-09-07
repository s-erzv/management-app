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
import { Loader2, Plus, Trash, Eye, FileText, Calendar, User, CreditCard, CheckCircle, Clock, Send } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ExpenseReportsPage = () => {
  const { companyId, userProfile, session } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseItems, setExpenseItems] = useState([
    { type: 'bensin', description: '', amount: '' },
  ]);
  const [employees, setEmployees] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  
  const [submitterId, setSubmitterId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentTo, setPaymentTo] = useState('');
  
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMarkAsPaidModalOpen, setIsMarkAsPaidModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedAdminPaymentMethodId, setSelectedAdminPaymentMethodId] = useState('');
  const [adminFee, setAdminFee] = useState(0);

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
  }, [companyId]);
  
  const fetchData = async () => {
    setLoading(true);

    const { data: reportsData, error: reportsError } = await supabase
      .from('expense_reports')
      .select(`
        *,
        user:user_id(full_name, rekening),
        items:expense_report_items(*)
      `)
      .eq('company_id', companyId)
      .order('report_date', { ascending: false });
    
    if (reportsError) {
      console.error('Error fetching expense reports:', reportsError);
      toast.error('Gagal memuat laporan pengeluaran.');
    } else {
      setReports(reportsData);
    }

    const { data: employeesData, error: employeesError } = await supabase
      .from('profiles')
      .select('id, full_name, rekening, role')
      .eq('company_id', companyId)
      .eq('role', 'user')
      .order('full_name', { ascending: true });

    if (!employeesError) {
        setEmployees(employeesData);
    }
    
    const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('company_id', companyId);

    if (!methodsError) {
        setPaymentMethods(methodsData);
    }
    
    setLoading(false);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...expenseItems];
    newItems[index][field] = value;
    setExpenseItems(newItems);
  };

  const handleAddItem = () => {
    setExpenseItems([...expenseItems, { type: 'bensin', description: '', amount: '' }]);
  };

  const handleRemoveItem = (index) => {
    const newItems = expenseItems.filter((_, i) => i !== index);
    setExpenseItems(newItems);
  };

  const calculateTotal = () => {
    return expenseItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };
  
  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value);
    const selectedEmployee = employees.find(emp => emp.id === submitterId);
    if (value === 'transfer' && selectedEmployee) {
        setPaymentTo(selectedEmployee.rekening || '');
    } else {
        setPaymentTo('');
    }
  };


const handleTransferClick = (report) => {
  const nama = report?.user?.full_name || 'Karyawan';
  const rekening = report?.user?.rekening || '-';
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(report?.total_amount || 0));

  const tanggal = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(report?.report_date || Date.now()));

  const metode = report?.payment_method || '-';

  const message = `Halo bang, saya mau ngajuin reimburesement untuk laporan pengeluaran berikut:
  - Tanggal: ${tanggal}
  - Karyawan: ${nama}
  - Jumlah: ${formattedAmount}
  - Metode: ${metode}
  - Rekening: ${rekening}

Tolong diproses ya bang, dan konfirmasi kalau udah ditransfer. Makasih 剌`;

  const whatsappUrl = `https://wa.me/6281911797724?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
};


  const handleMarkAsPaid = (report) => {
    setSelectedReport(report);
    setAdminFee(0); // Reset admin fee when modal opens
    setIsMarkAsPaidModalOpen(true);
  };
  
  const handleConfirmPayment = async () => {
      if (!selectedAdminPaymentMethodId || !selectedReport) {
          toast.error('Metode pembayaran dan laporan harus dipilih.');
          return;
      }
      setLoading(true);
      setIsMarkAsPaidModalOpen(false);

      try {
          const finalAmount = selectedReport.total_amount + parseFloat(adminFee);
          
          // 1. Perbarui status laporan menjadi 'paid'
          const { error: updateError } = await supabase
              .from('expense_reports')
              .update({ status: 'paid', total_amount: finalAmount })
              .eq('id', selectedReport.id);
          if (updateError) throw updateError;
          
          // 2. Tambahkan entri pengeluaran ke financial_transactions
          const { error: insertError } = await supabase
              .from('financial_transactions')
              .insert({
                  company_id: companyId,
                  type: 'expense',
                  amount: finalAmount,
                  description: `Reimbursement untuk ${selectedReport.user?.full_name || 'karyawan'} (termasuk biaya admin Rp${parseFloat(adminFee).toLocaleString('id-ID')})`,
                  payment_method_id: selectedAdminPaymentMethodId,
                  source_table: 'expense_reports',
                  source_id: selectedReport.id,
              });
          if (insertError) throw insertError;

          toast.success('Laporan berhasil ditandai sebagai LUNAS dan pengeluaran dicatat.');
          fetchData();

      } catch (error) {
          console.error('Error during payment confirmation:', error);
          toast.error('Gagal memproses pembayaran: ' + error.message);
      } finally {
          setLoading(false);
          setSelectedReport(null);
          setSelectedAdminPaymentMethodId('');
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const totalAmount = calculateTotal();
    
    const expenseReport = {
      company_id: companyId,
      user_id: submitterId,
      report_date: new Date().toISOString().slice(0, 10),
      total_amount: totalAmount,
      payment_method: paymentMethod,
      payment_to_account: paymentTo,
      status: 'pending',
    };
    
    const payload = {
      expenseReport,
      expenseItems: expenseItems.map(item => ({
        type: item.type,
        description: item.description,
        amount: parseFloat(item.amount) || 0,
      })),
    };

    try {
      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/submit-expense-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Server returned an error: ' + errorText);
      }

      toast.success('Laporan pengeluaran berhasil disubmit!');
      setExpenseItems([{ type: 'bensin', description: '', amount: '' }]);
      setSubmitterId('');
      setPaymentTo('');
      setPaymentMethod('');
      fetchData();
    } catch (error) {
      console.error('Error submitting expense report:', error.message);
      toast.error('Gagal submit laporan pengeluaran: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#10182b] mx-auto" />
          <p className="text-gray-600 text-lg">Memuat data...</p>
        </div>
      </div>
    );
  }

  const expenseTypes = ['Bongkar', 'Bensin', 'Makan', 'Kasbon', 'Lainnya'];
  const totalAmount = calculateTotal();
  const currentSubmitter = employees.find(emp => emp.id === submitterId);
  const finalAmountDisplay = selectedReport ? selectedReport.total_amount + parseFloat(adminFee) : 0;
  
  const pendingReports = reports.filter(r => r.status === 'pending');
  const paidReports = reports.filter(r => r.status === 'paid');

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 lg:p-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-[#10182b] mb-2 flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 lg:h-10 lg:w-10" />
            Laporan Pengeluaran
          </h1>
          <p className="text-gray-600 text-lg">Kelola pengajuan reimbursement dengan mudah dan efisien</p>
        </div>

        {/* Form Pengajuan */}
        <Card className="mb-8 border-0 shadow-lg bg-white">
          <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
            <CardTitle className="text-xl lg:text-2xl flex items-center gap-2">
              <Plus className="h-6 w-6" />
              Buat Laporan Pengeluaran Baru
            </CardTitle>
            <CardDescription className="text-gray-200">
              Isi formulir berikut untuk mengajukan pengeluaran yang akan diganti oleh perusahaan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 lg:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Expense Items */}
              <div className="space-y-4">
                <Label className="text-lg font-semibold text-[#10182b] flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Daftar Pengeluaran
                </Label>
                <div className="space-y-4">
                  {expenseItems.map((item, index) => (
                    <Card key={index} className="border border-gray-200 bg-gray-50">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Jenis Pengeluaran</Label>
                            <Select
                              value={item.type}
                              onValueChange={(value) => handleItemChange(index, 'type', value)}
                            >
                              <SelectTrigger className="bg-white border-gray-300 focus:border-[#10182b]">
                                <SelectValue placeholder="Pilih jenis" />
                              </SelectTrigger>
                              <SelectContent>
                                {expenseTypes.map(type => (
                                  <SelectItem key={type} value={type.toLowerCase()}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="md:col-span-1 xl:col-span-2 space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Deskripsi Keperluan</Label>
                            <Input
                              type="text"
                              placeholder="Contoh: Pembelian bensin untuk pengiriman ke Jakarta"
                              value={item.description}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              className="bg-white border-gray-300 focus:border-[#10182b]"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Nominal (Rp)</Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                placeholder="0"
                                value={item.amount}
                                onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                                className="bg-white border-gray-300 focus:border-[#10182b]"
                                
                                required
                              />
                              {expenseItems.length > 1 && (
                                <Button 
                                  type="button" 
                                  variant="destructive" 
                                  size="icon" 
                                  onClick={() => handleRemoveItem(index)}
                                  className="shrink-0"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full border-[#10182b] text-[#10182b] hover:bg-[#10182b] hover:text-white transition-colors" 
                  onClick={handleAddItem}
                >
                  <Plus className="h-4 w-4 mr-2" /> Tambah Item Pengeluaran
                </Button>
              </div>
              
              {/* Total */}
              <Card className="border-[#10182b] bg-gradient-to-r from-[#10182b] to-[#1a2542] text-white">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-semibold">Total Pengeluaran:</span>
                    <span className="text-2xl lg:text-3xl font-bold">
                      Rp{totalAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              {/* Payment Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-lg font-semibold text-[#10182b] flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Karyawan Pengaju
                  </Label>
                  <Select
                    value={submitterId}
                    onValueChange={setSubmitterId}
                    required
                  >
                    <SelectTrigger className="bg-white border-gray-300 focus:border-[#10182b] h-12">
                      <SelectValue placeholder="Pilih nama karyawan" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(employee => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-lg font-semibold text-[#10182b] flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Metode Pembayaran
                  </Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={handlePaymentMethodChange}
                    disabled={!submitterId}
                    required
                  >
                    <SelectTrigger className="bg-white border-gray-300 focus:border-[#10182b] h-12">
                      <SelectValue placeholder="Pilih metode pembayaran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Tunai (Cash)</SelectItem>
                      <SelectItem value="transfer" disabled={!currentSubmitter?.rekening}>
                        Transfer ({currentSubmitter?.rekening || 'Rekening tidak tersedia'})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-[#10182b] text-white hover:bg-[#1a2542] h-12 text-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> 
                    Mengirim Laporan...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Kirim Laporan Pengeluaran
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* History Section with Tabs */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-t-lg border-b">
            <CardTitle className="text-xl lg:text-2xl text-[#10182b] flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Riwayat Laporan Pengeluaran
            </CardTitle>
            <CardDescription className="text-gray-600">
              Pantau status dan detail semua pengajuan reimbursement
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 lg:p-6">
            <Tabs defaultValue="pending" className="space-y-4">
              <TabsList className="grid w-full sm:w-auto grid-cols-2">
                <TabsTrigger value="pending" className="gap-2">
                  <Clock className="h-4 w-4" /> Pending ({pendingReports.length})
                </TabsTrigger>
                <TabsTrigger value="paid" className="gap-2">
                  <CheckCircle className="h-4 w-4" /> Lunas ({paidReports.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="pending" className="space-y-4">
                {pendingReports.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">Tidak Ada Laporan Pending</h3>
                    <p className="text-gray-500">Semua laporan sudah diselesaikan.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {pendingReports.map((report) => (
                      <Card 
                        key={report.id} 
                        className="cursor-pointer hover:shadow-xl transition-all duration-300 border-l-4 border-l-amber-500 hover:-translate-y-1" 
                        onClick={() => { setSelectedReport(report); setIsDetailModalOpen(true); }}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-xl lg:text-2xl text-[#10182b] mb-1">
                                Rp{report.total_amount.toLocaleString('id-ID')}
                              </CardTitle>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User className="h-4 w-4" />
                                {report.user?.full_name || '-'}
                              </div>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 bg-amber-100 text-amber-800">
                              <Clock className="h-3 w-3" /> PENDING
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600 flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                Tanggal
                              </span>
                              <span className="font-medium">
                                {new Date(report.report_date).toLocaleDateString('id-ID')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600 flex items-center gap-1">
                                <CreditCard className="h-4 w-4" />
                                Metode
                              </span>
                              <span className="font-medium capitalize">
                                {report.payment_method === 'transfer' ? 'Transfer' : 'Tunai'}
                              </span>
                            </div>
                            <div className="flex justify-end mt-4">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-[#10182b] hover:bg-[#10182b] hover:text-white"
                                onClick={(e) => { e.stopPropagation(); setSelectedReport(report); setIsDetailModalOpen(true); }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Lihat Detail
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="paid" className="space-y-4">
                 {paidReports.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">Tidak Ada Laporan Lunas</h3>
                    <p className="text-gray-500">Laporan yang sudah dibayar akan muncul di sini.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {paidReports.map((report) => (
                      <Card 
                        key={report.id} 
                        className="cursor-pointer hover:shadow-xl transition-all duration-300 border-l-4 border-l-green-500 hover:-translate-y-1" 
                        onClick={() => { setSelectedReport(report); setIsDetailModalOpen(true); }}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-xl lg:text-2xl text-[#10182b] mb-1">
                                Rp{report.total_amount.toLocaleString('id-ID')}
                              </CardTitle>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User className="h-4 w-4" />
                                {report.user?.full_name || '-'}
                              </div>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3" /> LUNAS
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600 flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                Tanggal
                              </span>
                              <span className="font-medium">
                                {new Date(report.report_date).toLocaleDateString('id-ID')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600 flex items-center gap-1">
                                <CreditCard className="h-4 w-4" />
                                Metode
                              </span>
                              <span className="font-medium capitalize">
                                {report.payment_method === 'transfer' ? 'Transfer' : 'Tunai'}
                              </span>
                            </div>
                             <div className="flex justify-end mt-4">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-[#10182b] hover:bg-[#10182b] hover:text-white"
                                onClick={(e) => { e.stopPropagation(); setSelectedReport(report); setIsDetailModalOpen(true); }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Lihat Detail
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Detail Modal */}
      {selectedReport && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl lg:text-2xl text-[#10182b] flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Detail Laporan Pengeluaran
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Informasi lengkap pengajuan reimbursement dari <strong>{selectedReport.user?.full_name || '-'}</strong>
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-[#10182b] bg-gradient-to-br from-[#10182b] to-[#1a2542] text-white">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm opacity-90 mb-1">Total Nominal</div>
                    <div className="text-xl lg:text-2xl font-bold">
                      Rp{selectedReport.total_amount.toLocaleString('id-ID')}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-200">
                  <CardContent className="p-4 text-center">
                    <User className="h-6 w-6 text-[#10182b] mx-auto mb-2" />
                    <div className="text-sm text-gray-600 mb-1">Pengaju</div>
                    <div className="font-semibold text-[#10182b]">
                      {selectedReport.user?.full_name || '-'}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-200">
                  <CardContent className="p-4 text-center">
                    <Calendar className="h-6 w-6 text-[#10182b] mx-auto mb-2" />
                    <div className="text-sm text-gray-600 mb-1">Tanggal</div>
                    <div className="font-semibold text-[#10182b]">
                      {new Date(selectedReport.report_date).toLocaleDateString('id-ID')}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-200">
                  <CardContent className="p-4 text-center">
                    <div className="mb-2">
                      {selectedReport.status === 'paid' ? (
                        <CheckCircle className="h-6 w-6 text-green-600 mx-auto" />
                      ) : (
                        <Clock className="h-6 w-6 text-amber-600 mx-auto" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-1">Status</div>
                    <div className={`font-semibold ${
                      selectedReport.status === 'paid' ? 'text-green-600' : 'text-amber-600'
                    }`}>
                      {selectedReport.status === 'paid' ? 'LUNAS' : 'PENDING'}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Items Detail */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#10182b] flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Rincian Pengeluaran
                </h3>
                
                {/* Mobile View - Cards */}
                <div className="block md:hidden space-y-3">
                  {selectedReport.items.map((item, index) => (
                    <Card key={index} className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium text-[#10182b] uppercase">
                            {item.type}
                          </span>
                          <span className="text-lg font-bold text-[#10182b]">
                            Rp{item.amount.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{item.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {/* Desktop View - Table */}
                <div className="hidden md:block rounded-lg border border-gray-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-semibold text-[#10182b] w-[150px]">Jenis</TableHead>
                        <TableHead className="font-semibold text-[#10182b]">Deskripsi</TableHead>
                        <TableHead className="font-semibold text-[#10182b] text-right w-[150px]">Nominal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReport.items.map((item, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell className="font-medium text-[#10182b] uppercase">
                            {item.type}
                          </TableCell>
                          <TableCell className="text-gray-700">
                            {item.description}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-[#10182b]">
                            Rp{item.amount.toLocaleString('id-ID')}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-[#10182b] text-white font-semibold hover:bg-[#1a2542]">
                        <TableCell colSpan={2} className="text-right">
                          Total Keseluruhan:
                        </TableCell>
                        <TableCell className="text-right text-lg">
                          Rp{selectedReport.total_amount.toLocaleString('id-ID')}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              {/* Admin Actions */}
              {userProfile?.role === 'admin' && selectedReport.status === 'pending' && (
                <Card className="border-[#10182b] bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardContent className="p-6">
                    <h4 className="font-semibold text-[#10182b] mb-4 flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Aksi Administrator
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        className="bg-green-600 hover:bg-green-700 text-white flex-1"
                        onClick={() => handleTransferClick(selectedReport)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Transfer & Kirim WhatsApp
                      </Button>
                      <Button 
                        variant="outline" 
                        className="border-[#10182b] text-[#10182b] hover:bg-[#10182b] hover:text-white flex-1"
                        onClick={() => handleMarkAsPaid(selectedReport)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Tandai Lunas
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Modal Tandai Lunas */}
      {selectedReport && (
          <Dialog open={isMarkAsPaidModalOpen} onOpenChange={setIsMarkAsPaidModalOpen}>
              <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                      <DialogTitle>Tandai Lunas Laporan</DialogTitle>
                      <DialogDescription>
                          Pilih metode pembayaran yang digunakan untuk melunasi reimbursement ini.
                      </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                          <Label>Total Reimbursement</Label>
                          <p className="text-lg font-bold">
                              Rp{selectedReport?.total_amount.toLocaleString('id-ID')}
                          </p>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="admin-fee">Biaya Admin (Opsional)</Label>
                          <Input
                              id="admin-fee"
                              type="number"
                              placeholder="Masukkan biaya admin"
                              value={adminFee}
                              onChange={(e) => setAdminFee(e.target.value)}
                          />
                      </div>
                      <div className="space-y-2">
                          <Label>Total Akhir</Label>
                          <p className="text-2xl font-bold text-[#10182b]">
                              Rp{(selectedReport.total_amount + parseFloat(adminFee)).toLocaleString('id-ID')}
                          </p>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="admin-payment-method">Metode Pembayaran Perusahaan</Label>
                          <Select
                              value={selectedAdminPaymentMethodId}
                              onValueChange={setSelectedAdminPaymentMethodId}
                              required
                          >
                              <SelectTrigger>
                                  <SelectValue placeholder="Pilih metode pembayaran" />
                              </SelectTrigger>
                              <SelectContent>
                                  {paymentMethods.map(method => (
                                      <SelectItem key={method.id} value={method.id}>
                                          {method.method_name} {method.type === 'transfer' && `(${method.account_name})`}
                                      </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
                  <DialogFooter>
                      <Button 
                          onClick={handleConfirmPayment}
                          disabled={!selectedAdminPaymentMethodId || loading}
                      >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Konfirmasi Pembayaran'}
                      </Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
      )}
    </div>
  );
};

export default ExpenseReportsPage;