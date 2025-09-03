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
import { Loader2, Plus, Trash, Send, Eye } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const ExpenseReportsPage = () => {
  const { companyId, userProfile, session } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseItems, setExpenseItems] = useState([
    { type: 'bensin', description: '', amount: '' },
  ]);
  const [employees, setEmployees] = useState([]); // State untuk semua karyawan
  
  // State untuk form pengajuan
  const [submitterId, setSubmitterId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentTo, setPaymentTo] = useState('');
  
  // State untuk detail modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

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
      .eq('role', 'user') // Perbaikan: Hanya mengambil role 'user'
      .order('full_name', { ascending: true });

    if (!employeesError) {
        setEmployees(employeesData);
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

Tolong diproses ya bang, dan konfirmasi kalau udah ditransfer. Makasih 🙏`;

  const whatsappUrl = `https://wa.me/6281911797724?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
};


  const handleMarkAsPaid = async (reportId) => {
    if (!window.confirm('Apakah Anda yakin ingin menandai laporan ini sebagai LUNAS?')) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('expense_reports')
      .update({ status: 'paid' })
      .eq('id', reportId);
      
    if (error) {
      toast.error('Gagal memperbarui status.');
    } else {
      toast.success('Laporan berhasil ditandai sebagai LUNAS.');
      fetchData();
    }
    setLoading(false);
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
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  const expenseTypes = ['Bongkar', 'Bensin', 'Makan', 'Kasbon', 'Lainnya'];
  const totalAmount = calculateTotal();
  const currentSubmitter = employees.find(emp => emp.id === submitterId);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">Uang Terpakai</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Buat Laporan Pengeluaran Baru</CardTitle>
          <CardDescription>
            Isi formulir untuk mengajukan pengeluaran yang akan diganti oleh perusahaan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Item Pengeluaran</Label>
              {expenseItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="w-1/4">
                    <Label className="text-sm">Tipe</Label>
                    <Select
                      value={item.type}
                      onValueChange={(value) => handleItemChange(index, 'type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Tipe" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseTypes.map(type => (
                          <SelectItem key={type} value={type.toLowerCase()}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm">Keperluan</Label>
                    <Input
                      type="text"
                      placeholder="Contoh: Beli bensin untuk pengiriman"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-1/4">
                    <Label className="text-sm">Nominal</Label>
                    <Input
                      type="number"
                      placeholder="Nominal"
                      value={item.amount}
                      onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                      min="0"
                      required
                    />
                  </div>
                  {expenseItems.length > 1 && (
                    <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveItem(index)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" /> Tambah Item
              </Button>
            </div>
            
            <Separator />
            <div className="space-y-2">
                <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total Pengeluaran:</span>
                    <span>Rp{totalAmount.toLocaleString('id-ID')}</span>
                </div>
            </div>
            
            <Separator />
            <div className="space-y-4">
                <div className="grid gap-2">
                    <Label>Karyawan Pengaju</Label>
                    <Select
                        value={submitterId}
                        onValueChange={setSubmitterId}
                        required
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Karyawan" />
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
                <div className="grid gap-2">
                    <Label>Metode Pembayaran</Label>
                    <Select
                        value={paymentMethod}
                        onValueChange={handlePaymentMethodChange}
                        disabled={!submitterId}
                        required
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Metode" />
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

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Laporan Pengeluaran'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle>Riwayat Pengeluaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map((report) => (
                <Card key={report.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setSelectedReport(report); setIsDetailModalOpen(true); }}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">
                        Rp{report.total_amount.toLocaleString('id-ID')}
                      </CardTitle>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${report.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {report.status}
                      </span>
                    </div>
                    <CardDescription>
                      Diajukan oleh {report.user?.full_name || '-'} pada {new Date(report.report_date).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-muted-foreground">{report.payment_method}</span>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedReport(report); setIsDetailModalOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {reports.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Belum ada laporan pengeluaran.
                </div>
              )}
          </CardContent>
      </Card>
      
      {/* Modal Detail Pengeluaran */}
      {selectedReport && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Laporan Pengeluaran</DialogTitle>
              <DialogDescription>
                Rincian pengeluaran yang diajukan oleh {selectedReport.user?.full_name || '-'}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pengaju</Label>
                  <p className="font-medium">{selectedReport.user?.full_name || '-'}</p>
                </div>
                <div>
                  <Label>Tanggal</Label>
                  <p className="font-medium">{new Date(selectedReport.report_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label>Total Pengeluaran</Label>
                  <p className="font-bold text-lg">Rp{selectedReport.total_amount.toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className={`font-semibold ${selectedReport.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {selectedReport.status}
                  </p>
                </div>
              </div>
              
              <Separator />
              <div className="space-y-2">
                <h3 className="font-semibold text-base">Rincian Item</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Deskripsi</TableHead>
                        <TableHead>Nominal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReport.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.type}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>Rp{item.amount.toLocaleString('id-ID')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              {userProfile?.role === 'admin' && selectedReport.status === 'pending' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                      <Label>Aksi Admin</Label>
                      <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTransferClick(selectedReport)}>Transfer & Kirim WA</Button>
                          <Button size="sm" variant="outline" onClick={() => handleMarkAsPaid(selectedReport.id)}>Lunas</Button>
                      </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};

export default ExpenseReportsPage;