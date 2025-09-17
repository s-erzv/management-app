// src/pages/OrderDetailsPage.jsx

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, Trash2, CreditCard, Banknote, RefreshCcw, CheckCircle2, AlertCircle, ListOrdered, ReceiptText, Clock, TruckIcon, MessageSquareText, Pencil, X } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import AddPaymentModal from '@/components/AddPaymentModal';

// Badge status pengiriman
const getDeliveryStatusBadge = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'draft':
      return <Badge className="bg-gray-200 text-[#10182b] gap-1"><Clock className="h-3 w-3" /> Menunggu</Badge>;
    case 'sent':
      return <Badge className="bg-[#10182b] text-white gap-1"><TruckIcon className="h-3 w-3" /> Dikirim</Badge>;
    case 'delivered':
    case 'completed':
      return <Badge className="bg-green-500 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Selesai</Badge>;
    default:
      return <Badge className="bg-gray-200 text-[#10182b] capitalize">{status || 'unknown'}</Badge>;
  }
};

// Badge status pembayaran (dipakai kalau mau tampilkan raw)
const getPaymentStatusBadge = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'paid':
      return <Badge className="bg-green-500 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Lunas</Badge>;
    case 'unpaid':
      return <Badge className="bg-red-500 text-white gap-1"><AlertCircle className="h-3 w-3" /> Pending</Badge>;
    case 'partial':
      return <Badge className="bg-yellow-400 text-black gap-1"><AlertCircle className="h-3 w-3" /> Sebagian</Badge>;
    default:
      return <Badge className="bg-gray-200 text-[#10182b] capitalize">{status || 'unknown'}</Badge>;
  }
};

const OrderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, session, companyName } = useAuth();

  const userId = user?.id ?? null;

  // --- states ---
  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opLoading, setOpLoading] = useState(false);
  const [error, setError] = useState(null);

  // States untuk tambah pembayaran
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');

  // States untuk edit pembayaran
  const [isEditing, setIsEditing] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMethodId, setEditMethodId] = useState('');
  
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);

  // Refs untuk cleanup dan prevent race conditions
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  
  const calculatePaymentsTotal = useCallback((rows) => {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, []);
  
  const calculateTotal = (items) => {
    return items?.reduce((total, item) => total + (item.qty * item.price), 0) || 0;
  };
  
  const totalPaid = useMemo(() => calculatePaymentsTotal(payments), [payments, calculatePaymentsTotal]);
  
  const calculatedGrandTotal = useMemo(() => {
    if (!order) return 0;
    const itemsTotal = calculateTotal(order.order_items);
    const purchasedEmptyPrice = order.order_items.find(item => item.products?.is_returnable)?.products?.empty_bottle_price || 0;
    const totalPurchaseCost = (order.purchased_empty_qty || 0) * purchasedEmptyPrice;
    return itemsTotal + (order.transport_cost || 0) + totalPurchaseCost;
  }, [order]);

  const remainingDue = Math.max(0, calculatedGrandTotal - totalPaid);
  const isPaid = remainingDue <= 0.0001;

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
  

  const handleConfirmOrder = () => {
    if (!order || !order.order_items || !order.customers) {
      toast.error('Data pesanan belum lengkap. Coba refresh halaman.');
      return;
    }

    const productsList = order.order_items
      .map(item => `* ${item.products.name} (${item.qty})`)
      .join('\n');
    
    const totalHarga = formatCurrency(calculateTotal(order.order_items));

    const whatsappMessage = `Assalamualaikum warahmatullahi wabarakatuh.Yth. Bapak/Ibu ${order.customers.name},

Dengan hormat, kami izin Mengonfirmasi Pesanan dengan rincian berikut:
${productsList}

Total Harga: ${totalHarga}
*Belum termasuk biaya transportasi jika ada*

Mohon diperika kembali untuk pesanannya
Pembayaran dilakukan ketika barang sudah diterima. Terimakasih

Hormat kami,
${companyName}`;

    const phone = (order.customers?.phone || '').replace(/[^\d]/g, '');
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  // --- helpers ---
  const isAbortErr = (e) => !!e && (
    e.name === 'AbortError' ||
    e.code === '20' ||
    /AbortError/i.test(e.message || '')
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount ?? 0);
  };
  
  const fetchData = useCallback(async (showLoading = true) => {
    if (!id || !isAuthenticated) {
      if (mountedRef.current) setLoading(false);
      return;
    }

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
          order_items (id, qty, price, item_type, products(name, is_returnable, empty_bottle_price))
        `)
        .eq('id', id)
        .abortSignal(abortControllerRef.current.signal)
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('Pesanan tidak ditemukan.');

      let proofPublicUrl;
      if (orderData.proof_of_delivery_url) {
        const { data: p } = supabase.storage
          .from('proofs')
          .getPublicUrl(orderData.proof_of_delivery_url);
        proofPublicUrl = p?.publicUrl;
      }

     const [paymentsRes, methodsRes] = await Promise.all([
        supabase
          .from('payments')
          .select(`*, received_by_name, received_by:profiles(full_name), payment_method:payment_methods(method_name, type, account_name, account_number)`)
          .eq('order_id', orderData.id)
          .order('created_at', { ascending: false })
          .abortSignal(abortControllerRef.current.signal),
        supabase
          .from('payment_methods')
          .select('*')
          .eq('company_id', orderData.company_id)
          .abortSignal(abortControllerRef.current.signal),
      ]);

      if (paymentsRes.error && !isAbortErr(paymentsRes.error)) {
        console.warn('Payments fetch error:', paymentsRes.error);
        toast.error('Gagal memuat riwayat pembayaran.');
      }
      if (methodsRes.error && !isAbortErr(methodsRes.error)) {
        console.warn('Payment methods fetch error:', methodsRes.error);
        toast.error('Gagal memuat metode pembayaran.');
      }

      let paymentsWithUrls = paymentsRes.data || [];
      if (paymentsWithUrls.length > 0) {
        paymentsWithUrls = await Promise.all(
          paymentsWithUrls.map(async (p) => {
            if (!p.proof_url) return p;
            const { data: pub } = await supabase.storage
              .from('proofs')
              .getPublicUrl(p.proof_url);
            return { ...p, proof_public_url: pub?.publicUrl };
          })
        );
      }

      const nextOrder = {
        ...orderData,
        proof_public_url: proofPublicUrl || null,
      };

      if (paymentsWithUrls.length > 0 && mountedRef.current) {
        const firstPaymentMethodId = paymentsWithUrls[0].payment_method_id;
        setPaymentMethodId(String(firstPaymentMethodId));
      } else {
        setPaymentMethodId('');
      }

      if (mountedRef.current) {
        setOrder(nextOrder);
        setPayments(paymentsWithUrls);
        setPaymentMethods(methodsRes.data || []);
      }
    } catch (err) {
      if (isAbortErr(err)) {
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

  useEffect(() => {
    let timeoutId;
    if (id && isAuthenticated) {
      timeoutId = setTimeout(() => {
        fetchData(true);
      }, 150);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id, isAuthenticated, fetchData]);

  const derivedPaymentStatus = useMemo(() => {
    if (totalPaid <= 0) return 'unpaid';
    if (totalPaid >= calculatedGrandTotal - 0.0001) return 'paid';
    return 'partial';
  }, [calculatedGrandTotal, totalPaid]);

  const paymentStatusMap = {
    paid: { variant: 'default', label: 'Lunas', icon: <CheckCircle2 className="h-3 w-3" /> },
    unpaid: { variant: 'destructive', label: 'Pending', icon: <AlertCircle className="h-3 w-3" /> },
    partial: { variant: 'secondary', label: 'Sebagian', icon: <AlertCircle className="h-3 w-3" /> },
  };
  const currentPaymentStatus = paymentStatusMap[derivedPaymentStatus];

  const normalizedMethods = useMemo(
    () => (paymentMethods || []).map(m => ({
      id: m.id,
      method_name: m.method_name,
      type: m.type,
      account_name: m.account_name || null,
      account_number: m.account_number || null,
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

  const effectivePaymentMethodId = paymentMethodId || (normalizedMethods[0]?.id ?? '');
  const selectedMethod = useMemo(
    () => normalizedMethods.find(m => String(m.id) === String(effectivePaymentMethodId)),
    [normalizedMethods, effectivePaymentMethodId]
  );

  const paymentFormIsValid = paymentAmount && parseFloat(paymentAmount) > 0 && effectivePaymentMethodId;
  const isPaymentFormDisabled = isPaid || remainingDue <= 0;

  useEffect(() => {
    if (!isPaid) {
      setPaymentAmount(remainingDue.toString());
    } else {
      setPaymentAmount('0');
    }
  }, [remainingDue, isPaid]);

  const handleDataUpdate = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  const statusFromTotals = useCallback((paid, grand) => {
    if (paid <= 0) return 'unpaid';
    if (paid >= grand - 0.0001) return 'paid';
    return 'partial';
  }, []);

  const recomputeAndUpdateOrderStatus = useCallback(async (orderId, grandTotalFallback) => {
    const { data: rows, error: selErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('order_id', orderId);

    if (selErr) throw selErr;

    const sum = (rows ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const gt = Number(order?.grand_total ?? grandTotalFallback ?? 0) || 0;
    const newStatus = statusFromTotals(sum, gt);

    const { error: updErr } = await supabase
      .from('orders')
      .update({ payment_status: newStatus })
      .eq('id', orderId);

    if (updErr) throw updErr;
  }, [order?.grand_total, statusFromTotals]);

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!paymentFormIsValid) {
      toast.error('Form pembayaran belum valid.');
      return;
    }
    if (!order) return;

    // Logika validasi baru: cek apakah pembayaran melebihi sisa tagihan
    const amountNum = parseFloat(paymentAmount);
    if (amountNum > remainingDue) {
      toast.error(`Jumlah pembayaran tidak bisa melebihi sisa tagihan: ${formatCurrency(remainingDue)}`);
      return;
    }

    setOpLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          amount: amountNum,
          payment_method_id: effectivePaymentMethodId,
          paid_at: new Date().toISOString(),
          company_id: order.company_id,
          received_by: selectedMethod?.type === 'cash' ? userId : null,
        });

      if (insertError) throw insertError;

      const newTotalPaid = totalPaid + amountNum;
      const gt = Number(order?.grand_total) || 0;
      const newStatus = statusFromTotals(newTotalPaid, gt);

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

      await recomputeAndUpdateOrderStatus(order.id, calculatedGrandTotal);

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

  const handleOpenEditDialog = (payment) => {
    setEditingPayment(payment);
    setEditAmount(payment.amount.toString());
    setEditMethodId(payment.payment_method_id.toString());
    setIsEditing(true);
  };
  
  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    if (!editingPayment || !editAmount || !editMethodId) {
      toast.error('Form edit pembayaran belum lengkap.');
      return;
    }

    const newAmount = parseFloat(editAmount);
    const oldAmount = parseFloat(editingPayment.amount);
    const amountDifference = newAmount - oldAmount;
    const newRemainingDue = remainingDue - amountDifference;

    if (newRemainingDue < 0) {
      toast.error('Jumlah pembayaran tidak bisa melebihi sisa tagihan.');
      return;
    }

    setOpLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          amount: newAmount,
          payment_method_id: editMethodId,
        })
        .eq('id', editingPayment.id);

      if (updateError) throw updateError;
      
      await recomputeAndUpdateOrderStatus(order.id, calculatedGrandTotal);

      toast.success('Pembayaran berhasil diperbarui.');
      setIsEditing(false);
      setEditingPayment(null);
      handleDataUpdate();
    } catch (err) {
      console.error('update-payment error', err);
      toast.error(err.message || 'Gagal memperbarui pembayaran.');
    } finally {
      setOpLoading(false);
    }
  };
  
  const handleSendInvoice = async () => {
    if (!order) return;
    setIsSendingInvoice(true);
    toast.loading('Membuat invoice PDF...', { id: 'invoice-toast' });

    // Buat daftar produk yang diformat
    const productsList = order.order_items
      .map(item => `* ${item.products.name} (${item.qty} pcs)`)
      .join('\n');
      
    try {
      const payload = {
        order_id: order.id,
        orderData: {
          ...order,
          payments: payments,
          grand_total: calculatedGrandTotal,
          remaining_due: remainingDue,
        }
      };

      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-invoice-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Gagal membuat invoice PDF.');
      }
      const { pdfUrl } = await response.json();

    let whatsappMessage;
      
    // REVISED LOGIC FOR PAYMENT METHOD NAME FOR WHATSAPP
    const paymentMethodData = payments.length > 0 ? payments[0].payment_method : null;
    let paymentMethodDisplay = 'N/A';
    
    if (paymentMethodData) {
        if (paymentMethodData.type === 'transfer') {
            const accDetails = [paymentMethodData.account_name, paymentMethodData.account_number].filter(Boolean).join(' / ');
            paymentMethodDisplay = `${paymentMethodData.method_name}${accDetails ? ` (${accDetails})` : ''}`;
        } else {
            paymentMethodDisplay = paymentMethodData.method_name;
        }
    }
        
      if (derivedPaymentStatus === 'paid') {
        whatsappMessage = `Assalamualaikum warahmatullahi wabarakatuh.
Yth. Bapak/Ibu ${order.customers.name},

Berikut adalah invoice untuk pesanan Anda:
Invoice No. ${order.invoice_number} senilai ${formatCurrency(calculatedGrandTotal)}.
Rincian Produk:
${productsList}
Kami telah menerima pembayaran sebesar ${formatCurrency(totalPaid)} melalui ${paymentMethodDisplay}.
Tautan invoice: ${pdfUrl}.

Jazaakumullaahu khairan atas perhatian dan kerja samanya.
Wassalamualaikum warahmatullahi wabarakatuh.

Hormat kami,
${companyName}`;
      } else {
        whatsappMessage = `Assalamualaikum warahmatullahi wabarakatuh.
Yth. Bapak/Ibu ${order.customers.name},

Dengan hormat, kami sampaikan tagihan untuk pesanan Anda dengan rincian berikut:

Invoice No. ${order.invoice_number} 
senilai ${formatCurrency(calculatedGrandTotal)}.

Rincian Produk:
${productsList}

invoice dapat diunduh pada link berikut: 
s${pdfUrl}.

Mohon segera selesaikan pembayaran melalui ${paymentMethodDisplay}. 
Terima kasih.

Jazaakumullaahu khairan wa baarakallahu fiikum.
Wassalamualaikum warahmatullahi wabarakatuh.

Hormat kami,
${companyName}`;
      }

      const phone = (order.customers?.phone || '').replace(/[^\d]/g, '');
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`;
      window.open(whatsappUrl, '_blank');
      toast.success('Invoice berhasil dikirim!', { id: 'invoice-toast' });
    } catch (err) {
      console.error('send-invoice error', err);
      toast.error(err.message, { id: 'invoice-toast' });
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const handleOpenPaymentModal = (order) => {
    setSelectedOrderForPayment(order);
    setIsPaymentModalOpen(true);
  };

  // --- render guards ---
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#10182b]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 text-[#10182b] hover:bg-gray-100">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#10182b]">Terjadi kesalahan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error.message}</p>
            <Button variant="outline" onClick={() => fetchData(true)} className="mt-4 text-[#10182b] hover:bg-gray-100">
              <RefreshCcw className="mr-2 h-4 w-4" /> Coba lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 text-[#10182b] hover:bg-gray-100">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#10182b]">Pesanan tidak ditemukan</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Data pesanan tidak tersedia.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Siapkan semua item yang akan ditampilkan, termasuk biaya tambahan
  const items = order.order_items || [];
  const allItems = [...items];

  if (order.transport_cost > 0) {
    allItems.push({
      id: 'transport-cost',
      products: { name: 'Biaya Transportasi' },
      qty: 1,
      price: order.transport_cost,
      item_type: 'biaya'
    });
  }

  const purchasedEmptyPrice = order.order_items.find(item => item.products?.is_returnable)?.products?.empty_bottle_price || 0;
  if (order.purchased_empty_qty > 0) {
      allItems.push({
          id: 'purchased-empty',
          products: { name: 'Beli Kemasan Returnable' },
          qty: order.purchased_empty_qty,
          price: purchasedEmptyPrice,
          item_type: 'pembelian'
      });
  }
  
  // Perubahan: Menambahkan item Product Returnable yang dipinjam dan dikembalikan
  if (order.returned_qty > 0) {
    allItems.push({
      id: 'returned-gallon',
      products: { name: 'Product Returnable Kembali' },
      qty: order.returned_qty,
      price: 0, // Tidak ada harga
      item_type: 'pengembalian'
    });
  }
  if (order.borrowed_qty > 0) {
    allItems.push({
      id: 'borrowed-gallon',
      products: { name: 'Product Returnable Dipinjam' },
      qty: order.borrowed_qty,
      price: 0, // Tidak ada harga
      item_type: 'pinjam'
    });
  }


  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
          <ListOrdered className="h-8 w-8" />
          Detail Pesanan
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => fetchData(true)} className="text-[#10182b] hover:bg-gray-100">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" onClick={handleSendInvoice} disabled={isSendingInvoice} className="text-[#10182b] hover:bg-gray-100">
            {isSendingInvoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
            Kirim Invoice
          </Button>
           <Button
            variant="outline"
            onClick={handleConfirmOrder}
            className="text-[#10182b] hover:bg-gray-100"
          >
            <MessageSquareText className="mr-2 h-4 w-4" /> Konfirmasi
           </Button>
        </div>
      </div>

      <Card className="border border-gray-200 shadow-sm transition-all hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#10182b]">
            Pesanan #{order.invoice_number || order.id.slice(0, 8)}
          </CardTitle>
          <CardDescription>Rincian lengkap pesanan dan statusnya.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Pelanggan</p>
            <p className="font-semibold text-base text-[#10182b]">{order.customers?.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Status Pengiriman</p>
            {getDeliveryStatusBadge(order.status)}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Status Pembayaran</p>
            <Badge variant={currentPaymentStatus.variant} className="flex items-center gap-1 font-semibold bg-[#10182b] text-white">
              {currentPaymentStatus.icon} {currentPaymentStatus.label}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Total</p>
            <p className="font-bold text-lg text-[#10182b]">{formatCurrency(calculatedGrandTotal)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-gray-200 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-[#10182b]">Item Pesanan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {allItems.length === 0 && <p className="text-sm text-gray-500">Tidak ada item.</p>}
              {allItems.map((it, index) => (
                <div key={it.id || index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <div className="space-y-0.5">
                    <p className="font-medium text-[#10182b]">{it.products?.name || 'Produk'}</p>
                    <p className="text-xs text-gray-500">
                      {it.item_type !== 'biaya' && it.item_type !== 'pembelian' && `${Number(it.qty)} × `}
                      {formatCurrency(Number(it.price))} {it.item_type ? `• ${it.item_type}` : ''}
                    </p>
                  </div>
                  <div className="font-semibold mt-2 sm:mt-0 text-[#10182b]">
                    {formatCurrency(Number(it.qty) * Number(it.price))}
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Total Dibayar</p>
                <p className="font-semibold text-base text-[#10182b]">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Sisa Tagihan</p>
                <p className="font-bold text-base text-red-500">{formatCurrency(remainingDue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-[#10182b]">Riwayat Pembayaran</CardTitle>
            <CardDescription>Pembayaran yang sudah dicatat untuk pesanan ini.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.length === 0 && <p className="text-sm text-gray-500">Belum ada pembayaran.</p>}
            {payments.map((p) => {
              const paymentDetails = [p.payment_method?.method_name];
              if (p.payment_method?.account_name) {
                paymentDetails.push(p.payment_method.account_name);
              }
              if (p.payment_method?.account_number) {
                paymentDetails.push(p.payment_method.account_number);
              }
              
              const displayString = paymentDetails.filter(Boolean).join(' / ');

              return (
                <div key={p.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  <div className="space-y-0.5">
                    <p className="font-medium text-[#10182b]">{formatCurrency(Number(p.amount))}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(p.paid_at || p.created_at).toLocaleString('id-ID')} • {displayString}
                    </p>
                    {(p.received_by_name) && (
                      <p className="text-xs text-gray-500">Diterima oleh: {p.received_by_name}</p>
                    )}
                    {p.proof_public_url && (
                      <a href={p.proof_public_url} target="_blank" rel="noreferrer">
                         <img src={p.proof_public_url} alt="Bukti Transfer" className="mt-2 w-24 h-auto rounded-md border" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEditDialog(p)}
                      disabled={opLoading}
                      title="Edit pembayaran"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeletePayment(p.id)}
                      disabled={opLoading}
                      title="Hapus pembayaran"
                      className="bg-red-500 hover:bg-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {order.proof_public_url && (
          <Card className="border border-gray-200 shadow-sm transition-all hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-[#10182b]">Bukti Pengiriman</CardTitle>
              <CardDescription>File bukti pengiriman yang diunggah.</CardDescription>
            </CardHeader>
            <CardContent>
              <a href={order.proof_public_url} target="_blank" rel="noreferrer">
                <img src={order.proof_public_url} alt="Bukti Pengiriman" className="w-48 h-auto rounded-md border" />
              </a>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
};

export default OrderDetailsPage;