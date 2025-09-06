// src/components/ProductSettings.jsx

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { Loader2, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const ProductSettings = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const [products, setProducts] = useState([]);
  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    stock: '',
    is_returnable: false,
  });

  const [productPrices, setProductPrices] = useState([]);

  useEffect(() => {
    if (!authLoading && userProfile?.company_id) {
      fetchData();
    }
  }, [authLoading, userProfile]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*, product_prices(*)')
      .eq('company_id', userProfile.company_id)
      .order('name', { ascending: true });

    const { data: statusData, error: statusError } = await supabase
      .from('customer_statuses')
      .select('status_name')
      .eq('company_id', userProfile.company_id)
      .order('status_name', { ascending: true });

    if (productsError || statusError) {
      console.error('Error fetching data:', productsError || statusError);
      toast.error('Gagal memuat data produk dan status.');
    } else {
      setProducts(productsData);
      setCustomerStatuses(statusData);
    }
    setLoading(false);
  };

  const handleNewProductFormChange = (e) => {
    const { name, value } = e.target;
    setNewProductForm({ ...newProductForm, [name]: value });
  };
  
  const handlePriceChange = (statusName, value) => {
    setProductPrices(prev => prev.map(p => 
      p.customer_status === statusName ? { ...p, price: value } : p
    ));
  };

  const handleEdit = (product) => {
    setCurrentProduct(product);
    const pricesForProduct = customerStatuses.map(status => {
      const existingPrice = product.product_prices.find(p => p.customer_status === status.status_name);
      return {
        customer_status: status.status_name,
        name: status.status_name,
        price: existingPrice ? existingPrice.price : '',
      };
    });
    setProductPrices(pricesForProduct);
    setIsModalOpen(true);
  };
  
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const isEditing = !!currentProduct;
    let productId = currentProduct?.id;

    try {
      if (!isEditing) {
        const { data, error } = await supabase
          .from('products')
          .insert({ 
            name: newProductForm.name,
            stock: parseInt(newProductForm.stock),
            is_returnable: newProductForm.is_returnable,
            company_id: userProfile.company_id,
          })
          .select('id')
          .single();
        if (error) throw error;
        productId = data.id;
      } else {
        const { error } = await supabase
          .from('products')
          .update({
            name: currentProduct.name,
            stock: parseInt(currentProduct.stock),
            is_returnable: currentProduct.is_returnable
          })
          .eq('id', productId);
        if (error) throw error;
      }
      
      const priceUpdates = productPrices.map(p => ({
        product_id: productId,
        customer_status: p.customer_status,
        price: parseFloat(p.price) || 0,
        company_id: userProfile.company_id,
      }));
      
      const { error: priceError } = await supabase
        .from('product_prices')
        .upsert(priceUpdates, { onConflict: ['product_id', 'customer_status'] });
        
      if (priceError) throw priceError;
      
      toast.success(`Produk berhasil di${isEditing ? 'perbarui' : 'tambahkan'}.`);
      fetchData();
      resetForm();

    } catch (error) {
      console.error('Error in form submission:', error);
      toast.error(`Gagal ${isEditing ? 'memperbarui' : 'menambahkan'} produk: ` + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini? Semua data terkait akan terhapus.')) {
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) {
        throw new Error(error.message);
      }
      
      toast.success('Produk berhasil dihapus!');
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Gagal menghapus produk: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setCurrentProduct(null);
    setNewProductForm({ name: '', stock: '', is_returnable: false });
    setProductPrices([]);
    setIsModalOpen(false);
  };
  
  const allPricesSet = productPrices.every(p => p.price && p.price > 0);
  const isFormValid = newProductForm.name && newProductForm.stock && allPricesSet;
  const isEditFormValid = currentProduct?.name && currentProduct?.stock && allPricesSet;
  const canSubmit = currentProduct ? isEditFormValid : isFormValid;


  return (
    <Card className="border-0 shadow-lg bg-white">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#10182b] text-white rounded-t-lg">
        <CardTitle>Manajemen Produk</CardTitle>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-white text-[#10182b] hover:bg-gray-200"
              onClick={() => {
                resetForm();
                const initialPrices = customerStatuses.map(status => ({
                  customer_status: status.status_name,
                  name: status.status_name,
                  price: ''
                }));
                setProductPrices(initialPrices);
                setIsModalOpen(true);
              }}>
              <PlusCircle className="h-4 w-4 mr-2" /> Tambah Produk
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{currentProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
              <DialogDescription>
                {currentProduct ? 'Perbarui detail produk.' : 'Isi formulir untuk menambahkan produk baru.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Produk</Label>
                <Input
                  id="name"
                  name="name"
                  value={currentProduct ? currentProduct.name : newProductForm.name}
                  onChange={(e) => {
                    const { name, value } = e.target;
                    currentProduct ? setCurrentProduct({ ...currentProduct, [name]: value }) : setNewProductForm({ ...newProductForm, [name]: value });
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stok Awal</Label>
                <Input
                  id="stock"
                  name="stock"
                  type="number"
                  value={currentProduct ? currentProduct.stock : newProductForm.stock}
                  onChange={(e) => {
                    const { name, value } = e.target;
                    currentProduct ? setCurrentProduct({ ...currentProduct, [name]: value }) : setNewProductForm({ ...newProductForm, [name]: value });
                  }}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_returnable"
                  checked={currentProduct ? currentProduct.is_returnable : newProductForm.is_returnable}
                  onCheckedChange={(checked) => {
                    const target = currentProduct ? setCurrentProduct : setNewProductForm;
                    target(prev => ({ ...prev, is_returnable: checked }));
                  }}
                />
                <Label htmlFor="is_returnable">Produk ini dapat dikembalikan (misal: galon)</Label>
              </div>
              
              <div className="space-y-2">
                <Label className="font-medium">Harga per Status Pelanggan</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                {productPrices.map(p => (
                  <div key={p.customer_status} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <Label className="w-full sm:w-1/3">{p.name}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Harga"
                      value={p.price}
                      onChange={(e) => handlePriceChange(p.customer_status, e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                ))}
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={loading || !canSubmit}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (currentProduct ? 'Perbarui Produk' : 'Tambah Produk')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-gray-500">Tidak ada produk yang tersedia.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Nama Produk</TableHead>
                  <TableHead className="min-w-[100px]">Stok</TableHead>
                  <TableHead className="min-w-[150px]">Dapat Dikembalikan</TableHead>
                  <TableHead className="min-w-[120px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.stock}</TableCell>
                    <TableCell>{product.is_returnable ? 'Ya' : 'Tidak'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductSettings;