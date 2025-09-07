import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2, FileIcon, DollarSign, Wallet } from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

const CentralOrderFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile, loading: authLoading, companyId } = useAuth();
  
  const [products, setProducts] = useState([]);
  const [purchasePrices, setPurchasePrices] = useState({}); // Mengubah nama state agar lebih spesifik
  const [loading, setLoading] = useState(true);
  const [isNewOrder, setIsNewOrder] = useState(true);
  
  // Tab 1 State
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderItems, setOrderItems] = useState([{ product_id: '', qty: 1, price: 0 }]);
  const [activeTab, setActiveTab] = useState('order-items');

  // Tab 2 State
  const [transactionDetails, setTransactionDetails] = useState({
    total_transaction: '',
    driver_tip: '',
    notes: '',
    attachments: [],
  });
  const [uploading, setUploading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    payment_method_id: '',
    proof: null,
  });
  const [payments, setPayments] = useState([]);

  // Tab 3 State
  const [deliveryDetails, setDeliveryDetails] = useState({
    arrival_date: '',
    central_note_number: '',
    delivery_notes_url: [],
  });
  const [receivedItems, setReceivedItems] = useState([]);
  
  const totalOrderValue = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      return sum + (qty * price);
    }, 0);
  }, [orderItems]);

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const remainingDue = useMemo(() => {
    return totalOrderValue - totalPaid;
  }, [totalOrderValue, totalPaid]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };
  
  useEffect(() => {
    if (!authLoading && companyId) {
      fetchData();
    }
  }, [authLoading, companyId, id]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProductsAndPrices(),
      fetchPaymentMethods()
    ]);
    if (id) {
      setIsNewOrder(false);
      await fetchCentralOrder(id);
    } else {
      setLoading(false);
    }
  };
  
  const fetchProductsAndPrices = async () => {
    if (!companyId) return;

    // Ambil purchase_price dari tabel products
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, name, stock, purchase_price')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    
    if (productsError) {
      console.error('Error fetching products:', productsError);
      toast.error('Gagal memuat daftar produk.');
      return;
    }
    setProducts(productsData);

    // Siapkan map untuk harga beli
    const purchasePricesMap = productsData.reduce((acc, p) => {
      acc[p.id] = p.purchase_price;
      return acc;
    }, {});
    setPurchasePrices(purchasePricesMap);
  };
  
  const fetchPaymentMethods = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, method_name, account_name')
      .eq('company_id', companyId);
    if (!error) {
      setPaymentMethods(data);
    }
  };

  const fetchCentralOrder = async (orderId) => {
    if (!companyId) return;

    const { data: orderData, error: orderError } = await supabase
      .from('central_orders')
      .select(`
        *,
        items:central_order_items (product_id, qty, price, received_qty, products(name, stock, purchase_price))
      `)
      .eq('id', orderId)
      .eq('company_id', companyId)
      .single();
    
    if (orderError) {
      console.error('Error fetching central order:', orderError);
      toast.error('Gagal memuat detail pesanan.');
      setLoading(false);
      return;
    }

    const { data: paymentsData } = await supabase
      .from('financial_transactions')
      .select('amount, transaction_date, proof_url, payment_method:payment_method_id(method_name, account_name)')
      .eq('source_table', 'central_orders')
      .eq('source_id', orderId)
      .eq('type', 'expense');

    setPayments(paymentsData || []);
    
    setOrderDate(orderData.order_date);
    setOrderItems(orderData.items.map(item => ({
      ...item,
      product_name: item.products.name,
      current_stock: item.products.stock,
      price: item.products.purchase_price, // Gunakan purchase_price saat memuat data
    })));
    setReceivedItems(orderData.items.map(item => ({
      product_id: item.product_id,
      product_name: item.products.name,
      ordered_qty: item.qty,
      received_qty: item.received_qty || 0,
    })));
    
    setTransactionDetails({
      total_transaction: orderData.total_transaction ?? '',
      driver_tip: orderData.driver_tip ?? '',
      notes: orderData.notes ?? '',
      attachments: orderData.attachments || [],
    });
    setDeliveryDetails({
      arrival_date: orderData.arrival_date ?? '',
      central_note_number: orderData.central_note_number ?? '',
      delivery_notes_url: orderData.attachments?.filter(a => a.file_type === 'delivery_note').map(a => a.file_url) || [],
    });
    
    setLoading(false);
  };

  // Tab 1 Logic
  const handleItemChange = (index, field, value) => {
    const newItems = [...orderItems];
    newItems[index][field] = value;
    
    // Mengisi harga secara otomatis dari purchasePrices
    if (field === 'product_id' && purchasePrices[value]) {
        newItems[index].price = purchasePrices[value];
    }
    
    setOrderItems(newItems);
  };

  const handleAddItem = () => {
    setOrderItems([...orderItems, { product_id: '', qty: 1, price: 0 }]);
  };

  const handleRemoveItem = (index) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };
  
  const handleSaveOrder = async () => {
    setLoading(true);
    if (!userProfile?.id || !companyId) {
        toast.error('Profil pengguna atau ID perusahaan tidak ditemukan. Silakan login ulang.');
        setLoading(false);
        return;
    }
    try {
      if (isNewOrder) {
        const { data, error } = await supabase
          .from('central_orders')
          .insert({
            order_date: orderDate,
            company_id: userProfile.company_id,
            user_id: userProfile.id,
            status: 'draft',
            attachments: [],
          })
          .select()
          .single();
        if (error) throw error;
        
        const { error: itemsError } = await supabase
          .from('central_order_items')
          .insert(orderItems.map(item => ({
            central_order_id: data.id,
            product_id: item.product_id,
            qty: item.qty,
            price: item.price,
          })));
        if (itemsError) throw itemsError;
        
        const { error: pricesError } = await supabase
          .from('central_order_prices')
          .upsert(orderItems.map(item => ({
            product_id: item.product_id,
            price: item.price,
            order_date: orderDate,
            company_id: userProfile.company_id,
          })));
        if (pricesError) throw pricesError;

        toast.success('Pesanan berhasil dibuat!');
        navigate(`/central-order/${data.id}`);
      } else {
        const { error } = await supabase
          .from('central_orders')
          .update({ order_date: orderDate })
          .eq('id', id);
        if (error) throw error;

        await supabase.from('central_order_items').delete().eq('central_order_id', id);
        const { error: itemsError } = await supabase
          .from('central_order_items')
          .insert(orderItems.map(item => ({
            central_order_id: id,
            product_id: item.product_id,
            qty: item.qty,
            price: item.price,
          })));
        if (itemsError) throw itemsError;
        
        const { error: pricesError } = await supabase
          .from('central_order_prices')
          .upsert(orderItems.map(item => ({
            product_id: item.product_id,
            price: item.price,
            order_date: orderDate,
            company_id: userProfile.company_id,
          })));
        if (pricesError) throw pricesError;

        toast.success('Pesanan berhasil diperbarui!');
        fetchCentralOrder(id);
      }
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Gagal menyimpan pesanan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Tab 2 Logic (upload to proofs/central-orders/{company}/{order}/)
  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!id) {
        toast.error('Harap simpan pesanan terlebih dahulu.');
        return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${userProfile.company_id}/${id}/${type}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('proofs')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      toast.error('Gagal mengunggah file.');
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('proofs')
      .getPublicUrl(filePath);
    
    const newAttachment = { file_type: type, file_url: publicUrlData.publicUrl };
    const newAttachments = [...transactionDetails.attachments, newAttachment];

    const { error: dbError } = await supabase
        .from('central_orders')
        .update({ attachments: newAttachments })
        .eq('id', id);

    if (dbError) {
      console.error('Error saving file URL to DB:', dbError);
      toast.error('Gagal menyimpan tautan file.');
      setUploading(false);
      return;
    }

    setTransactionDetails(prev => ({ ...prev, attachments: newAttachments }));
    
    toast.success('File berhasil diunggah!');
    setUploading(false);
  };
  
  const handleUpdateTransaction = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('central_orders')
        .update({
          total_transaction: totalOrderValue || null,
          driver_tip: transactionDetails.driver_tip || null,
          notes: transactionDetails.notes || '',
        })
        .eq('id', id);
      if (error) throw error;
      toast.success('Detail transaksi berhasil diperbarui.');
    } catch (error) {
      console.error('Error updating transaction details:', error);
      toast.error('Gagal memperbarui detail transaksi.');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePaymentFormChange = (field, value) => {
      setNewPayment(prev => ({ ...prev, [field]: value }));
  };
  
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!newPayment.amount || !newPayment.payment_method_id) {
        toast.error('Jumlah dan metode pembayaran harus diisi.');
        return;
    }
    
    setUploading(true);
    let proofUrl = null;
    try {
      if (newPayment.proof) {
        const fileExt = newPayment.proof.name.split('.').pop();
        const filePath = `${companyId}/transactions/${id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('proofs')
          .upload(filePath, newPayment.proof);

        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('proofs')
          .getPublicUrl(filePath);
        proofUrl = publicUrlData.publicUrl;
      }
      
      const { error: insertError } = await supabase
        .from('financial_transactions')
        .insert({
          company_id: companyId,
          type: 'expense',
          amount: parseFloat(newPayment.amount),
          payment_method_id: newPayment.payment_method_id,
          proof_url: proofUrl,
          source_table: 'central_orders',
          source_id: id,
        });
        
      if (insertError) throw insertError;

      toast.success('Pembayaran berhasil dicatat!');
      setNewPayment({ amount: '', payment_method_id: '', proof: null });
      fetchCentralOrder(id);

    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Gagal mencatat pembayaran: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Tab 3 Logic
  const handleReceivedQtyChange = (index, value) => {
    const newReceivedItems = [...receivedItems];
    newReceivedItems[index].received_qty = value;
    setReceivedItems(newReceivedItems);
  };
  
  const handleFinalizeReceipt = async () => {
    setLoading(true);
    try {
      const { error: updateOrderError } = await supabase
        .from('central_orders')
        .update({
          arrival_date: deliveryDetails.arrival_date || null,
          central_note_number: deliveryDetails.central_note_number || null,
          status: 'received',
        })
        .eq('id', id);
      if (updateOrderError) throw updateOrderError;

      const itemsToLog = receivedItems.filter(item => item.received_qty > 0);
      if (itemsToLog.length > 0) {
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert(itemsToLog.map(item => ({
            product_id: item.product_id,
            qty: parseFloat(item.received_qty),
            type: 'masuk_dari_pusat',
            notes: `Barang diterima dari pusat (Nomor Surat: ${deliveryDetails.central_note_number})`,
            company_id: userProfile.company_id,
            user_id: userProfile.id,
            central_order_id: id,
          })));
        if (movementError) throw movementError;
      }
      
      const updatedItemsPayload = receivedItems.map(receivedItem => {
      const originalItem = orderItems.find(
        (item) => item.product_id === receivedItem.product_id
      );
      return {
        central_order_id: id,
        product_id: receivedItem.product_id,
        received_qty: receivedItem.received_qty,
        qty: originalItem ? originalItem.qty : 0,
        price: originalItem ? originalItem.price : 0,
      };
    });

    const { error: itemUpdateError } = await supabase
      .from('central_order_items')
      .upsert(updatedItemsPayload, { onConflict: ['central_order_id', 'product_id'] });
      if (itemUpdateError) throw itemUpdateError;
      
      toast.success('Penerimaan barang berhasil dicatat dan stok diperbarui!');
      navigate('/central-orders');
    } catch (error) {
      console.error('Error finalizing receipt:', error);
      toast.error('Gagal mencatat penerimaan barang: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isCrossCheckEnabled = !isNewOrder && orderItems.length > 0;
  
  if (authLoading || !userProfile) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">{isNewOrder ? 'Pesanan Baru dari Pusat' : `Detail Pesanan #${id?.slice(0, 8)}`}</h1>
        <Button onClick={() => navigate('/central-orders')} variant="outline">Kembali</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="bg-white rounded-lg border p-1 mb-6">
          <TabsList className="grid w-full justify-start grid-cols-1 gap-1 bg-transparent p-0 h-auto md:grid-cols-3">
            <TabsTrigger 
              className="w-full text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white rounded-md" 
              value="order-items"
            >
              1. Detail & Item
            </TabsTrigger>
            {!isNewOrder && (
              <TabsTrigger 
                className="w-full text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white rounded-md" 
                value="attachments-expenses"
              >
                2. Pembayaran & Lampiran
              </TabsTrigger>
            )}
            {isCrossCheckEnabled && (
              <TabsTrigger 
                className="w-full text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white rounded-md" 
                value="cross-check"
              >
                3. Pengecekan Barang Datang
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Tab 1: Detail & Item */}
        <TabsContent value="order-items">
          <Card>
            <CardHeader><CardTitle>Detail Pesanan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="order-date">Tanggal Pesanan</Label>
                <Input
                  id="order-date"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>
              <h3 className="font-semibold mt-6">Daftar Item</h3>
              <div className="space-y-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-2 items-end">
                    <div className="w-full sm:w-auto flex-1">
                      <Label htmlFor={`product-${index}`}>Produk</Label>
                      <Select
                        value={item.product_id}
                        onValueChange={(val) => handleItemChange(index, 'product_id', val)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih Produk" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(product => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full sm:w-24">
                      <Label htmlFor={`qty-${index}`}>Jumlah</Label>
                      <Input
                        id={`qty-${index}`}
                        type="number"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                        min="1"
                      />
                    </div>
                    <div className="w-full sm:w-32">
                      <Label htmlFor={`price-${index}`}>Harga Per Item</Label>
                      <Input
                        id={`price-${index}`}
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                        placeholder="Harga"
                        
                        readOnly // Membuat input read-only
                        className="bg-gray-100 cursor-not-allowed"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                      className="mt-2 sm:mt-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" /> Tambah Item
              </Button>
              <Button onClick={handleSaveOrder} className="w-full mt-4 bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={loading || authLoading}>
                {loading || authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Pesanan'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Pembayaran & Lampiran */}
        {!isNewOrder && (
          <TabsContent value="attachments-expenses">
            <Card>
              <CardHeader><CardTitle>Pembayaran & Lampiran</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Lampiran</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="proof-transfer">Bukti Transfer</Label>
                      <Input
                        id="proof-transfer"
                        type="file"
                        onChange={(e) => handleFileUpload(e, 'proof_transfer')}
                        disabled={uploading}
                      />
                      {transactionDetails.attachments.find(a => a.file_type === 'proof_transfer') && (
                        <a href={transactionDetails.attachments.find(a => a.file_type === 'proof_transfer')?.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 underline">
                            <FileIcon className="h-4 w-4 mr-1" /> Lihat file
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="proforma-invoice">Faktur Proforma</Label>
                      <Input
                        id="proforma-invoice"
                        type="file"
                        onChange={(e) => handleFileUpload(e, 'proforma_invoice')}
                        disabled={uploading}
                      />
                      {transactionDetails.attachments.find(a => a.file_type === 'proforma_invoice') && (
                        <a href={transactionDetails.attachments.find(a => a.file_type === 'proforma_invoice')?.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 underline">
                          <FileIcon className="h-4 w-4 mr-1" /> Lihat file
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <Label className="text-xl font-semibold flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5" /> Pembayaran
                  </Label>
                  <div className="space-y-2">
                    <Label>Total Transaksi</Label>
                    <p className="text-2xl font-bold">{formatCurrency(totalOrderValue)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Total Dibayar</Label>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sisa Pembayaran</Label>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(remainingDue)}</p>
                  </div>

                  <Separator />

                  <form onSubmit={handleRecordPayment} className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="payment_amount">Nominal Pembayaran</Label>
                        <Input
                          id="payment_amount"
                          type="number"
                          placeholder="Jumlah Pembayaran"
                          value={newPayment.amount}
                          onChange={(e) => setNewPayment(prev => ({...prev, amount: e.target.value}))}
                          
                          required
                          disabled={remainingDue <= 0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment_method">Metode Pembayaran</Label>
                        <Select
                          value={newPayment.payment_method_id}
                          onValueChange={(value) => setNewPayment(prev => ({...prev, payment_method_id: value}))}
                          required
                          disabled={remainingDue <= 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih metode" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map(method => (
                              <SelectItem key={method.id} value={method.id}>
                                {method.method_name} ({method.account_name})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="proof-payment">Bukti Transfer/Pembayaran</Label>
                      <Input
                        id="proof-payment"
                        type="file"
                        onChange={(e) => setNewPayment(prev => ({...prev, proof: e.target.files[0]}))}
                        accept="image/*"
                        disabled={remainingDue <= 0}
                      />
                    </div>
                    <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={uploading || remainingDue <= 0}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Catat Pembayaran'}
                    </Button>
                    {remainingDue <= 0 && <p className="text-sm text-green-600 text-center">Pembayaran sudah lunas.</p>}
                  </form>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                    <Label className="text-xl font-semibold flex items-center gap-2 mb-2">
                        <Wallet className="h-5 w-5" /> Riwayat Pembayaran
                    </Label>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Jumlah</TableHead>
                            <TableHead>Metode</TableHead>
                            <TableHead>Bukti</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell>{new Date(p.transaction_date).toLocaleDateString()}</TableCell>
                              <TableCell>{formatCurrency(p.amount)}</TableCell>
                              <TableCell>{p.payment_method.method_name}</TableCell>
                              <TableCell>
                                {p.proof_url ? (
                                  <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                    Lihat Bukti
                                  </a>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {payments.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                Belum ada riwayat pembayaran.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Detail Transaksi Lainnya</Label>
                  <Input
                    label="Tip Supir"
                    type="number"
                    placeholder="Tip Supir"
                    value={transactionDetails.driver_tip}
                    onChange={(e) => setTransactionDetails({...transactionDetails, driver_tip: e.target.value})}
                  />
                  <Input
                    label="Catatan"
                    type="text"
                    placeholder="Catatan"
                    value={transactionDetails.notes}
                    onChange={(e) => setTransactionDetails({...transactionDetails, notes: e.target.value})}
                  />
                </div>
                <Button onClick={handleUpdateTransaction} className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Detail Transaksi Lainnya'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab 3: Pengecekan Barang Datang */}
        {isCrossCheckEnabled && (
          <TabsContent value="cross-check">
            <Card>
              <CardHeader><CardTitle>Pengecekan Barang Datang</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="arrival-date">Tanggal Barang Datang</Label>
                    <Input
                      id="arrival-date"
                      type="date"
                      value={deliveryDetails.arrival_date}
                      onChange={(e) => setDeliveryDetails({ ...deliveryDetails, arrival_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="central-note-number">Nomor Surat Jalan Pusat</Label>
                    <Input
                      id="central-note-number"
                      type="text"
                      value={deliveryDetails.central_note_number}
                      onChange={(e) => setDeliveryDetails({ ...deliveryDetails, central_note_number: e.target.value })}
                      placeholder="Contoh: SJ-001/2025"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Surat Jalan (Lampiran)</Label>
                  <Input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'delivery_note')}
                    disabled={uploading}
                    multiple
                  />
                  <div className="flex flex-wrap gap-2">
                    {transactionDetails.attachments.filter(a => a.file_type === 'delivery_note').map((attachment, index) => (
                      <a key={index} href={attachment.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 underline">
                        <FileIcon className="h-4 w-4 mr-1" /> File {index + 1}
                      </a>
                    ))}
                  </div>
                </div>

                <h3 className="font-semibold mt-6">Detail Barang Diterima</h3>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Produk</TableHead>
                        <TableHead className="min-w-[120px]">Jumlah Dipesan</TableHead>
                        <TableHead className="min-w-[150px]">Jumlah Diterima</TableHead>
                        <TableHead className="min-w-[100px]">Selisih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivedItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{item.ordered_qty}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.received_qty}
                              onChange={(e) => handleReceivedQtyChange(index, e.target.value)}
                              
                            />
                          </TableCell>
                          <TableCell>
                            {parseInt(item.received_qty) - parseInt(item.ordered_qty)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button onClick={handleFinalizeReceipt} className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Selesaikan Pengecekan & Perbarui Stok'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default CentralOrderFormPage;