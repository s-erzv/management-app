import { useEffect, useState } from 'react';
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
import { Loader2, Plus, Trash2, FileIcon } from 'lucide-react';
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

const CentralOrderFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile, loading: authLoading, companyId } = useAuth();
  
  const [products, setProducts] = useState([]);
  const [productPrices, setProductPrices] = useState({});
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

  // Tab 3 State
  const [deliveryDetails, setDeliveryDetails] = useState({
    arrival_date: '',
    central_note_number: '',
    delivery_notes_url: [],
  });
  const [receivedItems, setReceivedItems] = useState([]);
  
  useEffect(() => {
    if (!authLoading && companyId) {
      fetchData();
    }
  }, [authLoading, companyId, id]);

  const fetchData = async () => {
    setLoading(true);
    await fetchProductsAndPrices();
    if (id) {
      setIsNewOrder(false);
      await fetchCentralOrder(id);
    } else {
      setLoading(false);
    }
  };
  
  const fetchProductsAndPrices = async () => {
    if (!companyId) return;

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, name, stock')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    
    if (productsError) {
      console.error('Error fetching products:', productsError);
      toast.error('Gagal memuat daftar produk.');
      return;
    }
    setProducts(productsData);

    const { data: pricesData, error: pricesError } = await supabase
      .from('central_order_prices')
      .select('product_id, price')
      .eq('company_id', companyId)
      .in('product_id', productsData.map(p => p.id))
      .order('order_date', { ascending: false });
      
    if (!pricesError) {
      const latestPrices = {};
      pricesData.forEach(p => {
        if (!latestPrices[p.product_id]) {
          latestPrices[p.product_id] = p.price;
        }
      });
      setProductPrices(latestPrices);
    }
  };
  
  const fetchCentralOrder = async (orderId) => {
    if (!companyId) return;

    const { data: orderData, error: orderError } = await supabase
      .from('central_orders')
      .select(`
        *,
        items:central_order_items (product_id, qty, price, received_qty, products(name, stock))
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
    
    setOrderDate(orderData.order_date);
    setOrderItems(orderData.items.map(item => ({
      ...item,
      product_name: item.products.name,
      current_stock: item.products.stock,
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
    
    if (field === 'product_id' && productPrices[value]) {
        newItems[index].price = productPrices[value];
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
    const filePath = `central-orders/${userProfile.company_id}/${id}/${type}_${Date.now()}.${fileExt}`;

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
          total_transaction: transactionDetails.total_transaction || null,
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
            central_order_id: id, // Corrected from order_id to central_order_id
          })));
        if (movementError) throw movementError;
      }
      
      // Mengambil data qty asli dari state orderItems untuk dimasukkan ke upsert
      const updatedItemsPayload = receivedItems.map(receivedItem => {
      const originalItem = orderItems.find(
        (item) => item.product_id === receivedItem.product_id
      );
      return {
        central_order_id: id,
        product_id: receivedItem.product_id,
        received_qty: receivedItem.received_qty,
        qty: originalItem ? originalItem.qty : 0, // Menyertakan qty
        price: originalItem ? originalItem.price : 0, // Menyertakan price
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{isNewOrder ? 'Pesanan Baru dari Pusat' : `Detail Pesanan #${id?.slice(0, 8)}`}</h1>
        <Button onClick={() => navigate('/central-orders')} variant="outline">Kembali</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="order-items">1. Detail & Item</TabsTrigger>
          {!isNewOrder && <TabsTrigger value="attachments-expenses">2. Pembayaran & Lampiran</TabsTrigger>}
          {isCrossCheckEnabled && <TabsTrigger value="cross-check">3. Pengecekan Barang Datang</TabsTrigger>}
        </TabsList>

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
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
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
                    <div className="w-24">
                      <Label htmlFor={`qty-${index}`}>Jumlah</Label>
                      <Input
                        id={`qty-${index}`}
                        type="number"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                        min="1"
                      />
                    </div>
                    <div className="w-32">
                      <Label htmlFor={`price-${index}`}>Harga Per Item</Label>
                      <Input
                        id={`price-${index}`}
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                        placeholder="Harga"
                        min="0"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" /> Tambah Item
              </Button>
              <Button onClick={handleSaveOrder} className="w-full mt-4" disabled={loading || authLoading}>
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

                <div className="space-y-4">
                  <Label>Detail Transaksi</Label>
                  <Input
                    label="Total Transaksi"
                    type="number"
                    placeholder="Total Transaksi"
                    value={transactionDetails.total_transaction}
                    onChange={(e) => setTransactionDetails({...transactionDetails, total_transaction: e.target.value})}
                  />
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
                <Button onClick={handleUpdateTransaction} className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Detail Transaksi'}
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
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>Jumlah Dipesan</TableHead>
                        <TableHead>Jumlah Diterima</TableHead>
                        <TableHead>Selisih</TableHead>
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
                              min="0"
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
                <Button onClick={handleFinalizeReceipt} className="w-full" disabled={loading}>
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