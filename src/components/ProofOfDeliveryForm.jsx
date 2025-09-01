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

const ProofOfDeliveryForm = ({ isOpen, onOpenChange, order, onCompleteDelivery }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receivedByName, setReceivedByName] = useState('');
  const [cashAmount, setCashAmount] = useState(''); // State baru untuk nominal tunai
  const [transferAmount, setTransferAmount] = useState(''); // State baru untuk nominal transfer
  const [formState, setFormState] = useState({
    returnedQty: 0,
    borrowedQty: 0,
    purchasedEmptyQty: 0,
    transportCost: '',
  });

  useEffect(() => {
    if (order) {
      setFormState({
        returnedQty: 0,
        borrowedQty: 0,
        purchasedEmptyQty: 0,
        transportCost: order.transport_cost ?? '0',
      });
      setFile(null);
      setPaymentMethod('cash');
      setReceivedByName('');
      setCashAmount(order.remaining_due > 0 ? order.remaining_due.toString() : '0'); // Atur nominal cash di awal
      setTransferAmount('0');
    }
  }, [order]);
  
  // Efek untuk mereset nominal saat metode pembayaran berubah
  useEffect(() => {
    if (paymentMethod === 'cash') {
      setCashAmount(order?.remaining_due > 0 ? order.remaining_due.toString() : '0');
      setTransferAmount('0');
    } else if (paymentMethod === 'transfer') {
      setCashAmount('0');
      setTransferAmount(order?.remaining_due > 0 ? order.remaining_due.toString() : '0');
    } else if (paymentMethod === 'both') {
      setCashAmount(order?.remaining_due > 0 ? order.remaining_due.toString() : '0');
      setTransferAmount('0');
    } else {
      setCashAmount('0');
      setTransferAmount('0');
    }
  }, [paymentMethod, order]);

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
      const filePath = `${order.id}/${fileName}`;
      
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
  const showCashFields = showPaymentFields && (paymentMethod === 'cash' || paymentMethod === 'both');
  const showTransferFields = showPaymentFields && (paymentMethod === 'transfer' || paymentMethod === 'both');
  const showPendingOption = order?.payment_status === 'unpaid' && order?.remaining_due > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Selesaikan Pesanan</DialogTitle>
          <DialogDescription>
            Lengkapi detail pembayaran, pengembalian galon, dan bukti pengiriman untuk pesanan #{order?.id.slice(0, 8)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUploadAndComplete}>
          <div className="grid gap-4 py-4">
            {/* Payment Section */}
            {showPaymentFields && (
              <>
                <Separator />
                <p className="text-sm font-semibold">Informasi Pembayaran</p>
                <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih metode pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tunai (Cash)</SelectItem>
                    <SelectItem value="transfer">Transfer BSI</SelectItem>
                    <SelectItem value="both">Tunai & Transfer</SelectItem>
                    {showPendingOption && <SelectItem value="pending">Pending</SelectItem>}
                  </SelectContent>
                </Select>

                {/* Conditional fields for cash and transfer */}
                {showCashFields && (
                  <>
                    <Label htmlFor="receivedByName">Nama Penerima</Label>
                    <Input
                      id="receivedByName"
                      placeholder="Masukkan nama penerima"
                      value={receivedByName}
                      onChange={(e) => setReceivedByName(e.target.value)}
                      required
                    />
                    <Label htmlFor="cashAmount">Jumlah Pembayaran Tunai</Label>
                    <Input
                      id="cashAmount"
                      type="number"
                      placeholder="Jumlah Pembayaran Tunai"
                      value={cashAmount}
                      onChange={(e) => handleAmountChange(e, setCashAmount)}
                      required
                      min="0"
                    />
                  </>
                )}
                
                {showTransferFields && (
                  <>
                    <Label htmlFor="transferAmount">Jumlah Pembayaran Transfer</Label>
                    <Input
                      id="transferAmount"
                      type="number"
                      placeholder="Jumlah Pembayaran Transfer"
                      value={transferAmount}
                      onChange={(e) => handleAmountChange(e, setTransferAmount)}
                      required
                      min="0"
                    />
                  </>
                )}
              </>
            )}
            
            <Separator />
            <p className="text-sm font-semibold">Detail Pengiriman & Barang</p>
            {hasReturnableItems && (
              <>
                <p className="text-sm text-muted-foreground">Pesanan ini dikirim {deliveredQty} galon yang dapat dikembalikan.</p>
                <Label htmlFor="returnedQty">Jumlah Galon Kembali</Label>
                <Input
                  id="returnedQty"
                  type="number"
                  placeholder="Jumlah Galon Kembali"
                  value={formState.returnedQty}
                  onChange={handleFormChange}
                  required
                  min="0"
                />
                <Label htmlFor="borrowedQty">Jumlah Galon Dipinjam</Label>
                 <Input
                  id="borrowedQty"
                  type="number"
                  placeholder="Jumlah Galon Dipinjam"
                  value={formState.borrowedQty}
                  onChange={handleFormChange}
                  required
                  min="0"
                />
                <Label htmlFor="purchasedEmptyQty">Jumlah Galon Kosong Dibeli</Label>
                <Input
                id="purchasedEmptyQty"
                type="number"
                placeholder="Jumlah Galon Kosong Dibeli"
                value={formState.purchasedEmptyQty || 0}
                onChange={handleFormChange}
                min="0"
                />
              </>
            )}

            <Label htmlFor="transportCost">Biaya Transportasi</Label>
            <Input
              id="transportCost"
              type="number"
              placeholder="Biaya Transportasi"
              value={formState.transportCost}
              onChange={handleFormChange}
            />

            <Label htmlFor="proofFile">Unggah Bukti Pengiriman</Label>
            <Input
              id="proofFile"
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              accept="image/*"
              required
            />
          </div>
          
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Selesaikan Pesanan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProofOfDeliveryForm;