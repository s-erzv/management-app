import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, ArrowLeft, PackageCheck, TruckIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


const CompleteDeliveryPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { session, user, companyId } = useAuth();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transferMethod, setTransferMethod] = useState('');
  const [receivedByName, setReceivedByName] = useState('');
  const [cashAmount, setCashAmount] = useState('0');
  const [transferAmount, setTransferAmount] = useState('0');
  const [file, setFile] = useState(null);
  const [transferProofFile, setTransferProofFile] = useState(null);
  const [itemQuantities, setItemQuantities] = useState({});
  const [transportCost, setTransportCost] = useState(' ');
  
  const handleInputWheel = (e) => {
    e.target.blur();
  };
  
  const returnableItemsInOrder = useMemo(() => 
    order?.order_items.filter(item => item.products?.is_returnable) || [], [order]
  );

  useEffect(() => {
    if (!order || !returnableItemsInOrder.length) return;
    const initialQuantities = {};
    returnableItemsInOrder.forEach(item => {
      initialQuantities[item.product_id] = {
        returnedQty: order.returned_qty || '', 
        purchasedEmptyQty: order.purchased_empty_qty || '',
        borrowedQty: order.borrowed_qty || '',
      };
    });
    setItemQuantities(initialQuantities);
    setTransportCost(order.transport_cost?.toString() || '0');
  }, [order, returnableItemsInOrder]);
  
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [orderCouriers, setOrderCouriers] = useState([]);

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
        order_items (product_id, qty, price, item_type, products(name, is_returnable, empty_bottle_price)),
        order_couriers (courier:profiles(id, full_name))
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
    
    let pmQuery = supabase.from('payment_methods').select('*').eq('is_active', true);
    if (companyId) pmQuery = pmQuery.eq('company_id', companyId);
    
    const { data: methodsData, error: methodsError } = await pmQuery;

    if (methodsError) {
        console.error('Error fetching payment methods:', methodsError);
    } else {
        setPaymentMethods(methodsData || []);
        setPaymentMethod('pending');
    }

    setOrder(orderWithDetails);
    setOrderCouriers(orderData.order_couriers.map(oc => oc.courier));
    setLoading(false);
  };
  
  const handleAmountChange = (e, setter) => {
    setter(e.target.value);
  };

  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value);
    setTransferMethod('');
  }
  
  const orderItemsTotal = order?.order_items.reduce((sum, item) => sum + (item.qty * item.price), 0) || 0;
  const transportCostVal = parseFloat(transportCost) || 0;
  
  const totalPurchaseCost = returnableItemsInOrder.reduce((sum, item) => {
      const qty = parseInt(itemQuantities[item.product_id]?.purchasedEmptyQty) || 0;
      return sum + (qty * (item.products?.empty_bottle_price || 0));
  }, 0);

  const newGrandTotal = orderItemsTotal + transportCostVal + totalPurchaseCost;
  
  const remainingDue = newGrandTotal - (order?.total_paid || 0);

  useEffect(() => {
    if (!order) return;
    const selectedMethod = paymentMethods.find(m => m.id === paymentMethod);

    if (paymentMethod === 'hybrid') {
      const remainingForTransfer = remainingDue - (parseFloat(cashAmount) || 0);
      setTransferAmount(remainingForTransfer > 0 ? remainingForTransfer.toString() : '0');
    } else if (selectedMethod?.type === 'cash') {
      setCashAmount(remainingDue.toString());
      setTransferAmount('0');
    } else if (selectedMethod?.type === 'transfer') {
      setTransferAmount(remainingDue.toString());
      setCashAmount('0');
    } else {
      setCashAmount('0');
      setTransferAmount('0');
    }
  }, [paymentMethod, remainingDue, cashAmount, paymentMethods]);

  const handleCompleteDelivery = async (e) => {
    e.preventDefault();
    if (!order?.id || !file) {
      toast.error('ID pesanan atau bukti pengiriman tidak ada.');
      return;
    }
    const selectedMethodObj = paymentMethods.find(m => m.id === paymentMethod);

    if (paymentStatus !== 'unpaid') {
      const isTransfer = selectedMethodObj?.type === 'transfer' || paymentMethod === 'hybrid';
      const isCashPayment = selectedMethodObj?.type === 'cash' || paymentMethod === 'hybrid';

      if (isTransfer && !transferProofFile) {
        toast.error('Mohon unggah bukti transfer.');
        return;
      }
      
      if (paymentMethod === 'hybrid' && !transferMethod) {
        toast.error('Mohon pilih metode transfer.');
        return;
      }
      
      if (isCashPayment && !receivedByName) {
        toast.error('Nama penerima harus diisi.');
        return;
      }
    }

    setSubmitting(true);
    let transferProofUrl = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const deliveryFileExt = file.name.split('.').pop();
      const deliveryFilePath = `${order.id}/delivery_proofs/${Date.now()}.${deliveryFileExt}`;
      const { error: deliveryUploadError } = await supabase.storage
        .from("proofs")
        .upload(deliveryFilePath, file, { upsert: false });
      
      if (deliveryUploadError) {
        console.error('Upload error details (delivery):', deliveryUploadError);
        throw new Error('Gagal mengunggah bukti pengiriman: ' + deliveryUploadError.message);
      }
      
      const selectedMethodObj = paymentMethods.find(m => m.id === paymentMethod);
      const isTransfer = selectedMethodObj?.type === 'transfer' || paymentMethod === 'hybrid';

      if (paymentStatus !== 'unpaid' && isTransfer && transferProofFile) {
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
      
      let finalPaymentAmount = 0;
      if (paymentStatus !== 'unpaid') {
        finalPaymentAmount = (parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0);
      }
      
      let pmToSend = null;
      if (paymentStatus !== "unpaid") {
          pmToSend = paymentMethod === "hybrid" ? transferMethod : paymentMethod;
      } else if (paymentMethod && paymentMethod !== "pending") {
          pmToSend = paymentMethod;
      }

      // Perbaikan: Menambahkan logika untuk menghitung borrowedQty sebelum mengirim payload
      const payload = {
        orderId,
        paymentAmount: finalPaymentAmount,
        paymentMethodId: pmToSend,
        returnableItems: returnableItemsInOrder.map(item => {
            const returnedQty = parseInt(itemQuantities[item.product_id]?.returnedQty, 10) || 0;
            const purchasedEmptyQty = parseInt(itemQuantities[item.product_id]?.purchasedEmptyQty, 10) || 0;
            const orderedQty = item.qty || 0;
            const calculatedBorrowedQty = Math.max(0, orderedQty - returnedQty - purchasedEmptyQty);
            
            return {
                product_id: item.product_id,
                returnedQty,
                borrowedQty: calculatedBorrowedQty,
                purchasedEmptyQty,
                empty_bottle_price: item.products.empty_bottle_price,
            };
        }),
        transportCost: parseFloat(transportCost) || 0,
        proofFileUrl: deliveryFilePath,
        transferProofUrl,
        receivedByUserId: user?.id || null,
        receivedByName: receivedByName || null,
        paymentStatus: paymentStatus,
      };

      const response = await fetch(
        "https://wzmgcainyratlwxttdau.supabase.co/functions/v1/complete-delivery",
        {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
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
  
  const combinedPaymentMethods = [
    ...paymentMethods,
    { id: 'hybrid', method_name: 'Tunai & Transfer', type: 'hybrid' }
  ];
  
  const selectedMethodObj = paymentMethods.find(m => m.id === paymentMethod);
  const selectedMethodType = selectedMethodObj?.type;
  const transferMethods = paymentMethods.filter(m => m.type === 'transfer');

  const showPaymentDetailsFields = paymentStatus === 'paid' || paymentStatus === 'partial';
  const showCashFields = showPaymentDetailsFields && (selectedMethodType === 'cash' || paymentMethod === 'hybrid');
  const showTransferFields = showPaymentDetailsFields && (selectedMethodType === 'transfer' || paymentMethod === 'hybrid');
  
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
              <Label className="text-muted-foreground">Total Tagihan Baru</Label>
              <p className="font-bold text-lg text-green-600">{formatCurrency(newGrandTotal)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Sisa Tagihan</Label>
              <p className="font-bold text-red-600 text-lg">{formatCurrency(remainingDue)}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="font-medium text-[#10182b]">Detail Barang</Label>
              {order.order_items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{item.products?.name}</span>
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

            <div className="grid gap-2">
              <Label htmlFor="transportCost">Biaya Transportasi</Label>
              <Input
                id="transportCost"
                type="number"
                placeholder="Biaya Transportasi"
                alue={transportCost === '0' ? '' : transportCost}
                onChange={(e) => setTransportCost(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="paymentStatus">Status Pembayaran</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Status Pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Lunas</SelectItem>
                  <SelectItem value="partial">Sebagian</SelectItem>
                  <SelectItem value="unpaid">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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
                      {method.type === 'transfer' && method.account_name && ` (${method.account_name})`}
                    </SelectItem>
                   ))}
                </SelectContent>
              </Select>
            </div>

            {showPaymentDetailsFields && (
              <>
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
                       <Select value={receivedByName} onValueChange={setReceivedByName}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Petugas penerima" />
                        </SelectTrigger>
                        <SelectContent>
                          {orderCouriers.map(courier => (
                            <SelectItem key={courier.id} value={courier.full_name}>
                              {courier.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cashAmount">Jumlah Pembayaran Tunai</Label>
                      <Input
                        id="cashAmount"
                        type="number"
                        placeholder="Jumlah Pembayaran Tunai"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        required
                        onWheel={handleInputWheel}
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
                        onChange={(e) => setTransferAmount(e.target.value)}
                        readOnly={paymentMethod === 'hybrid'}
                        className={paymentMethod === 'hybrid' ? "bg-gray-100 cursor-not-allowed" : ""}
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

            {returnableItemsInOrder.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Product Returnable</h3>
                  {returnableItemsInOrder.map(item => (
                    <div key={item.product_id} className="space-y-2 border-l-4 pl-4">
                      <h4 className="font-semibold text-[#10182b]">{item.products.name}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`returnedQty-${item.product_id}`}>Product Returnable Kembali</Label>
                          <Input
                            id={`returnedQty-${item.product_id}`}
                            type="number"
                            placeholder="0"
                            value={itemQuantities[item.product_id]?.returnedQty || ''}
                            onChange={(e) => setItemQuantities(prev => ({
                              ...prev,
                              [item.product_id]: { ...prev[item.product_id], returnedQty: e.target.value }
                            }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`purchasedEmptyQty-${item.product_id}`}>Beli Kemasan Returnable</Label>
                          <Input
                            id={`purchasedEmptyQty-${item.product_id}`}
                            type="number"
                            placeholder="0"
                            value={itemQuantities[item.product_id]?.purchasedEmptyQty || ''}
                            onChange={(e) => setItemQuantities(prev => ({
                              ...prev,
                              [item.product_id]: { ...prev[item.product_id], purchasedEmptyQty: e.target.value }
                            }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`borrowedQty-${item.product_id}`}>Product Returnable Dipinjam</Label>
                        <Input
                          id={`borrowedQty-${item.product_id}`}
                          type="number"
                          placeholder="0"
                          value={
                            Math.max(0, (item.qty || 0) - (parseInt(itemQuantities[item.product_id]?.returnedQty) || 0) - (parseInt(itemQuantities[item.product_id]?.purchasedEmptyQty) || 0))
                          }
                          readOnly
                          className="bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
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
          <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#20283b]" disabled={submitting || ((paymentMethod === 'transfer' || paymentMethod === 'hybrid') && (paymentStatus === 'paid' || paymentStatus === 'partial') && !transferProofFile)}>
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