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

const ProofOfDeliveryForm = ({ isOpen, onOpenChange, order, onCompleteDelivery }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [formState, setFormState] = useState({
    paymentAmount: '',
    returnedQty: 0,
    borrowedQty: 0,
    purchasedEmptyQty: 0,
    transportCost: '',
  });

  useEffect(() => {
    if (order) {
      setFormState({
        paymentAmount: order.remaining_due > 0 ? order.remaining_due.toString() : '0',
        returnedQty: 0,
        borrowedQty: 0,
        purchasedEmptyQty: 0,
        transportCost: order.transport_cost ?? '0',
      });
      setFile(null);
      setPaymentMethod('cash');
    }
  }, [order]);

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormState(prev => ({ ...prev, [id]: value }));
  };

  const handleUploadAndComplete = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Pilih file gambar untuk diunggah.');
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split('.').pop();
      const filePath = `${orderId}/${fileName}`;
      const { data, error } = await supabase.storage
        .from("proofs")
        .upload(filePath, file);

        if (!error) {
        await supabase.from("orders")
            .update({ proof_of_delivery_url: filePath })  
            .eq("id", orderId);
        }


      onCompleteDelivery({
        paymentAmount: parseFloat(formState.paymentAmount) || 0,
        paymentMethod,
        returnedQty: parseInt(formState.returnedQty, 10) || 0,
        borrowedQty: parseInt(formState.borrowedQty, 10) || 0,
        purchasedEmptyQty: parseInt(formState.purchasedEmptyQty, 10) || 0,
        transportCost: parseFloat(formState.transportCost) || 0,
        proofFileUrl: filePath,
      });

      toast.success('Bukti pengiriman berhasil disimpan!');
    } catch (error) {
      console.error('Error during upload:', error);
      toast.error('Gagal menyelesaikan pesanan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const hasReturnableItems = order?.order_items.some(item => item.products?.is_returnable);
  const isPaid = order?.payment_status === 'paid';
  const deliveredQty = order?.order_items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const showPaymentAmountField = !isPaid && (paymentMethod === 'cash' || paymentMethod === 'both');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selesaikan Pesanan</DialogTitle>
          <DialogDescription>
            Lengkapi detail pembayaran, pengembalian galon, dan bukti pengiriman untuk pesanan #{order?.id.slice(0, 8)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUploadAndComplete}>
          <div className="grid gap-4 py-4">
            {!isPaid && (
              <>
                <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih metode pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tunai (Cash)</SelectItem>
                    <SelectItem value="transfer">Transfer BSI</SelectItem>
                    <SelectItem value="both">Tunai & Transfer</SelectItem>
                  </SelectContent>
                </Select>

                {showPaymentAmountField && (
                  <>
                    <Label htmlFor="paymentAmount">Jumlah Pembayaran Tunai</Label>
                    <Input
                      id="paymentAmount"
                      type="number"
                      placeholder="Jumlah Pembayaran Tunai"
                      value={formState.paymentAmount}
                      onChange={handleFormChange}
                      required
                      min="0"
                    />
                  </>
                )}
              </>
            )}
            
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