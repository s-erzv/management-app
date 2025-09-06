// src/components/ProofOfDeliveryForm.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '../contexts/AuthContext';

const ProofOfDeliveryForm = ({ isOpen, onOpenChange, order, onCompleteDelivery }) => {
  const { companyId } = useAuth(); // Ambil companyId dari context
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receivedByName, setReceivedByName] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [formState, setFormState] = useState({
    returnedQty: 0,
    borrowedQty: 0,
    purchasedEmptyQty: 0,
    transportCost: '',
  });

  // Fetch payment methods on component mount
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!companyId) return;
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('company_id', companyId);
      
      if (error) {
        console.error('Error fetching payment methods:', error);
      } else {
        setPaymentMethods(data || []);
      }
    };
    fetchPaymentMethods();
  }, [companyId]);

  useEffect(() => {
    if (order) {
      setFormState({
        returnedQty: 0,
        borrowedQty: 0,
        purchasedEmptyQty: 0,
        transportCost: order.transport_cost ?? '0',
      });
      setFile(null);
      setPaymentMethod(order.payment_status === 'paid' ? '' : 'pending'); // Set to 'pending' if not paid
      setReceivedByName('');
      setCashAmount('0');
      setTransferAmount('0');
    }
  }, [order]);
  
  useEffect(() => {
    if (!order) return;
    const remaining = order?.remaining_due || 0;
    const selectedMethod = paymentMethods.find(m => m.method_name === paymentMethod);
    
    if (paymentMethod === 'hybrid') {
      const remainingForTransfer = remaining - (parseFloat(cashAmount) || 0);
      setTransferAmount(remainingForTransfer > 0 ? remainingForTransfer.toString() : '0');
    } else if (selectedMethod?.type === 'cash') {
      setCashAmount(remaining.toString());
      setTransferAmount('0');
    } else if (selectedMethod?.type === 'transfer') {
      setTransferAmount(remaining.toString());
      setCashAmount('0');
    } else {
      setCashAmount('0');
      setTransferAmount('0');
    }
  }, [paymentMethod, order, cashAmount, paymentMethods]);

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormState(prev => ({ ...prev, [id]: value }));
  };
  
  const handleAmountChange = (e, setter) => {
    setter(e.target.value);
  };
  

  const handleUploadAndComplete = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Pilih file gambar untuk diunggah.');
      return;
    }
    if (!order?.id) {
      toast.error('ID pesanan tidak ditemukan.');
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split('.').pop();
      const fileName = `${order.id}-${user.id}-${Date.now()}.${ext}`;
      const filePath = `${order.id}/delivery_proofs/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("proofs")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        throw new Error('Gagal mengunggah file: ' + uploadError.message);
      }
      
      const finalPaymentAmount = (parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0);

      onCompleteDelivery({
        paymentAmount: finalPaymentAmount,
        paymentMethod,
        receivedByName,
        returnedQty: parseInt(formState.returnedQty, 10) || 0,
        borrowedQty: parseInt(formState.borrowedQty, 10) || 0,
        purchasedEmptyQty: parseInt(formState.purchasedEmptyQty, 10) || 0,
        transportCost: parseFloat(formState.transportCost) || 0,
        proofFileUrl: filePath,
      });
      
    } catch (error) {
      console.error('Error during upload:', error);
      toast.error('Gagal menyelesaikan pesanan: ' + error.message);
      setLoading(false);
    }
  };

  const hasReturnableItems = order?.order_items.some(item => item.products?.is_returnable);
  const isPaid = order?.payment_status === 'paid';
  const deliveredQty = order?.order_items.reduce((sum, item) => sum + (item.qty || 0), 0);
  
  const showPaymentFields = !isPaid && order?.remaining_due > 0;
  
  const combinedPaymentMethods = [
    { id: 'pending', method_name: 'Pending', type: 'pending' },
    { id: 'hybrid', method_name: 'Tunai & Transfer', type: 'hybrid' },
    ...paymentMethods
  ];
  
  const selectedMethod = combinedPaymentMethods.find(m => m.method_name === paymentMethod);
  const showCashFields = showPaymentFields && (selectedMethod?.type === 'cash' || selectedMethod?.type === 'hybrid');
  const showTransferFields = showPaymentFields && (selectedMethod?.type === 'transfer' || selectedMethod?.type === 'hybrid');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[#10182b]">Selesaikan Pesanan</DialogTitle>
          <DialogDescription>
            Lengkapi detail pembayaran, pengembalian galon, dan bukti pengiriman untuk pesanan #{order?.id.slice(0, 8)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUploadAndComplete}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* Payment Section */}
            {showPaymentFields && (
              <>
                <div className="md:col-span-2">
                  <Separator />
                  <p className="text-sm font-semibold mt-4 mb-2 text-[#10182b]">Informasi Pembayaran</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod" className="text-muted-foreground">Metode Pembayaran</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih metode pembayaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {combinedPaymentMethods.map(method => (
                        <SelectItem key={method.id} value={method.method_name}>
                          {method.method_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Conditional fields for cash and transfer */}
                {showCashFields && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="receivedByName" className="text-muted-foreground">Nama Penerima</Label>
                      <Input
                        id="receivedByName"
                        placeholder="Masukkan nama penerima"
                        value={receivedByName}
                        onChange={(e) => setReceivedByName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cashAmount" className="text-muted-foreground">Jumlah Pembayaran Tunai</Label>
                      <Input
                        id="cashAmount"
                        type="number"
                        placeholder="Jumlah Pembayaran Tunai"
                        value={cashAmount}
                        onChange={(e) => handleAmountChange(e, setCashAmount)}
                        required
                        min="0"
                      />
                    </div>
                  </>
                )}
                
                {showTransferFields && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="transferAmount" className="text-muted-foreground">Jumlah Pembayaran Transfer</Label>
                      <Input
                        id="transferAmount"
                        type="number"
                        placeholder="Jumlah Pembayaran Transfer"
                        value={transferAmount}
                        onChange={(e) => handleAmountChange(e, setTransferAmount)}
                        required
                        min="0"
                      />
                    </div>
                  </>
                )}
              </>
            )}
            
            <div className="md:col-span-2">
              <Separator />
              <p className="text-sm font-semibold mt-4 mb-2 text-[#10182b]">Detail Pengiriman & Barang</p>
            </div>
            
            {hasReturnableItems && (
              <>
                <p className="md:col-span-2 text-sm text-muted-foreground">Pesanan ini dikirim {deliveredQty} galon yang dapat dikembalikan.</p>
                <div className="space-y-2">
                  <Label htmlFor="returnedQty" className="text-muted-foreground">Jumlah Galon Kembali</Label>
                  <Input
                    id="returnedQty"
                    type="number"
                    placeholder="Jumlah Galon Kembali"
                    value={formState.returnedQty}
                    onChange={handleFormChange}
                    required
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="borrowedQty" className="text-muted-foreground">Jumlah Galon Dipinjam</Label>
                   <Input
                    id="borrowedQty"
                    type="number"
                    placeholder="Jumlah Galon Dipinjam"
                    value={formState.borrowedQty}
                    onChange={handleFormChange}
                    required
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchasedEmptyQty" className="text-muted-foreground">Jumlah Galon Kosong Dibeli</Label>
                  <Input
                  id="purchasedEmptyQty"
                  type="number"
                  placeholder="Jumlah Galon Kosong Dibeli"
                  value={formState.purchasedEmptyQty || 0}
                  onChange={handleFormChange}
                  min="0"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="transportCost" className="text-muted-foreground">Biaya Transportasi</Label>
              <Input
                id="transportCost"
                type="number"
                placeholder="Biaya Transportasi"
                value={formState.transportCost}
                onChange={handleFormChange}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="proofFile" className="text-muted-foreground">Unggah Bukti Pengiriman</Label>
              <Input
                id="proofFile"
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                accept="image/*"
                required
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full bg-[#10182b] text-white hover:bg-[#20283b]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Selesaikan Pesanan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProofOfDeliveryForm;