import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Send, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card } from './ui/card';

const WhatsappOrderModal = ({ isOpen, onOpenChange, orderId, orderDate, orderItems, products, suppliers }) => {
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [customPhoneNumber, setCustomPhoneNumber] = useState('');

  const selectedSupplierData = useMemo(() => {
    if (selectedSupplier === 'custom') {
      return { phone: customPhoneNumber };
    }
    return suppliers.find(s => s.id === selectedSupplier);
  }, [selectedSupplier, suppliers, customPhoneNumber]);

  const filteredOrderItems = useMemo(() => {
    if (!selectedSupplier) {
      return orderItems;
    }
    if (selectedSupplier === 'custom') {
      return orderItems;
    }
    
    // Filter items based on the selected supplier
    return orderItems.filter(item => {
      const product = products.find(p => p.id === item.product_id);
      return product?.supplier_id === selectedSupplier;
    });
  }, [selectedSupplier, orderItems, products]);

  const generateOrderMessage = (isConfirm) => {
    if (!selectedSupplierData?.phone && !customPhoneNumber) {
      toast.error('Harap pilih supplier atau masukkan nomor telepon.');
      return '';
    }

    const orderItemsList = filteredOrderItems
      .map(item => {
        const productName = products.find(p => p.id === item.product_id)?.name || 'Produk';
        const qty = item.qty || 0;
        return `- ${productName}: ${qty}`;
      })
      .join('\n');
      
    const formattedDate = format(new Date(orderDate), 'EEEE, d MMMM yyyy', { locale: id });

    let headerMessage;
    if (isConfirm) {
      headerMessage = `*Pesan Konfirmasi Order (Nomor Order: #${orderId?.slice(0, 8)})*`;
    } else {
      headerMessage = `*Pesan Final Order (Nomor Order: #${orderId?.slice(0, 8)})*`;
    }

    return `${headerMessage}

Kami ingin mengkonfirmasi pesanan dengan rincian berikut:
Tanggal Order: ${formattedDate}
Daftar Barang:
${orderItemsList}

Mohon konfirmasi ketersediaan barang dan harga terbaru.
Terima kasih.`;
  };

  const handleSendMessage = (isConfirm) => {
    const message = generateOrderMessage(isConfirm);
    if (message) {
      const phone = selectedSupplierData?.phone || customPhoneNumber;
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      onOpenChange(false);
    }
  };

  const isFormValid = !!selectedSupplierData?.phone || (selectedSupplier === 'custom' && customPhoneNumber);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kirim Pesan Konfirmasi Order</DialogTitle>
          <DialogDescription>
            Pilih supplier atau masukkan nomor telepon untuk mengirimkan detail pesanan melalui WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="supplier-select">Pilih Supplier</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger id="supplier-select">
                <SelectValue placeholder="Pilih Supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.phone})
                  </SelectItem>
                ))}
                <SelectItem value="custom">Nomor Telepon Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedSupplier === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-phone">Nomor Telepon</Label>
              <Input
                id="custom-phone"
                type="tel"
                placeholder="Masukkan nomor telepon, misal: 628123456789"
                value={customPhoneNumber}
                onChange={(e) => setCustomPhoneNumber(e.target.value)}
              />
            </div>
          )}
          {selectedSupplier && filteredOrderItems.length > 0 && (
            <div className="space-y-2 mt-4">
              <Label>Ringkasan Pesanan untuk Supplier Ini:</Label>
              <Card className="p-4 bg-gray-100">
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {filteredOrderItems.map(item => {
                    const product = products.find(p => p.id === item.product_id);
                    return (
                        <li key={item.product_id}>
                            {product?.name} ({item.qty})
                        </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          )}
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            className="w-full sm:w-auto"
            onClick={() => handleSendMessage(true)}
            disabled={!isFormValid}
          >
            <Send className="h-4 w-4 mr-2" />
            Konfirmasi Order
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => handleSendMessage(false)}
            disabled={!isFormValid}
            variant="ghost"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Pesan Final Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsappOrderModal;