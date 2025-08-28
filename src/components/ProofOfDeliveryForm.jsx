import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ProofOfDeliveryForm = ({ isOpen, onOpenChange, order, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Pilih file gambar untuk diunggah.');
      return;
    }
    setLoading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${order.id}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Unggah file ke Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('proofs')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      toast.error('Gagal mengunggah foto.');
      setLoading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('proofs')
      .getPublicUrl(filePath);

    // Perbarui URL di tabel 'orders'
    const { error: updateError } = await supabase
      .from('orders')
      .update({ proof_of_delivery_url: publicUrlData.publicUrl, status: 'completed' })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      toast.error('Gagal memperbarui data pesanan.');
    } else {
      toast.success('Foto berhasil diunggah dan pesanan diselesaikan!');
      onUploadSuccess();
      onOpenChange(false);
    }

    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unggah Bukti Pengiriman</DialogTitle>
          <DialogDescription>
            Foto bukti pengiriman untuk pesanan #{order?.id.slice(0, 8)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpload} className="space-y-4">
          <Input type="file" onChange={handleFileChange} accept="image/*" required />
          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unggah & Selesaikan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProofOfDeliveryForm;