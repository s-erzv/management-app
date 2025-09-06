import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'react-hot-toast';
import { Loader2, ArrowLeft, PackageCheck, TruckIcon } from 'lucide-react';

const CompleteDeliveryPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transferMethod, setTransferMethod] = useState('');
  const [receivedByName, setReceivedByName] = useState('');
  const [cashAmount, setCashAmount] = useState('0');
  const [transferAmount, setTransferAmount] = useState('0');
  const [file, setFile] = useState(null);
  const [transferProofFile, setTransferProofFile] = useState(null);
  const [formState, setFormState] = useState({
    returnedQty: '0',
    borrowedQty: '0',
    purchasedEmptyQty: '0',
    transportCost: '0',
  });
  
  const [paymentMethods, setPaymentMethods] = useState([]);

  useEffect(() => {
    if (!orderId) {
      toast.error('ID pesanan tidak ditemukan.');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [orderId, session]);
  
  const fetchData = async () => {
    setLoading(true);
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, address, phone),
        order_items (product_id, qty, price, item_type, products(name, is_returnable, company_id))
      `)
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      toast.error('Gagal memuat detail pesanan.');
      navigate('/dashboard');
      return;
    }
    
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .eq('order_id', orderData.id);

    if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
    }
    
    const total_paid = paymentsData ? paymentsData.reduce((sum, p) => sum + p.amount, 0) : 0;
    const total = orderData.order_items.reduce((sum, item) => sum + (item.qty * item.price), 0);

    const orderWithDetails = {
      ...orderData,
      total,
      total_paid,
      remaining_due: total - total_paid,
    };
     const companyIdFromOrder = orderData.company_id ?? null;
     const companyIdFromProduct =
       orderData.order_items?.find(i => i?.products?.company_id)?.products?.company_id ?? null;
     const effectiveCompanyId = companyIdFromOrder ?? companyIdFromProduct;
    
     let pmQuery = supabase.from('payment_methods').select('*').eq('is_active', true);
     if (effectiveCompanyId) pmQuery = pmQuery.eq('company_id', effectiveCompanyId);
     const { data: methodsData, error: methodsError } = await pmQuery;

    if (methodsError) {
        console.error('Error fetching payment methods:', methodsError);
    } else {
        setPaymentMethods(methodsData || []);
        // Set default payment method to 'pending'
        setPaymentMethod('pending');
    }

    setOrder(orderWithDetails);
    setFormState({
      ...formState,
      transportCost: orderWithDetails.transport_cost?.toString() || '0',
    });
    setLoading(false);
  };
  
  useEffect(() => {
    if (!order) return;
    const remaining = order?.remaining_due || 0;
    const selectedMethod = paymentMethods.find(m => m.id === paymentMethod);

    if (paymentMethod === 'hybrid') {
      const remainingForTransfer = remaining - (parseFloat(cashAmount) || 0);
      setTransferAmount(remainingForTransfer > 0 ? remainingForTransfer.toString() : '0');
    } else if (selectedMethod?.type === 'cash') {
      setCashAmount(remaining.toString());
      setTransferAmount('0');
    } else if (selectedMethod?.type === 'transfer') {
      setTransferAmount(remaining.toString());
      setCashAmount('0');
    } else { // Handles pending or other cases
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

  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value);
    setTransferMethod('');
  }
  
const handleCompleteDelivery = async (e) => {
  e.preventDefault();
  if (!order?.id || !file) {
    toast.error('ID pesanan atau bukti pengiriman tidak ada.');
    return;
  }
   const selectedPaymentMethod = paymentMethods.find(m => m.id === paymentMethod);
   const isTransfer = paymentMethod === 'hybrid' || selectedPaymentMethod?.type === 'transfer';
  if (isTransfer && !transferProofFile) {
    toast.error('Mohon unggah bukti transfer.');
    return;
  }
  
  if (paymentMethod === 'hybrid' && !transferMethod) {
    toast.error('Mohon pilih metode transfer.');
    return;
  }
  
  if (paymentMethod !== 'pending' && !receivedByName) {
    toast.error('Nama penerima harus diisi.');
    return;
  }

  setSubmitting(true);
  let transferProofUrl = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Unggah bukti pengiriman (proof of delivery)
    const deliveryFileExt = file.name.split('.').pop();
    const deliveryFilePath = `${order.id}/delivery_proofs/${Date.now()}.${deliveryFileExt}`;
    const { error: deliveryUploadError } = await supabase.storage
      .from("proofs")
      .upload(deliveryFilePath, file, { upsert: false });
    
    if (deliveryUploadError) {
      console.error('Upload error details (delivery):', deliveryUploadError);
      throw new Error('Gagal mengunggah bukti pengiriman: ' + deliveryUploadError.message);
    }
    
    // 2. Unggah bukti transfer jika ada
    if (isTransfer && transferProofFile) {
      const transferFileExt = transferProofFile.name.split('.').pop();
      const transferFilePath = `${order.id}/transfer_proofs/${Date.now()}.${transferFileExt}`;
      const { data: transferUploadData, error: transferUploadError } = await supabase.storage
        .from("proofs")
        .upload(transferFilePath, transferProofFile, { upsert: false });

      if (transferUploadError) {
        console.error('Upload error details (transfer):', transferUploadError);
        throw new Error('Gagal mengunggah bukti transfer: ' + transferUploadError.message);
      }
      transferProofUrl = transferUploadData.path;
    }

    const finalPaymentAmount =
      (parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0);

      const pmToSend = paymentMethod === "hybrid"
          ? transferMethod
          : paymentMethod;
       const pmName = pmToSend === 'pending' || pmToSend === 'hybrid'
          ? pmToSend
          : (paymentMethods.find(m => m.id === pmToSend)?.method_name ?? pmToSend);
       
    const payload = {
      orderId,
      paymentAmount: finalPaymentAmount,
      paymentMethod: pmToSend,
     paymentMethodName: pmName, 
      returnedQty: parseInt(formState.returnedQty, 10) || 0,
      borrowedQty: parseInt(formState.borrowedQty, 10) || 0,
      purchasedEmptyQty: parseInt(formState.purchasedEmptyQty, 10) || 0,
      transportCost: parseFloat(formState.transportCost) || 0,
      proofFileUrl: deliveryFilePath,
      transferProofUrl,
      receivedByName,
    };

    const response = await fetch(
      "https://wzmgcainyratlwxttdau.supabase.co/functions/v1/complete-delivery",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Function error:', errorText);
      throw new Error(errorText);
    }

    toast.success("Pesanan berhasil diselesaikan!");
    navigate("/dashboard");
    
  } catch (error) {
    console.error("Error completing delivery:", error);
    toast.error("Gagal menyelesaikan pesanan: " + error.message);
  } finally {
    setSubmitting(false);
  }
};

  if (loading || !order) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-[#10182b]" />
        <p className="mt-4 text-muted-foreground">Memuat detail pesanan...</p>
      </div>
    );
  }
  
  // Combine all payment methods for the dropdown
  const combinedPaymentMethods = [
    { id: 'pending', method_name: 'Pending', type: 'pending' },
    { id: 'hybrid', method_name: 'Tunai & Transfer', type: 'hybrid' },
    ...paymentMethods
  ];

  const hasReturnableItems = order.order_items.some(item => item.products?.is_returnable);
  const deliveredQty = order.order_items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const showPaymentFields = order.payment_status !== 'paid' && order.remaining_due > 0;

  const selectedMethod = paymentMethods.find(m => m.id === paymentMethod);
  const transferMethods = paymentMethods.filter(m => m.type === 'transfer');

  const showCashFields = showPaymentFields && (selectedMethod?.type === 'cash' || paymentMethod === 'hybrid');
  const showTransferFields = showPaymentFields && (selectedMethod?.type === 'transfer' || paymentMethod === 'hybrid');
  
  const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-[#10182b] hover:bg-gray-100">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
            <TruckIcon className="h-8 w-8" />
            Selesaikan Pesanan
          </h1>
          <p className="text-muted-foreground">Lengkapi informasi dan bukti pengiriman untuk pesanan #{order.id.slice(0, 8)}.</p>
        </div>
      </div>

      <form onSubmit={handleCompleteDelivery} className="grid gap-6">
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-[#10182b]">Informasi Pesanan</CardTitle>
            <CardDescription>Rincian pelanggan dan barang yang dikirim.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Pelanggan</Label>
              <p className="font-medium text-[#10182b]">{order.customers?.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Alamat</Label>
              <p className="text-[#10182b]">{order.customers?.address}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Sisa Tagihan</Label>
              <p className="font-bold text-red-600 text-lg">{formatCurrency(order.remaining_due)}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="font-medium text-[#10182b]">Detail Barang</Label>
              {order.order_items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{item.products?.name} ({item.item_type})</span>
                  <span className="text-[#10182b]">{item.qty} x {formatCurrency(item.price)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-[#10182b]">Rincian Penyelesaian</CardTitle>
            <CardDescription>Masukkan detail pembayaran, pengembalian, dan biaya.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {showPaymentFields && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
                  <Select value={paymentMethod} onValueChange={handlePaymentMethodChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih metode pembayaran" />
                    </SelectTrigger>
                    <SelectContent>
                       {combinedPaymentMethods.map(method => (
                         <SelectItem key={method.id} value={method.id}>
                           {method.method_name}
                         </SelectItem>
                       ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {paymentMethod === 'hybrid' && (
                  <div className="grid gap-2">
                    <Label htmlFor="transferMethod">Pilih Metode Transfer</Label>
                    <Select value={transferMethod} onValueChange={setTransferMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih rekening tujuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {transferMethods.length > 0 ? (
                          transferMethods.map(method => (
                            <SelectItem key={method.id} value={method.id}>
                              {method.method_name} ({method.account_name})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem disabled>Tidak ada metode transfer</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {showCashFields && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="receivedByName">Nama Penerima</Label>
                      <Input
                        id="receivedByName"
                        placeholder="Masukkan nama penerima"
                        value={receivedByName}
                        onChange={(e) => setReceivedByName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cashAmount">Jumlah Pembayaran Tunai</Label>
                      <Input
                        id="cashAmount"
                        type="number"
                        placeholder="Jumlah Pembayaran Tunai"
                        value={cashAmount}
                        onChange={(e) => handleAmountChange(e, setCashAmount)}
                        required
                      />
                    </div>
                  </>
                )}
                
                {showTransferFields && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="transferAmount">Jumlah Pembayaran Transfer</Label>
                      <Input
                        id="transferAmount"
                        type="number"
                        placeholder="Jumlah Pembayaran Transfer"
                        value={transferAmount}
                        onChange={(e) => handleAmountChange(e, setTransferAmount)}
                        readOnly={paymentMethod === 'hybrid'}
                        className={paymentMethod === 'hybrid' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="transferProof">Unggah Bukti Transfer</Label>
                      <Input
                        id="transferProof"
                        type="file"
                        onChange={(e) => setTransferProofFile(e.target.files[0])}
                        accept="image/*"
                        required
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {hasReturnableItems && (
              <>
                <p className="text-sm text-muted-foreground">Pesanan ini dikirim {deliveredQty} galon yang dapat dikembalikan.</p>
                <div className="grid gap-2">
                  <Label htmlFor="returnedQty">Jumlah Galon Kembali</Label>
                  <Input
                    id="returnedQty"
                    type="number"
                    placeholder="Jumlah Galon Kembali"
                    value={formState.returnedQty}
                    onChange={handleFormChange}
                    min="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="borrowedQty">Jumlah Galon Dipinjam</Label>
                  <Input
                    id="borrowedQty"
                    type="number"
                    placeholder="Jumlah Galon Dipinjam"
                    value={formState.borrowedQty}
                    onChange={handleFormChange}
                    min="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="purchasedEmptyQty">Jumlah Galon Kosong Dibeli</Label>
                  <Input
                    id="purchasedEmptyQty"
                    type="number"
                    placeholder="Jumlah Galon Kosong Dibeli"
                    value={formState.purchasedEmptyQty}
                    onChange={handleFormChange}
                    min="0"
                  />
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="transportCost">Biaya Transportasi</Label>
              <Input
                id="transportCost"
                type="number"
                placeholder="Biaya Transportasi"
                value={formState.transportCost}
                onChange={handleFormChange}
                min="0"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="proofFile">Unggah Bukti Pengiriman</Label>
              <Input
                id="proofFile"
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                accept="image/*"
                required
              />
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-4">
          <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#20283b]" disabled={submitting || (showTransferFields && !transferProofFile)}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <PackageCheck className="h-4 w-4 mr-2" />
            )}
            Selesaikan Pesanan
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CompleteDeliveryPage;