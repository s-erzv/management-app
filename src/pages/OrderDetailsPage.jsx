import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Eye, CreditCard, Banknote } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import OrderItems from '@/components/OrderItems';
import ProofOfDeliveryForm from '@/components/ProofOfDeliveryForm';

const OrderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, userRole, userId, isAuthenticated } = useAuth();

  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');

  const [isProofFormOpen, setIsProofFormOpen] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);

  // trigger reload
  const [reloadKey, setReloadKey] = useState(0);

  // fetch data
  useEffect(() => {
    if (!id || !isAuthenticated) return;

    const fetchData = async () => {
      console.log('Fetching data for order:', id);
      setLoading(true);
      setError(null);

      try {
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select(`
            *,
            customers (name, phone, address),
            couriers:profiles (full_name),
            order_items (id, qty, price, item_type, products(name, is_returnable))
          `)
          .eq("id", id)
          .single();

        if (orderError) {
          console.error("Error fetching order details:", orderError);
          toast.error("Gagal mengambil detail pesanan.");
          setError(orderError);
          return;
        }

        if (!orderData) {
          toast.error("Pesanan tidak ditemukan.");
          setError({ message: "Pesanan tidak ditemukan." });
          return;
        }

        let orderWithProof = orderData;
        if (orderData.proof_of_delivery_url) {
          const { data: publicUrlData } = supabase.storage
            .from("proofs")
            .getPublicUrl(orderData.proof_of_delivery_url);
          orderWithProof = {
            ...orderData,
            proof_of_delivery_public_url: publicUrlData.publicUrl,
          };
        }

        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select(`
            *,
            received_by:profiles(full_name),
            payment_method:payment_method_id(method_name, type)
          `)
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: false });

        let paymentsWithUrls = [];
        if (!paymentsError && paymentsData) {
          paymentsWithUrls = await Promise.all(
            paymentsData.map(async (p) => {
              if (p.proof_url) {
                const { data: publicUrlData } = await supabase.storage
                  .from('proofs')
                  .getPublicUrl(p.proof_url);
                return { ...p, proof_public_url: publicUrlData.publicUrl };
              }
              return p;
            })
          );
        }

        const { data: methodsData, error: methodsError } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('company_id', orderData.company_id);

        setOrder(orderWithProof);
        setPayments(paymentsWithUrls);
        if (!methodsError && methodsData) {
          setPaymentMethods(methodsData);
        }

        if (paymentsError) {
          console.error("Error fetching payments:", paymentsError);
          toast.error("Gagal memuat riwayat pembayaran.");
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError({ message: err.message || "Terjadi kesalahan tidak terduga" });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isAuthenticated, reloadKey]);

  // default payment method
  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethodId) {
      setPaymentMethodId(paymentMethods[0].id);
    }
  }, [paymentMethods]);

  // fungsi untuk trigger reload
  const handleItemsUpdated = () => setReloadKey(k => k + 1);

  const calculateTotal = (items) => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + item.qty * item.price, 0);
  };

  const calculateTotalPaid = () => {
    if (!payments || !Array.isArray(payments)) return 0;
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Jumlah pembayaran tidak valid.');
      return;
    }
    
    setLoading(true);
    
    try {
      const orderCompanyId = order.company_id;
      const selectedMethod = paymentMethods.find(m => m.id === paymentMethodId);

      const { data: newPayment, error: insertError } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          amount: parseFloat(paymentAmount),
          payment_method_id: paymentMethodId,
          paid_at: new Date().toISOString(),
          company_id: orderCompanyId,
          received_by: selectedMethod?.type === 'cash' ? userId : null,
        })
        .select();

      if (insertError) {
        console.error('Error adding payment:', insertError);
        toast.error('Gagal menambahkan pembayaran.');
        return;
      }
      
      const totalPaidAfterNew = calculateTotalPaid() + parseFloat(paymentAmount);
      const orderTotal = calculateTotal(order.order_items);
      let newPaymentStatus = 'unpaid';
      if (totalPaidAfterNew >= orderTotal) {
        newPaymentStatus = 'paid';
      } else if (totalPaidAfterNew > 0) {
        newPaymentStatus = 'partial';
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_status: newPaymentStatus })
        .eq('id', order.id);

      if (updateError) {
        console.error('Error updating payment status:', updateError);
        toast.error('Gagal memperbarui status pembayaran.');
      } else {
        toast.success('Pembayaran berhasil ditambahkan dan status diperbarui.');
        setPaymentAmount('');
        await fetchData();
      }
    } catch (err) {
      console.error('Error in handleAddPayment:', err);
      toast.error('Terjadi kesalahan saat menambahkan pembayaran.');
    } finally {
      setLoading(false);
    }
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
        await fetchData();
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
  
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pembayaran ini?')) return;
    
    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (deleteError) {
        console.error('Error deleting payment:', deleteError);
        toast.error('Gagal menghapus pembayaran.');
      } else {
        toast.success('Pembayaran berhasil dihapus.');
        await fetchData();
      }
    } catch (err) {
      console.error('Error in handleDeletePayment:', err);
      toast.error('Terjadi kesalahan saat menghapus pembayaran.');
    } finally {
      setLoading(false);
    }
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
        const errorText = await response.text();
        throw new Error(errorText || 'Gagal membuat invoice PDF.');
      }
      const { pdfUrl } = await response.json();
      const whatsappMessage = `Assalamualaikum warahmatullahi wabarakatuh.
Yth. Bapak/Ibu ${order.customers.name},

Dengan hormat, kami sampaikan tagihan untuk pesanan Anda dengan rincian berikut:
Invoice No. ${order.invoice_number} senilai Rp${calculateTotal(order.order_items).toLocaleString('id-ID')}.
Tautan invoice: ${pdfUrl}.

Metode Pembayaran:

Tunai (Cash) – dibayarkan saat serah terima/di lokasi.

Transfer Bank (BSI)
• Bank: Bank Syariah Indonesia (BSI)
• No. Rekening: 7177559948
• A.n.: M Hammam Jafar
• Berita/Referensi: Invoice ${order.invoice_number} – ${order.customers.name}

Setelah pembayaran, mohon kirimkan bukti transfer ke nomor ini dan mengonfirmasi pembayaran.
Jazaakumullaahu khairan atas perhatian dan kerja samanya.
Wassalamualaikum warahmatullahi wabarakatuh.

Hormat kami,
Nama Perusahaan`;
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

  // Early return patterns
   if (loading || !isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2">Memuat data pesanan...</span>
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

  if (!order) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-center items-center h-64">
          <p className="text-xl text-gray-500">Pesanan tidak ditemukan.</p>
        </div>
      </div>
    );
  }

  // computed
  const isEditable = userRole === 'super_admin' || userRole === 'admin';
  const isCourier = userRole === 'user' && order.courier_id === userId;
  const isPaid = order?.payment_status === 'paid';

  const orderTotal = calculateTotal(order?.order_items || []);
  const totalPaid = calculateTotalPaid();
  const remainingDue = orderTotal - totalPaid;
  const isPaymentFormDisabled = isPaid || remainingDue <= 0;

  const paymentMethodsCash = paymentMethods.filter(m => m.type === 'cash');
  const paymentMethodsTransfer = paymentMethods.filter(m => m.type === 'transfer');

  const paymentFormIsValid = paymentAmount && parseFloat(paymentAmount) > 0 && paymentMethodId;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Detail Pesanan #{order.invoice_number}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ringkasan Pesanan */}
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
                  order.payment_status === 'paid' ? 'default' :
                  order.payment_status === 'unpaid' ? 'destructive' : 'secondary'
                }>
                  {order.payment_status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Harga</p>
                <p className="font-medium">Rp{orderTotal.toLocaleString('id-ID')}</p>
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

        {/* Item Pesanan */}
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

        {/* Aksi Admin & Pembayaran */}
        {isEditable && (
          <Card>
            <CardHeader>
              <CardTitle>Aksi Admin & Pembayaran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">Sisa Tagihan</p>
                <p className="font-bold text-lg text-red-600">{`Rp${remainingDue.toLocaleString('id-ID')}`}</p>
              </div>
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
                    disabled={isPaymentFormDisabled}
                  />
                </div>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="payment-method">Metode Pembayaran</Label>
                  <Select value={paymentMethodId} onValueChange={setPaymentMethodId} disabled={isPaymentFormDisabled}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih metode" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethodsCash.map(method => (
                        <SelectItem key={method.id} value={method.id}>
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4" />
                            <span>{method.method_name} ({method.type})</span>
                          </div>
                        </SelectItem>
                      ))}
                      <Separator />
                      {paymentMethodsTransfer.map(method => (
                        <SelectItem key={method.id} value={method.id}>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span>{method.method_name} ({method.type})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isPaymentFormDisabled && (
                  <p className="text-sm text-green-600 mt-2">Pesanan ini sudah lunas, tidak bisa menambah pembayaran lagi.</p>
                )}
                <Button onClick={handleAddPayment} className="w-full" disabled={loading || !paymentFormIsValid}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambahkan Pembayaran'}
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-lg font-semibold">Riwayat Pembayaran</h4>
                {payments.length > 0 ? (
                  payments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-b-0">
                      <div>
                        <p className="font-medium">Rp{p.amount.toLocaleString('id-ID')} ({p.payment_method?.method_name})</p>
                        <p className="text-xs text-muted-foreground">Diterima: {p.received_by?.full_name ?? '-'}</p>
                        <p className="text-xs text-muted-foreground">Tanggal: {new Date(p.paid_at).toLocaleDateString()}</p>
                        {p.proof_url && (
                          <a href={p.proof_public_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 mt-1">
                            <Eye className="h-3 w-3" /> Lihat Bukti
                          </a>
                        )}
                      </div>
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

        {/* Bukti Pengiriman */}
        {isEditable && (
          <Card>
            <CardHeader>
              <CardTitle>Bukti Pengiriman</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.proof_of_delivery_url ? (
                <img
                  src={order.proof_of_delivery_public_url}
                  alt="Bukti Pengiriman"
                  className="w-full max-w-sm rounded-md border"
                />
              ) : (
                <p className="text-sm text-gray-500">Belum ada bukti pengiriman.</p>
              )}
              <p>Galon Dikembalikan: {order.returned_qty || 0}</p>
              <p>Galon Dipinjam: {order.borrowed_qty || 0}</p>
              <p>Biaya Transportasi: Rp{(order.transport_cost || 0).toLocaleString('id-ID')}</p>
            </CardContent>
          </Card>
        )}

        {/* Aksi Kurir */}
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