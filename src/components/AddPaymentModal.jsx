// src/components/AddPaymentModal.jsx
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, CreditCard, Banknote } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

const AddPaymentModal = ({ isOpen, onOpenChange, order, onPaymentAdded }) => {
  const { session, user, companyId } = useAuth();

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState(null);

  const calculatePaymentsTotal = (payments) => {
    return payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
  };
  
  const totalPaid = useMemo(() => calculatePaymentsTotal(order?.payments), [order?.payments]);
  const grandTotal = order?.grand_total || 0;
  const remainingDue = Math.max(0, grandTotal - totalPaid);
  
  const selectedMethod = useMemo(() => {
    return paymentMethods.find(m => String(m.id) === String(paymentMethodId));
  }, [paymentMethods, paymentMethodId]);

  useEffect(() => {
    if (isOpen && companyId) {
      fetchPaymentMethods();
    }
  }, [isOpen, companyId]);

  useEffect(() => {
    if (isOpen && remainingDue > 0) {
      setPaymentAmount(remainingDue.toString());
    } else {
      setPaymentAmount('');
    }
  }, [isOpen, remainingDue]);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    let pmQuery = supabase.from('payment_methods').select('*').eq('is_active', true);
    if (companyId) pmQuery = pmQuery.eq('company_id', companyId);
    
    const { data: methodsData, error: methodsError } = await pmQuery;
    if (methodsError) {
      console.error('Error fetching payment methods:', methodsError);
      toast.error('Gagal memuat metode pembayaran.');
    } else {
      setPaymentMethods(methodsData || []);
    }
    setLoading(false);
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0 || !paymentMethodId) {
      toast.error('Jumlah dan metode pembayaran harus diisi.');
      return;
    }
    if (parseFloat(paymentAmount) > remainingDue) {
      toast.error('Jumlah pembayaran tidak bisa melebihi sisa tagihan.');
      return;
    }
    if (selectedMethod?.type === 'transfer' && !paymentProofFile) {
        toast.error('Mohon unggah bukti transfer.');
        return;
    }
    setSubmitting(true);
    
    let proofFilePath = null; // Ubah variabel ini untuk menyimpan path

    try {
        if (selectedMethod?.type === 'transfer' && paymentProofFile) {
            const fileExt = paymentProofFile.name.split('.').pop();
            const filePath = `${order.company_id}/payments/${order.id}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('proofs')
                .upload(filePath, paymentProofFile);

            if (uploadError) throw uploadError;
            
            // Simpan HANYA JALUR FILE, bukan URL lengkap
            proofFilePath = filePath;
        }

      const { error: insertError } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          amount: parseFloat(paymentAmount),
          payment_method_id: paymentMethodId,
          paid_at: new Date().toISOString(),
          company_id: order.company_id,
          received_by: selectedMethod?.type === 'cash' ? user?.id : null,
          received_by_name: selectedMethod?.type === 'cash' ? user?.full_name : null,
          proof_url: proofFilePath, // Gunakan jalur file yang benar
        });

      if (insertError) throw insertError;
      
      const newTotalPaid = totalPaid + parseFloat(paymentAmount);
      const newPaymentStatus = newTotalPaid >= grandTotal ? 'paid' : 'partial';

      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_status: newPaymentStatus })
        .eq('id', order.id);
      
      if (updateError) throw updateError;
      
      toast.success('Pembayaran berhasil ditambahkan!');
      onPaymentAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('Gagal menambahkan pembayaran: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const paymentMethodsCash = paymentMethods.filter(m => m.type === 'cash');
  const paymentMethodsTransfer = paymentMethods.filter(m => m.type === 'transfer');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };
  
  const handleInputWheel = (e) => {
    e.target.blur();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Pembayaran</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Sisa Tagihan</Label>
              <p className="text-xl font-bold text-red-500">{formatCurrency(remainingDue)}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Nominal</Label>
              <Input
                id="paymentAmount"
                type="number"
                placeholder="Jumlah pembayaran"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                onWheel={handleInputWheel}
                readOnly={remainingDue <= 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId} disabled={remainingDue <= 0}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih metode pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodsCash.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-gray-500">Tunai</div>
                      {paymentMethodsCash.map((method) => (
                        <SelectItem key={method.id} value={String(method.id)}>
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4" />
                            <span>{method.method_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {paymentMethodsTransfer.length > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="px-2 py-1 text-xs text-gray-500">Transfer</div>
                      {paymentMethodsTransfer.map((method) => (
                        <SelectItem key={method.id} value={String(method.id)}>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span>{method.method_name} ({method.account_name})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedMethod?.type === 'transfer' && (
                <div className="space-y-2">
                    <Label htmlFor="paymentProof">Unggah Bukti Transfer</Label>
                    <Input
                        id="paymentProof"
                        type="file"
                        onChange={(e) => setPaymentProofFile(e.target.files[0])}
                        accept="image/*"
                        required
                    />
                </div>
            )}
            <DialogFooter>
              <Button type="button" onClick={handleAddPayment} disabled={submitting || remainingDue <= 0}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambahkan Pembayaran'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddPaymentModal;