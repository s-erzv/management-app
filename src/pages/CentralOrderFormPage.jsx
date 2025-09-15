// src/components/CentralOrderFormPage.jsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2, FileIcon, DollarSign, Wallet, Package, ArrowLeft, MessageSquareText, Pencil, ChevronsUpDown } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import WhatsappOrderModal from '@/components/WhatsappOrderModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils'; // Pastikan Anda memiliki utilitas ini

const CentralOrderFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile, loading: authLoading, companyId, session } = useAuth();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNewOrder, setIsNewOrder] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  
  // Tab 1 State
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderItems, setOrderItems] = useState([]);
  const [activeTab, setActiveTab] = useState('order-items');

  // States baru untuk popover produk
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState({});

  // Tab 2 State
  const [transactionDetails, setTransactionDetails] = useState({
    driver_tip: '',
    notes: '',
    attachments: [],
    admin_fee: '',
  });
  const [uploading, setUploading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    payment_method_id: '',
    proof: null,
  });
  const [payments, setPayments] = useState([]);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);

  // States untuk edit pembayaran
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
      amount: '',
      payment_method_id: '',
  });

  // Tab 3 State
  const [deliveryDetails, setDeliveryDetails] = useState({
    arrival_date: '',
    central_note_number: '',
    delivery_notes_url: [],
  });

  const [gallonDetails, setGallonDetails] = useState({});
  const [receivedItems, setReceivedItems] = useState([]);
  
  const totalItemsValue = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      return sum + (qty * price);
    }, 0);
  }, [orderItems]);

  const totalOrderValue = useMemo(() => {
    const totalGalonPrice = Object.values(gallonDetails).reduce((sum, galon) => {
      const soldEmptyQty = parseFloat(galon.sold_empty_to_central) || 0;
      const soldEmptyPrice = parseFloat(galon.sold_empty_price) || 0;
      return sum + (soldEmptyQty * soldEmptyPrice);
    }, 0);
    const adminFee = parseFloat(transactionDetails.admin_fee) || 0;
    const driverTip = parseFloat(transactionDetails.driver_tip) || 0;
    return totalItemsValue + totalGalonPrice + adminFee + driverTip;
  }, [totalItemsValue, gallonDetails, transactionDetails.admin_fee, transactionDetails.driver_tip]);

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
  
  const handleInputWheel = (e) => {
    e.target.blur();
  };
  
  useEffect(() => {
    if (!authLoading && companyId) {
      fetchData();
    }
  }, [authLoading, companyId, id]);

  useEffect(() => {
    if (activeTab === 'attachments-expenses' && !isNewOrder) {
      if (remainingDue > 0) {
        setNewPayment(prev => ({ ...prev, amount: remainingDue.toString() }));
      } else {
        setNewPayment(prev => ({ ...prev, amount: '' }));
      }
    }
  }, [activeTab, isNewOrder, remainingDue]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchSuppliers(),
      fetchPaymentMethods(),
      fetchProductsAndPrices()
    ]);
    if (id) {
      setIsNewOrder(false);
      await fetchCentralOrder(id);
    } else {
      setOrderItems([{ product_id: '', qty: '', price: '', is_returnable: false }]);
      setLoading(false);
    }
  };
  
  const fetchSuppliers = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, phone')
        .eq('company_id', companyId);
    if (!error) {
        setSuppliers(data);
    }
  };
  
  const fetchProductsAndPrices = async () => {
    if (!companyId) return;

    let query = supabase.from('products').select('id, name, stock, empty_bottle_stock, purchase_price, is_returnable, empty_bottle_price, sort_order, supplier_id').eq('company_id', companyId);
    query = query.order('sort_order', { ascending: true }).order('name', { ascending: true });

    const { data: productsData, error: productsError } = await query;
    
    if (productsError) {
      console.error('Error fetching products:', productsError);
      toast.error('Gagal memuat daftar produk.');
      return;
    }
    setProducts(productsData);
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
        items:central_order_items (product_id, qty, price, received_qty, sold_empty_price, products(id, name, stock, empty_bottle_stock, purchase_price, is_returnable, empty_bottle_price, supplier_id))
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
    
    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, stock, empty_bottle_stock, purchase_price, is_returnable, empty_bottle_price, sort_order, supplier_id')
      .eq('company_id', companyId);
    setProducts(productsData || []);
    
    const { data: paymentsData } = await supabase
      .from('financial_transactions')
      .select('*, payment_method:payment_method_id(method_name, account_name)')
      .eq('source_table', 'central_orders')
      .eq('source_id', orderId)
      .eq('type', 'expense');

    setPayments(paymentsData || []);
    
    setOrderDate(orderData.order_date);
    setOrderItems(orderData.items.map(item => {
      const product = productsData?.find(p => p.id === item.product_id) || {};
      return {
        ...item,
        product_name: product.name,
        is_returnable: product.is_returnable,
        qty: item.qty || '',
        price: item.price || '',
        sold_empty_price: item.sold_empty_price || '',
      };
    }));
    
    setReceivedItems(orderData.items.map(item => {
      const product = productsData?.find(p => p.id === item.product_id) || {};
      return {
        product_id: item.product_id,
        product_name: product.name,
        ordered_qty: item.qty,
        received_qty: item.received_qty || '',
      };
    }));
    
    setGallonDetails(orderData.items.reduce((acc, item) => {
      const product = productsData?.find(p => p.id === item.product_id) || {};
      if (product.is_returnable) {
        acc[item.product_id] = {
          returned_to_central: orderData.returned_to_central?.[item.product_id] || '',
          borrowed_from_central: orderData.borrowed_from_central?.[item.product_id] || '',
          sold_empty_to_central: orderData.sold_empty_to_central?.[item.product_id] || '',
          sold_empty_price: item.sold_empty_price || '',
        };
      }
      return acc;
    }, {}));
    
    setTransactionDetails({
      driver_tip: orderData.driver_tip || '',
      notes: orderData.notes || '',
      attachments: orderData.attachments || [],
      admin_fee: orderData.admin_fee || '',
    });
    
    setDeliveryDetails({
      arrival_date: orderData.arrival_date || '',
      central_note_number: orderData.central_note_number || '',
      delivery_notes_url: orderData.attachments?.filter(a => a.file_type === 'delivery_note').map(a => a.file_url) || [],
    });

    setLoading(false);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...orderItems];
    newItems[index][field] = value;
    
    if (field === 'product_id') {
        const selectedProduct = products.find(p => p.id === value);
        if (selectedProduct) {
            newItems[index].price = selectedProduct.purchase_price;
            newItems[index].is_returnable = selectedProduct.is_returnable;
            newItems[index].sold_empty_price = selectedProduct.empty_bottle_price;
            if (selectedProduct.is_returnable) {
                setGallonDetails(prev => ({
                    ...prev,
                    [value]: {
                        returned_to_central: '',
                        borrowed_from_central: '',
                        sold_empty_to_central: '',
                        sold_empty_price: selectedProduct.empty_bottle_price,
                    }
                }));
            }
        } else {
            newItems[index].is_returnable = false;
        }
    }
    
    setOrderItems(newItems);
  };

  const handleAddItem = () => {
    setOrderItems([...orderItems, { product_id: '', qty: '', price: '', is_returnable: false }]);
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
            notes: transactionDetails.notes,
          })
          .select()
          .single();
        if (error) throw error;
        
        const { error: itemsError } = await supabase
          .from('central_order_items')
          .insert(orderItems.map(item => ({
            central_order_id: data.id,
            product_id: item.product_id,
            qty: parseFloat(item.qty) || 0,
            price: parseFloat(item.price) || 0,
            sold_empty_price: parseFloat(item.sold_empty_price) || 0,
          })));
        if (itemsError) throw itemsError;
        
        const { error: pricesError } = await supabase
          .from('central_order_prices')
          .upsert(orderItems.map(item => ({
            product_id: item.product_id,
            price: parseFloat(item.price) || 0,
            order_date: orderDate,
            company_id: userProfile.company_id,
          })));
        if (pricesError) throw pricesError;

        toast.success('Pesanan berhasil dibuat!');
        navigate(`/central-order/${data.id}`);
      } else {
        const { error } = await supabase
          .from('central_orders')
          .update({
            order_date: orderDate,
            notes: transactionDetails.notes,
          })
          .eq('id', id);
        if (error) throw error;

        await supabase.from('central_order_items').delete().eq('central_order_id', id);
        const { error: itemsError } = await supabase
          .from('central_order_items')
          .insert(orderItems.map(item => ({
            central_order_id: id,
            product_id: item.product_id,
            qty: parseFloat(item.qty) || 0,
            price: parseFloat(item.price) || 0,
            sold_empty_price: parseFloat(item.sold_empty_price) || 0,
          })));
        if (itemsError) throw itemsError;
        
        const { error: pricesError } = await supabase
          .from('central_order_prices')
          .upsert(orderItems.map(item => ({
            product_id: item.product_id,
            price: parseFloat(item.price) || 0,
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

  const handleFileUpload = async (e, type) => {
    const files = e.target.files;
    if (files.length === 0 || !id) {
      if (!id) toast.error('Harap simpan pesanan terlebih dahulu.');
      return;
    }

    setUploading(true);
    const newAttachments = [...transactionDetails.attachments];
    const uploadPromises = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userProfile.company_id}/${id}/${type}_${Date.now()}_${i}.${fileExt}`;

      uploadPromises.push(
        supabase.storage
          .from('proofs')
          .upload(filePath, file)
          .then(({ data, error }) => {
            if (error) {
              console.error('Error uploading file:', error);
              return null;
            }
            const { data: publicUrlData } = supabase.storage
              .from('proofs')
              .getPublicUrl(filePath);
            return { file_type: type, file_url: publicUrlData.publicUrl };
          })
      );
    }

    try {
      const uploadedFiles = await Promise.all(uploadPromises);
      const validUploads = uploadedFiles.filter(Boolean);

      const updatedAttachments = [...newAttachments, ...validUploads];

      const { error: dbError } = await supabase
        .from('central_orders')
        .update({ attachments: updatedAttachments })
        .eq('id', id);

      if (dbError) throw dbError;

      setTransactionDetails(prev => ({ ...prev, attachments: updatedAttachments }));
      toast.success('File berhasil diunggah!');

    } catch (error) {
      console.error('Error in file upload process:', error);
      toast.error('Gagal mengunggah file.');
    } finally {
      setUploading(false);
    }
  };
  
  const handleUpdateTransaction = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('central_orders')
        .update({
          total_transaction: totalOrderValue,
          driver_tip: parseFloat(transactionDetails.driver_tip) || null,
          notes: transactionDetails.notes || '',
          admin_fee: parseFloat(transactionDetails.admin_fee) || null,
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
    if (!newPayment.amount || parseFloat(newPayment.amount) <= 0 || !newPayment.payment_method_id) {
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

  const handleEditPaymentClick = (payment) => {
      setPaymentToEdit(payment);
      setEditPaymentForm({
          amount: payment.amount,
          payment_method_id: payment.payment_method_id,
      });
      setIsEditPaymentModalOpen(true);
  };
  
  const handleUpdatePayment = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
          const { error } = await supabase
              .from('financial_transactions')
              .update({
                  amount: parseFloat(editPaymentForm.amount),
                  payment_method_id: editPaymentForm.payment_method_id,
              })
              .eq('id', paymentToEdit.id);
          if (error) throw error;
          
          toast.success('Pembayaran berhasil diperbarui!');
          setIsEditPaymentModalOpen(false);
          setPaymentToEdit(null);
          fetchCentralOrder(id);
      } catch (error) {
          console.error('Error updating payment:', error);
          toast.error('Gagal memperbarui pembayaran: ' + error.message);
      } finally {
          setLoading(false);
      }
  };
  
  const handleDeletePayment = async (paymentId) => {
      if (!window.confirm('Apakah Anda yakin ingin menghapus pembayaran ini?')) return;
      setLoading(true);
      try {
          const { error } = await supabase
              .from('financial_transactions')
              .delete()
              .eq('id', paymentId);
          if (error) throw error;

          toast.success('Pembayaran berhasil dihapus!');
          fetchCentralOrder(id);
      } catch (error) {
          console.error('Error deleting payment:', error);
          toast.error('Gagal menghapus pembayaran: ' + error.message);
      } finally {
          setLoading(false);
      }
  };

  const handleReceivedQtyChange = (index, value) => {
    const newReceivedItems = [...receivedItems];
    newReceivedItems[index].received_qty = value;
    setReceivedItems(newReceivedItems);
  };
  
  const handleGallonDetailsChange = (productId, field, value) => {
    setGallonDetails(prev => ({
        ...prev,
        [productId]: {
            ...prev[productId],
            [field]: value,
        }
    }));
  };
  
  const handleDeleteOrder = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pesanan pusat ini? Semua data terkait akan dihapus dan stok akan dikembalikan.')) return;
    setLoading(true);
    try {
        const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/manage-central-order-galons', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ orderId: id, companyId }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Gagal menghapus pesanan.');
        }

        toast.success('Pesanan berhasil dihapus dan stok dikembalikan!');
        navigate('/central-orders');
    } catch (error) {
        console.error('Error deleting central order:', error);
        toast.error('Gagal menghapus pesanan: ' + error.message);
    } finally {
        setLoading(false);
    }
  };

  const handleFinalizeReceipt = async () => {
    setLoading(true);

    const galonDetailsPayload = {};
    for (const productId in gallonDetails) {
        galonDetailsPayload[productId] = {
            returned_to_central: parseFloat(gallonDetails[productId].returned_to_central) || 0,
            borrowed_from_central: parseFloat(gallonDetails[productId].borrowed_from_central) || 0,
            sold_empty_to_central: parseFloat(gallonDetails[productId].sold_empty_to_central) || 0,
            sold_empty_price: parseFloat(gallonDetails[productId].sold_empty_price) || 0,
        };
    }
    
    const payload = {
      orderId: id,
      receivedItems,
      orderItems, 
      galonDetails: galonDetailsPayload,
      deliveryDetails,
      companyId,
      userId: userProfile.id,
    };

    try {
      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/manage-central-order-galons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Gagal mencatat penerimaan barang.');
      }
      
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

  const handleProductSelectChange = (index, productId) => {
    handleItemChange(index, 'product_id', productId);
    setIsProductPopoverOpen(prev => ({ ...prev, [index]: false }));
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">{isNewOrder ? 'Pesanan Baru dari Pusat' : `Detail Pesanan #${id?.slice(0, 8)}`}</h1>
        <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/central-orders')} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
            </Button>
            <Button
                variant="outline"
                onClick={() => setIsWhatsappModalOpen(true)}
                disabled={isNewOrder}
            >
                <MessageSquareText className="h-4 w-4 mr-2" /> Kirim Pesan
            </Button>
            {!isNewOrder && (
              <>
                <Button
                  onClick={handleDeleteOrder}
                  variant="destructive"
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Hapus Pesanan
                </Button>
              </>
            )}
        </div>
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
                {orderItems.map((item, index) => {
                  const selectedProductName = products.find(p => p.id === item.product_id)?.name || 'Pilih Produk';
                  return (
                  <div key={index} className="space-y-4 p-4 border rounded-md">
                    <div className="flex flex-col sm:flex-row gap-2 items-end">
                      <div className="w-full sm:w-auto flex-1">
                        <Label htmlFor={`product-${index}`}>Produk</Label>
                        {/* POP OVER PRODUCT START */}
                        <Popover open={isProductPopoverOpen[index]} onOpenChange={(open) => setIsProductPopoverOpen(prev => ({...prev, [index]: open}))}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isProductPopoverOpen[index]}
                              className="w-full justify-between"
                            >
                              {selectedProductName}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Cari produk..." />
                              <CommandList>
                                <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                <CommandGroup>
                                  {products.map(product => (
                                    <CommandItem
                                      key={product.id}
                                      value={product.name}
                                      onSelect={() => handleProductSelectChange(index, product.id)}
                                    >
                                      {product.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {/* POP OVER PRODUCT END */}
                      </div>
                      <div className="w-full sm:w-24">
                        <Label htmlFor={`qty-${index}`}>Jumlah</Label>
                        <Input
                          id={`qty-${index}`}
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                          onWheel={handleInputWheel}
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
                          onWheel={handleInputWheel}
                          readOnly
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
                  </div>
                )})}
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" /> Tambah Item
              </Button>
              <Button onClick={handleSaveOrder} className="w-full mt-4 bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={loading || authLoading}>
                {loading || authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isNewOrder ? 'Simpan Pesanan' : 'Perbarui Pesanan'}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Total Harga Barang</Label>
                      <p className="text-lg font-bold">{formatCurrency(totalItemsValue)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-fee">Biaya Admin</Label>
                      <Input
                        id="admin-fee"
                        type="number"
                        placeholder="Masukkan biaya admin"
                        value={transactionDetails.admin_fee}
                        onChange={(e) => setTransactionDetails({...transactionDetails, admin_fee: e.target.value})}
                        onWheel={handleInputWheel}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kemasan Returnable Dibeli dari Pusat</Label>
                      <p className="text-lg font-bold">{formatCurrency(totalOrderValue - totalItemsValue - (parseFloat(transactionDetails.admin_fee) || 0) - (parseFloat(transactionDetails.driver_tip) || 0))}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driver_tip">Tip Supir</Label>
                      <Input
                        id="driver_tip"
                        type="number"
                        placeholder="Masukkan tip supir"
                        value={transactionDetails.driver_tip}
                        onChange={(e) => setTransactionDetails({...transactionDetails, driver_tip: e.target.value})}
                        onWheel={handleInputWheel}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Total Tagihan</Label>
                    <p className="text-2xl font-bold text-[#10182b]">{formatCurrency(totalOrderValue)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Total Dibayar</Label>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
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
                          onWheel={handleInputWheel}
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
                            <TableHead>Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell>{new Date(p.transaction_date).toLocaleDateString()}</TableCell>
                              <TableCell>{formatCurrency(p.amount)}</TableCell>
                              <TableCell>{p.payment_method?.method_name || 'N/A'}</TableCell>
                              <TableCell>
                                {p.proof_url ? (
                                  <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                    Lihat Bukti
                                  </a>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                              <TableCell className="flex gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditPaymentClick(p)}>
                                      <Pencil className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeletePayment(p.id)}>
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {payments.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                              onWheel={handleInputWheel}
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
                
                {orderItems.filter(item => item.is_returnable).map(item => {
                    const productDetail = products.find(p => p.id === item.product_id);
                    const currentEmptyStock = productDetail ? productDetail.empty_bottle_stock : 0;
                    
                    const gallonsReturned = parseFloat(gallonDetails[item.product_id]?.returned_to_central) || 0;
                    const remainingStock = currentEmptyStock - gallonsReturned;

                    return (
                        <div key={item.product_id} className="space-y-4 col-span-full mt-4 p-4 border rounded-md bg-gray-50">
                            <h4 className="font-semibold text-[#10182b] flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Detail Kemasan Returnable ({item.product_name})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor={`galon-returned-${item.product_id}`}>
                                        Kemasan Returnable Dikembalikan ke Pusat
                                        <span className="ml-2 font-normal text-gray-500">
                                            (Stok sisa: {remainingStock} pcs)
                                        </span>
                                    </Label>
                                    <Input
                                        id={`galon-returned-${item.product_id}`}
                                        type="number"
                                        placeholder="0"
                                        value={gallonsReturned || ''}
                                        onChange={(e) => handleGallonDetailsChange(item.product_id, 'returned_to_central', e.target.value)}
                                        onWheel={handleInputWheel}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor={`galon-borrowed-${item.product_id}`}>Kemasan Returnable Dipinjam dari Pusat</Label>
                                    <Input
                                        id={`galon-borrowed-${item.product_id}`}
                                        type="number"
                                        placeholder="0"
                                        value={gallonDetails[item.product_id]?.borrowed_from_central || ''}
                                        onChange={(e) => handleGallonDetailsChange(item.product_id, 'borrowed_from_central', e.target.value)}
                                        onWheel={handleInputWheel}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor={`galon-sold-${item.product_id}`}>Kemasan Returnable Dibeli dari Pusat</Label>
                                    <Input
                                        id={`galon-sold-${item.product_id}`}
                                        type="number"
                                        placeholder="0"
                                        value={gallonDetails[item.product_id]?.sold_empty_to_central || ''}
                                        onChange={(e) => handleGallonDetailsChange(item.product_id, 'sold_empty_to_central', e.target.value)}
                                        onWheel={handleInputWheel}
                                    />
                                    <Label htmlFor={`price-sold-${item.product_id}`}>Harga Kemasan Returnable</Label>
                                    <Input
                                        id={`price-sold-${item.product_id}`}
                                        type="number"
                                        placeholder="0"
                                        value={gallonDetails[item.product_id]?.sold_empty_price || ''}
                                        onChange={(e) => handleGallonDetailsChange(item.product_id, 'sold_empty_price', e.target.value)}
                                        onWheel={handleInputWheel}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
              
              <Button onClick={handleFinalizeReceipt} className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Selesaikan Pengecekan & Perbarui Stok'}
              </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      <WhatsappOrderModal
        isOpen={isWhatsappModalOpen}
        onOpenChange={setIsWhatsappModalOpen}
        orderId={id}
        orderDate={orderDate}
        orderItems={orderItems}
        products={products}
        suppliers={suppliers}
      />
      
      {/* Modal Edit Pembayaran */}
      <Dialog open={isEditPaymentModalOpen} onOpenChange={setIsEditPaymentModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Pembayaran</DialogTitle>
                <DialogDescription>Perbarui nominal atau metode pembayaran.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdatePayment} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-amount">Nominal Pembayaran</Label>
                    <Input
                        id="edit-amount"
                        type="number"
                        value={editPaymentForm.amount}
                        onChange={(e) => setEditPaymentForm({...editPaymentForm, amount: e.target.value})}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-method">Metode Pembayaran</Label>
                    <Select
                        value={editPaymentForm.payment_method_id}
                        onValueChange={(value) => setEditPaymentForm({...editPaymentForm, payment_method_id: value})}
                        required
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
                <DialogFooter>
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Perbarui Pembayaran'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CentralOrderFormPage;