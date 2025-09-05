// src/pages/OrderDetailsPage.jsx (Optimized + Abort-safe)
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Eye, Trash2, CreditCard, Banknote, RefreshCcw } from 'lucide-react';
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
import ProofOfDeliveryForm from '@/components/ProofOfDeliveryForm';

const OrderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, session } = useAuth();

  const userId = user?.id ?? null;

  // --- states ---
  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opLoading, setOpLoading] = useState(false);
  const [error, setError] = useState(null);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [isProofFormOpen, setIsProofFormOpen] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);

  // Refs untuk cleanup dan prevent race conditions
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { 
      mountedRef.current = false;
      // Cancel ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // --- helpers ---
  const isAbortErr = (e) => !!e && (
    e.name === 'AbortError' ||
    e.code === '20' ||
    /AbortError/i.test(e.message || '')
  );

  const calculateOrderTotal = useCallback((items) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
  }, []);

  const calculatePaymentsTotal = useCallback((rows) => {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, []);

  const fetchData = useCallback(async (showLoading = true) => {
    // Guard clauses - early return
    if (!id || !isAuthenticated) {
      if (mountedRef.current) setLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (showLoading && mountedRef.current) {
      setLoading(true);
    }
    
    if (mountedRef.current) {
      setError(null);
    }

    try {
      // 1) Load order first
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          customers (name, phone, address),
          courier_profile:profiles!orders_courier_id_fkey1(full_name),
          order_items (id, qty, price, item_type, products(name, is_returnable))
        `)
        .eq('id', id)
        .abortSignal(abortControllerRef.current.signal)
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('Pesanan tidak ditemukan.');

      // Build proof URL if exists
      let proofPublicUrl;
      if (orderData.proof_of_delivery_url) {
        const { data: p } = supabase.storage
          .from('proofs')
          .getPublicUrl(orderData.proof_of_delivery_url);
        proofPublicUrl = p?.publicUrl;
      }

      // 2) Fetch related data in parallel
      const [paymentsRes, methodsRes] = await Promise.all([
        supabase
          .from('payments')
          .select(`*, received_by:profiles(full_name), payment_method:payment_method_id(method_name, type)`)
          .eq('order_id', orderData.id)
          .order('created_at', { ascending: false })
          .abortSignal(abortControllerRef.current.signal),
        supabase
          .from('payment_methods')
          .select('*')
          .eq('company_id', orderData.company_id)
          .abortSignal(abortControllerRef.current.signal),
      ]);

      // Handle partial errors (ignore aborts)
      if (paymentsRes.error && !isAbortErr(paymentsRes.error)) {
        console.warn('Payments fetch error:', paymentsRes.error);
        toast.error('Gagal memuat riwayat pembayaran.');
      }
      if (methodsRes.error && !isAbortErr(methodsRes.error)) {
        console.warn('Payment methods fetch error:', methodsRes.error);
        toast.error('Gagal memuat metode pembayaran.');
      }

      // Process payments with proof URLs
      let paymentsWithUrls = paymentsRes.data || [];
      if (paymentsWithUrls.length > 0) {
        paymentsWithUrls = await Promise.all(
          paymentsWithUrls.map(async (p) => {
            if (!p.proof_url) return p;
            const { data: pub } = await supabase.storage
              .from('payment_proofs')
              .getPublicUrl(p.proof_url);
            return { ...p, proof_public_url: pub?.publicUrl };
          })
        );
      }

      const nextOrder = {
        ...orderData,
        proof_public_url: proofPublicUrl || null,
      };

      if (mountedRef.current) {
        setOrder(nextOrder);
        setPayments(paymentsWithUrls);
        setPaymentMethods(methodsRes.data || []);
      }
    } catch (err) {
      // Check specifically for the AbortError
      if (isAbortErr(err)) {
        // This is the intended behavior, so we don't need to log it as an error
        console.log('Request aborted by cleanup or new fetch.');
        return;
      }
      
      if (mountedRef.current) {
        console.error('fetchData error', err);
        setError({ message: err.message || 'Terjadi kesalahan tidak terduga' });
      }
    } finally {
      if (mountedRef.current && showLoading) {
        setLoading(false);
      }
    }
  }, [id, isAuthenticated]);

  // Initial data fetch with stable dependencies
  useEffect(() => {
    let timeoutId;
    
    // Debounce to prevent rapid successive calls
    if (id && isAuthenticated) {
      timeoutId = setTimeout(() => {
        fetchData(true);
      }, 150);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id, isAuthenticated, fetchData]);

  const orderTotal = useMemo(() => {
    if (!order) return 0;
    return calculateOrderTotal(order.order_items || []);
  }, [order, calculateOrderTotal]);

  const totalPaid = useMemo(() => calculatePaymentsTotal(payments), [payments, calculatePaymentsTotal]);
  const remainingDue = Math.max(0, (Number(order?.grand_total) || orderTotal) - totalPaid);
  const isPaid = remainingDue <= 0.0001;

  const normalizedMethods = useMemo(
    () => (paymentMethods || []).map(m => ({
      id: m.id,
      method_name: m.method_name,
      type: m.type, // 'cash' | 'transfer' | ...
    })),
    [paymentMethods]
  );
  
  const paymentMethodsCash = useMemo(() => 
    normalizedMethods.filter(m => m.type === 'cash'), 
    [normalizedMethods]
  );
  
  const paymentMethodsTransfer = useMemo(() => 
    normalizedMethods.filter(m => m.type === 'transfer'), 
    [normalizedMethods]
  );

  // Set default payment method only once
  const effectivePaymentMethodId = paymentMethodId || (normalizedMethods[0]?.id ?? '');
  
  const selectedMethod = useMemo(
    () => normalizedMethods.find(m => String(m.id) === String(effectivePaymentMethodId)),
    [normalizedMethods, effectivePaymentMethodId]
  );

  const paymentFormIsValid = paymentAmount && parseFloat(paymentAmount) > 0 && effectivePaymentMethodId;
  const isPaymentFormDisabled = isPaid || remainingDue <= 0;

  // --- actions ---
  const handleDataUpdate = useCallback(() => {
    fetchData(false); // Refresh without showing main loading
  }, [fetchData]);

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!paymentFormIsValid) {
      toast.error('Form pembayaran belum valid.');
      return;
    }
    if (!order) return;

    setOpLoading(true);
    try {
      const amountNum = parseFloat(paymentAmount);
      const { data: inserted, error: insertError } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          amount: amountNum,
          payment_method_id: effectivePaymentMethodId,
          paid_at: new Date().toISOString(),
          company_id: order.company_id,
          received_by: selectedMethod?.type === 'cash' ? userId : null,
        })
        .select();

      if (insertError) throw insertError;

      const newTotalPaid = totalPaid + amountNum;
      const newStatus = (newTotalPaid >= (Number(order.grand_total) || orderTotal)) ? 'paid' : 'partial';
      const { error: updErr } = await supabase
        .from('orders')
        .update({ payment_status: newStatus })
        .eq('id', order.id);

      if (updErr) throw updErr;

      toast.success('Pembayaran berhasil ditambahkan.');
      setPaymentAmount('');
      setPaymentMethodId('');
      handleDataUpdate();
    } catch (err) {
      if (!isAbortErr(err)) {
        console.error('add-payment error', err);
        toast.error(err.message || 'Gagal menambahkan pembayaran.');
      }
    } finally {
      setOpLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!paymentId) return;
    setOpLoading(true);
    try {
      const { error: delErr } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (delErr) throw delErr;

      toast.success('Pembayaran dihapus.');
      handleDataUpdate();
    } catch (err) {
      if (!isAbortErr(err)) {
        console.error('delete-payment error', err);
        toast.error(err.message || 'Gagal menghapus pembayaran.');
      }
    } finally {
      setOpLoading(false);
    }
  };

  const handleCompleteDelivery = async (payload) => {
    if (!order) return;
    setOpLoading(true);
    try {
      const { error: updErr } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          proof_of_delivery_url: payload?.path || null,
        })
        .eq('id', order.id);
      if (updErr) throw updErr;

      toast.success('Pengiriman diselesaikan.');
      setIsProofFormOpen(false);
      handleDataUpdate();
    } catch (err) {
      if (!isAbortErr(err)) {
        console.error('complete-delivery error', err);
        toast.error(err.message || 'Gagal menyelesaikan pengiriman.');
      }
    } finally {
      setOpLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!order) return;
    setIsSendingInvoice(true);
    toast.loading('Membuat invoice PDF...', { id: 'invoice-toast' });
    try {
      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-invoice-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ order_id: order.id }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Gagal membuat invoice PDF.');
      }
      const { pdfUrl } = await response.json();
      const whatsappMessage = `Assalamualaikum warahmatullahi wa...m warahmatullahi wabarakatuh.\n\nHormat kami,\nNama Perusahaan`;
      const whatsappUrl = `https://wa.me/${order.customers.phone}?text=${encodeURIComponent(whatsappMessage)}`;
      window.open(whatsappUrl, '_blank');
      toast.success('Invoice berhasil dikirim!', { id: 'invoice-toast' });
    } catch (err) {
      console.error('send-invoice error', err);
      toast.error(err.message, { id: 'invoice-toast' });
    } finally {
      setIsSendingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Memuat data pesanan...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Terjadi kesalahan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error.message}</p>
            <Button variant="outline" onClick={() => fetchData(true)} className="mt-4">
              <RefreshCcw className="mr-2 h-4 w-4" /> Coba lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Pesanan tidak ditemukan</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Data pesanan tidak tersedia.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Derived values
  const items = order.order_items || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fetchData(false)}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="default" onClick={() => setIsProofFormOpen(true)}>
            <Eye className="mr-2 h-4 w-4" /> Selesaikan Pengiriman
          </Button>
          <Button variant="secondary" onClick={handleSendInvoice} disabled={isSendingInvoice}>
            {isSendingInvoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Kirim Invoice
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detail Pesanan</CardTitle>
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
              <p className="text-sm text-gray-500">Total</p>
              <p className="font-semibold">Rp {order.grand_total?.toLocaleString?.('id-ID') ?? orderTotal.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-2">Item</h3>
            <div className="space-y-2">
              {items.length === 0 && <p className="text-sm text-gray-500">Tidak ada item.</p>}
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{it.products?.name || 'Produk'}</p>
                    <p className="text-gray-500">
                      {Number(it.qty)} × Rp {Number(it.price).toLocaleString('id-ID')} {it.item_type ? `• ${it.item_type}` : ''}
                    </p>
                  </div>
                  <div className="font-semibold">
                    Rp {(Number(it.qty) * Number(it.price)).toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Dibayar</p>
              <p className="font-semibold">Rp {totalPaid.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sisa Tagihan</p>
              <p className="font-semibold">Rp {remainingDue.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge variant={isPaid ? 'default' : 'secondary'}>{isPaid ? 'LUNAS' : 'BELUM LUNAS'}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.length === 0 && <p className="text-sm text-gray-500">Belum ada pembayaran.</p>}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="space-y-0.5">
                  <p className="font-medium">Rp {Number(p.amount).toLocaleString('id-ID')}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(p.paid_at || p.created_at).toLocaleString('id-ID')} • {p.payment_method?.method_name} ({p.payment_method?.type})
                  </p>
                  {p.received_by?.full_name && (
                    <p className="text-xs text-gray-500">Diterima oleh: {p.received_by.full_name}</p>
                  )}
                  {p.proof_public_url && (
                    <a
                      href={p.proof_public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline text-blue-600"
                    >
                      Lihat bukti transfer
                    </a>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDeletePayment(p.id)}
                  disabled={opLoading}
                  title="Hapus pembayaran"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Form Pembayaran */}
        <Card>
          <CardHeader>
            <CardTitle>Tambah Pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                type="number"
                placeholder="Nominal"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                min="0"
                step="1000"
                className="w-1/2"
                disabled={isPaymentFormDisabled}
              />
              <Select
                value={effectivePaymentMethodId}
                onValueChange={setPaymentMethodId}
                disabled={isPaymentFormDisabled}
              >
                <SelectTrigger className="w-1/2">
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
                            <span>{method.method_name} ({method.type})</span>
                          </div>
                        </SelectItem>
                      ))}
                      <Separator className="my-1" />
                    </>
                  )}
                  <div className="px-2 py-1 text-xs text-gray-500">Transfer</div>
                  {paymentMethodsTransfer.map((method) => (
                    <SelectItem key={method.id} value={String(method.id)}>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>{method.method_name} ({method.type})</span>
                      </div>
                    </SelectItem>
                  ))}
                  {/* tampilkan metode lain jika ada selain cash/transfer */}
                  {normalizedMethods.filter(m => !['cash','transfer'].includes(m.type)).map((method) => (
                    <SelectItem key={method.id} value={String(method.id)}>
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
              {opLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambahkan Pembayaran'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {order.proof_public_url && (
        <Card>
          <CardHeader>
            <CardTitle>Bukti Pengiriman</CardTitle>
          </CardHeader>
          <CardContent>
            <a href={order.proof_public_url} target="_blank" rel="noreferrer" className="underline text-blue-600">
              Lihat bukti pengiriman
            </a>
          </CardContent>
        </Card>
      )}

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
