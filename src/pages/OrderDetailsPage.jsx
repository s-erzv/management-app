// src/pages/OrderDetailsPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import OrderItems from '@/components/OrderItems';
import ProofOfDeliveryForm from '@/components/ProofOfDeliveryForm';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const OrderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate()
  const { session, userRole } = useAuth();
  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [proofUrl, setProofUrl] = useState(null);
  const [isProofFormOpen, setIsProofFormOpen] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [transferProofFile, setTransferProofFile] = useState(null);
  const [receivedBy, setReceivedBy] = useState('');


  useEffect(() => {
    fetchData();
  }, [id, session]);

   const fetchData = async () => {
  setLoading(true);
  setError(null);

   if (!id) {
    console.error("Order ID is missing.");
    setError({ message: "ID Pesanan tidak ditemukan. Kembali ke halaman utama" });
    setLoading(false);
    return;
  }

  // ambil order + relasi
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      customers (name, phone, address),
      couriers:profiles (full_name),
      order_items:order_items(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching order details:", error);
    toast.error("Gagal mengambil detail pesanan.");
    setError(error);
    setOrder(null);
    setLoading(false);
    return;
  }

  if (!data) {
    toast.error("Pesanan tidak ditemukan.");
    setError({ message: "Pesanan tidak ditemukan." });
    setOrder(null);
    setLoading(false);
    return;
  }

  setOrder(data);

  // Perbaiki: ambil URL publik langsung dari path yang disimpan
  if (data.proof_of_delivery_url) {
    const { data: publicUrlData } = supabase.storage
      .from("proofs")
      .getPublicUrl(data.proof_of_delivery_url);
    
    setProofUrl(publicUrlData.publicUrl);
  }

  // ambil payments
  const { data: paymentsData, error: paymentsError } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", data.id)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("Error fetching payments:", paymentsError);
  } else {
    setPayments(paymentsData);
  }

  setLoading(false);
};


  
  const handleItemsUpdated = (items) => {
    if (order) {
      const updatedOrder = { ...order, order_items: items };
      setOrder(updatedOrder);
    }
  };

  const calculateTotal = (items) => {
    return items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  };
  
  const calculateTotalPaid = () => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  };
  
  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Jumlah pembayaran tidak valid.');
      return;
    }
    
    setLoading(true);
    
    const orderCompanyId = order.company_id;

    let transferProofUrl = null;
    if (paymentMethod === 'transfer_bsi' && transferProofFile) {
        try {
            const fileExt = transferProofFile.name.split('.').pop();
            const filePath = `${order.id}/transfer_proofs/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('proofs')
                .upload(filePath, transferProofFile);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('proofs')
                .getPublicUrl(filePath);
            transferProofUrl = publicUrlData.publicUrl;
        } catch (error) {
            console.error('Error uploading transfer proof:', error);
            toast.error('Gagal mengunggah bukti transfer.');
            setLoading(false);
            return;
        }
    }
    
    const { data: newPayment, error: insertError } = await supabase
      .from('payments')
      .insert({
        order_id: order.id,
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        paid_at: new Date().toISOString(),
        company_id: orderCompanyId,
        proof_url: transferProofUrl,
        received_by: paymentMethod === 'cash' ? receivedBy : null,
      })
      .select();

    if (insertError) {
      console.error('Error adding payment:', insertError);
      toast.error('Gagal menambahkan pembayaran.');
      setLoading(false);
      return;
    }
    
    const totalPaidAfterNew = calculateTotalPaid() + parseFloat(paymentAmount);
    const orderTotal = calculateTotal(order.order_items);
    let newStatus = 'unpaid';
    if (totalPaidAfterNew >= orderTotal) {
      newStatus = 'paid';
    } else if (totalPaidAfterNew > 0) {
      newStatus = 'partial';
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: newStatus })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating payment status:', updateError);
      toast.error('Gagal memperbarui status pembayaran.');
    } else {
      toast.success('Pembayaran berhasil ditambahkan dan status diperbarui.');
      setPaymentAmount('');
      setPayments([...payments, ...newPayment]);
      setOrder({ ...order, payment_status: newStatus });
      setTransferProofFile(null);
      setReceivedBy('');
    }
    setLoading(false);
  };

  const handleCompleteDelivery = async (deliveryData) => {
    if (!order?.id) {
        toast.error('ID pesanan tidak ditemukan.');
        return;
    }
    setLoading(true);
    try {
      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/complete-delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          ...deliveryData,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        setIsProofFormOpen(false);
        fetchData();
      } else {
        throw new Error(result.error || 'Terjadi kesalahan saat menyelesaikan pesanan.');
      }
    } catch (error) {
      console.error('Error completing delivery:', error);
      toast.error('Gagal menyelesaikan pesanan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id);

    if (error) {
      console.error('Error updating order status:', error);
      toast.error('Gagal memperbarui status pesanan.');
    } else {
      setOrder({ ...order, status: newStatus });
      toast.success('Status pesanan berhasil diperbarui.');
    }
  };
  
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pembayaran ini?')) return;
    setLoading(true);

    const { error: deleteError } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (deleteError) {
      console.error('Error deleting payment:', deleteError);
      toast.error('Gagal menghapus pembayaran.');
    } else {
      toast.success('Pembayaran berhasil dihapus.');
      fetchData();
    }
    setLoading(false);
  };

    const handleSendInvoice = async () => {
      setIsSendingInvoice(true);
      toast.loading('Membuat invoice PDF...', { id: 'invoice-toast' });

      try {
        const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-invoice-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ order_id: order.id }),
        });

        if (!response.ok) {
          throw new Error('Gagal membuat invoice PDF.');
        }

        const { pdfUrl } = await response.json();
        
        const invoiceNumber = order.invoice_number;
        const totalAmount = calculateTotal(order.order_items);
        
        const { data: company, error } = await supabase
          .from('companies')
          .select('name')
          .eq('id', order.company_id)
          .single();

        if (error) {
          console.error('Error fetching company:', error.message);
          throw new Error('Gagal mengambil nama perusahaan.');
        }

        const companyName = company ? company.name : 'Nama Perusahaan';

        const whatsappMessage = `Assalamualaikum warahmatullahi wabarakatuh.
  Yth. Bapak/Ibu ${order.customers.name},

  Dengan hormat, kami sampaikan tagihan untuk pesanan Anda dengan rincian berikut:
  Invoice No. ${invoiceNumber} senilai Rp${totalAmount}.
  Tautan invoice: ${pdfUrl}.

  Metode Pembayaran:

  Tunai (Cash) – dibayarkan saat serah terima/di lokasi.

  Transfer Bank (BSI)
  • Bank: Bank Syariah Indonesia (BSI)
  • No. Rekening: 7177559948
  • A.n.: M Hammam Jafar
  • Berita/Referensi: Invoice ${invoiceNumber} – ${order.customers.name}

  Setelah pembayaran, mohon kirimkan bukti transfer ke nomor ini dan mengonfirmasi pembayaran.
  Jazaakumullaahu khairan atas perhatian dan kerja samanya.
  Wassalamualaikum warahmatullahi wabarakatuh.

  Hormat kami,
  ${companyName}`;

        const whatsappUrl = `https://wa.me/${order.customers.phone}?text=${encodeURIComponent(whatsappMessage)}`;
        
        window.open(whatsappUrl, '_blank');
        
        toast.success('Invoice berhasil dikirim!', { id: 'invoice-toast' });

      } catch (error) {
        console.error('Error sending invoice:', error.message);
        toast.error(error.message, { id: 'invoice-toast' });
      } finally {
        setIsSendingInvoice(false);
      }
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-center items-center h-64 flex-col space-y-4">
          <p className="text-xl text-red-500">Error: {error.message}</p>
          <Button onClick={() => navigate('/orders')}>Kembali ke daftar pesanan</Button>
        </div>
      </div>
    );
  }

  const isEditable = userRole === 'super_admin' || userRole === 'admin';
  const isCourier = userRole === 'user' && order.courier_id === session.user.id;
  
  const orderTotal = calculateTotal(order?.order_items || []);
  const totalPaid = calculateTotalPaid();
  const remainingDue = orderTotal - totalPaid;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Detail Pesanan #{order.id.slice(0, 8)}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ringkasan Pesanan (Kiri Atas) */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Ringkasan Pesanan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Pelanggan</p>
                <p className="font-medium">{order.customers?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status Pengiriman</p>
                <Badge>{order.status}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status Pembayaran</p>
                <Badge variant={
                  order.payment_status === 'paid' ? 'secondary' :
                  order.payment_status === 'unpaid' ? 'destructive' : 'default'
                }>
                  {order.payment_status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Harga</p>
                <p className="font-medium">Rp{orderTotal}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tanggal Pengiriman</p>
                <p className="font-medium">{order.planned_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Kurir</p>
                <p className="font-medium">{order.couriers?.full_name ?? 'Belum Ditugaskan'}</p>
              </div>
            </div>
            <Separator />
            <p className="text-sm text-gray-500">Catatan</p>
            <p>{order.notes ?? 'Tidak ada catatan.'}</p>
          </CardContent>
        </Card>

        {/* Item Pesanan (Kanan Atas) */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Item Pesanan</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderItems 
              orderId={order.id} 
              orderItems={order.order_items} 
              isEditable={isEditable} 
              onItemsUpdated={handleItemsUpdated} 
            />
          </CardContent>
        </Card>

        {/* Aksi Admin (Kiri Bawah) */}
        {isEditable && (
          <Card>
            <CardHeader>
              <CardTitle>Aksi Admin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            <Button
                variant="secondary"
                onClick={handleSendInvoice}
                disabled={isSendingInvoice}
                className="w-full"
            >
                {isSendingInvoice ? 'Mengirim...' : 'Kirim Invoice'}
            </Button>
            <Separator/>
              <div className="space-y-2">
                <h4 className="text-lg font-semibold">Catat Pembayaran</h4>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="amount">Jumlah Pembayaran</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Masukkan jumlah..."
                  />
                </div>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="payment-method">Metode Pembayaran</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Tunai (Cash)</SelectItem>
                      <SelectItem value="transfer_bsi">Transfer BSI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod === 'transfer_bsi' && (
                  <>
                  <Input
                    type="file"
                    onChange={(e) => setTransferProofFile(e.target.files[0])}
                    accept="image/*"
                  />
                  <div className="mt-2 p-3 rounded-md border bg-gray-50 text-sm">
                    <p className="font-semibold">Detail Transfer:</p>
                    <p>Bank: Bank Syariah Indonesia (BSI)</p>
                    <p>No. Rekening: 7177559948</p>
                    <p>A.n: M Hammam Jafar</p>
                  </div>
                  </>
                )}
                {paymentMethod === 'cash' && (
                  <Input
                    id="receivedBy"
                    placeholder="Nama penerima kas"
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                  />
                )}
                <Button onClick={handleAddPayment} className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambahkan Pembayaran'}
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-lg font-semibold">Riwayat Pembayaran</h4>
                {payments.length > 0 ? (
                  payments.map((p, index) => (
                    <div key={p.id} className="flex justify-between items-center text-sm">
                      <p>
                        Pembayaran #{payments.length - index}: Rp{p.amount} ({p.method})
                      </p>
                      <Button variant="destructive" size="sm" onClick={() => handleDeletePayment(p.id)}>Hapus</Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Belum ada pembayaran.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bukti Pengiriman (Kanan Bawah) */}
        {isEditable && (
          <Card>
            <CardHeader>
              <CardTitle>Bukti Pengiriman</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {proofUrl ? (
                <img
                  src={proofUrl}
                  alt="Bukti Pengiriman"
                  className="w-full max-w-sm rounded-md border"
                />
              ) : (
                <p className="text-sm text-gray-500">Belum ada bukti pengiriman.</p>
              )}
              <p>Galon Dikembalikan: {order.returned_qty}</p>
              <p>Galon Dipinjam: {order.borrowed_qty}</p>
              <p>Biaya Transportasi: Rp{order.transport_cost}</p>
            </CardContent>
          </Card>
        )}

        {/* Aksi Kurir (Tampil terpisah di bawah jika bukan admin) */}
        {isCourier && order.status !== 'completed' && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Aksi Kurir</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setIsProofFormOpen(true)} className="w-full">
                Selesaikan Pesanan
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ProofOfDeliveryForm
        isOpen={isProofFormOpen}
        onOpenChange={setIsProofFormOpen}
        order={order}
        onCompleteDelivery={handleCompleteDelivery}
      />
    </div>
  );
};

export default OrderDetailsPage;