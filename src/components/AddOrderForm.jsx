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
import { Loader2, PlusCircle, Pencil, Trash2, ArrowUp, ArrowDown, Plus, Tag, Tags } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import CategoryModal from './CategoryModal';

const ProductSettings = () => {
  const { userProfile, loading: authLoading, companyId } = useAuth();
  const [products, setProducts] = useState([]);
  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  
  const [productForm, setProductForm] = useState({
    name: '',
    stock: '',
    purchase_price: '',
    is_returnable: false,
    empty_bottle_price: '',
    category_id: '',
    subcategory_id: '',
  });

  const [productPrices, setProductPrices] = useState([]);

  useEffect(() => {
    if (!authLoading && userProfile?.company_id) {
      fetchData();
      fetchCategories();
    }
  }, [authLoading, userProfile]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select(`
        *,
        product_prices(*),
        category:category_id(id, name),
        subcategory:subcategory_id(id, name)
      `)
      .eq('company_id', userProfile.company_id)
      .order('sort_order', { ascending: true });

    const { data: statusData, error: statusError } = await supabase
      .from('customer_statuses')
      .select('status_name')
      .eq('company_id', userProfile.company_id)
      .order('sort_order', { ascending: true });

    if (productsError || statusError) {
      console.error('Error fetching data:', productsError || statusError);
      toast.error('Gagal memuat data produk dan status.');
    } else {
      setProducts(productsData);
      setCustomerStatuses(statusData);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('categories')
      .select('*, subcategories(*)');
    if (error) {
      toast.error('Gagal mengambil kategori.');
      console.error(error);
    } else {
      setCategories(data);
    }
  };

  const handleProductFormChange = (e) => {
    const { name, value } = e.target;
    setProductForm({ ...productForm, [name]: value });
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

    // Set form state for editing
    setProductForm({
        name: product.name,
        stock: product.stock,
        purchase_price: product.purchase_price,
        is_returnable: product.is_returnable,
        empty_bottle_price: product.empty_bottle_price,
        category_id: product.category_id || '',
        subcategory_id: product.subcategory_id || '',
    });
    
    // Set subcategories for the selected category
    const selectedCategory = categories.find(cat => cat.id === product.category_id);
    setSubCategories(selectedCategory ? selectedCategory.subcategories : []);

    setIsModalOpen(true);
  };
  
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const isEditing = !!currentProduct;
    let productId = currentProduct?.id;

    try {
      if (!isEditing) {
        const { data: maxSortOrderData } = await supabase
          .from('products')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1)
          .single();
        const maxSortOrder = maxSortOrderData?.sort_order || 0;

        const { data, error } = await supabase
          .from('products')
          .insert({ 
            name: productForm.name,
            stock: parseInt(productForm.stock),
            purchase_price: parseFloat(productForm.purchase_price) || 0,
            is_returnable: productForm.is_returnable,
            empty_bottle_price: productForm.is_returnable ? parseFloat(productForm.empty_bottle_price) || 0 : null,
            category_id: productForm.category_id || null,
            subcategory_id: productForm.subcategory_id || null,
            company_id: userProfile.company_id,
            sort_order: maxSortOrder + 1,
          })
          .select('id')
          .single();
        if (error) throw error;
        productId = data.id;
      } else {
        const { error } = await supabase
          .from('products')
          .update({
            name: productForm.name,
            stock: parseInt(productForm.stock),
            purchase_price: parseFloat(productForm.purchase_price) || 0,
            is_returnable: productForm.is_returnable,
            empty_bottle_price: productForm.is_returnable ? parseFloat(productForm.empty_bottle_price) || 0 : null,
            category_id: productForm.category_id || null,
            subcategory_id: productForm.subcategory_id || null,
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
  
  const handleReorder = async (index, direction) => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === products.length - 1)) {
        return;
    }

    setLoading(true);
    const currentItem = products[index];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const neighborItem = products[newIndex];
    
    const newSortOrder = neighborItem.sort_order;
    const neighborSortOrder = currentItem.sort_order;

    try {
        await supabase
            .from('products')
            .update({ sort_order: newSortOrder })
            .eq('id', currentItem.id);

        await supabase
            .from('products')
            .update({ sort_order: neighborSortOrder })
            .eq('id', neighborItem.id);
        
        toast.success('Urutan berhasil diubah!');
        fetchData();
    } catch (error) {
        console.error('Error reordering:', error);
        toast.error('Gagal mengubah urutan.');
    } finally {
        setLoading(false);
    }
};
  
  const resetForm = () => {
    setCurrentProduct(null);
    setProductForm({ 
        name: '', 
        stock: '', 
        purchase_price: '', 
        is_returnable: false, 
        empty_bottle_price: '',
        category_id: '',
        subcategory_id: '',
    });
    setSubCategories([]);
    setProductPrices([]);
    setIsModalOpen(false);
  };
  
  const allPricesSet = productPrices.every(p => p.price !== '' && p.price >= 0);
  const isFormValid =
    productForm.name &&
    productForm.stock &&
    productForm.purchase_price !== '' &&
    allPricesSet;

  const isEditFormValid =
    productForm.name &&
    productForm.stock &&
    productForm.purchase_price !== '' &&
    allPricesSet;

  const canSubmit = currentProduct ? isEditFormValid : isFormValid;

  const handleCategoryChange = (value) => {
    const selectedCategory = categories.find(cat => cat.id === value);
    setProductForm({
        ...productForm,
        category_id: value,
        subcategory_id: '',
    });
    setSubCategories(selectedCategory ? selectedCategory.subcategories : []);
  };
  
  const handleSubCategoryChange = (value) => {
      setProductForm({ ...productForm, subcategory_id: value });
  };


  return (
    <Card className="border-0 shadow-lg bg-white">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#10182b] text-white rounded-t-lg">
        <CardTitle>Manajemen Produk</CardTitle>
        <div className="flex gap-2 flex-wrap">
            <Button
                className="bg-white text-[#10182b] hover:bg-gray-200"
                onClick={() => setIsCategoryModalOpen(true)}
                type="button"
            >
                <Tags className="h-4 w-4 mr-2" /> Kelola Kategori
            </Button>
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
                    value={productForm.name}
                    onChange={handleProductFormChange}
                    required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="category_id">Kategori</Label>
                    <div className="flex gap-2">
                      <Select value={productForm.category_id} onValueChange={handleCategoryChange}>
                          <SelectTrigger>
                              <SelectValue placeholder="Pilih Kategori" />
                          </SelectTrigger>
                          <SelectContent>
                              {categories.map(category => (
                                  <SelectItem key={category.id} value={category.id}>
                                      {category.name}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                            setIsModalOpen(false);
                            setIsCategoryModalOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="subcategory_id">Subkategori</Label>
                    <div className="flex gap-2">
                        <Select
                            value={productForm.subcategory_id}
                            onValueChange={handleSubCategoryChange}
                            disabled={!productForm.category_id}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Subkategori" />
                            </SelectTrigger>
                            <SelectContent>
                                {subCategories.map(sub => (
                                    <SelectItem key={sub.id} value={sub.id}>
                                        {sub.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                                setIsModalOpen(false);
                                setIsCategoryModalOpen(true);
                            }}
                            disabled={!productForm.category_id}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="stock">Stok Awal</Label>
                    <Input
                    id="stock"
                    name="stock"
                    type="number"
                    value={productForm.stock}
                    onChange={handleProductFormChange}
                    required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="purchase_price">Harga Beli dari Pusat</Label>
                    <Input
                    id="purchase_price"
                    name="purchase_price"
                    type="number"
                    step="0.01"
                    placeholder="Harga beli dari pusat"
                    value={productForm.purchase_price}
                    onChange={handleProductFormChange}
                    required
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox
                    id="is_returnable"
                    checked={productForm.is_returnable}
                    onCheckedChange={(checked) => setProductForm(prev => ({ ...prev, is_returnable: checked }))}
                    />
                    <Label htmlFor="is_returnable">Produk ini dapat dikembalikan (misal: galon)</Label>
                </div>

                {productForm.is_returnable && (
                    <div className="space-y-2">
                    <Label htmlFor="empty_bottle_price">Harga Galon Kosong</Label>
                    <Input
                        id="empty_bottle_price"
                        name="empty_bottle_price"
                        type="number"
                        step="0.01"
                        placeholder="Harga jual galon kosong"
                        value={productForm.empty_bottle_price}
                        onChange={handleProductFormChange}
                        required
                    />
                    </div>
                )}
                
                <div className="space-y-2">
                    <Label className="font-medium">Harga per Status Pelanggan</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                    {productPrices.map(p => (
                    <div key={p.customer_status} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <Label className="w-full sm:w-1/3">{p.name}</Label>
                        <Input
                        type="number"
                        step="0.1"
                        placeholder="0"
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
        </div>
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
                  <TableHead className="min-w-[150px]">Kategori</TableHead>
                  <TableHead className="min-w-[150px]">Subkategori</TableHead>
                  <TableHead className="min-w-[100px]">Stok</TableHead>
                  <TableHead className="min-w-[150px]">Harga Beli</TableHead>
                  <TableHead className="min-w-[150px]">Harga Galon Kosong</TableHead>
                  <TableHead className="min-w-[150px]">Dapat Dikembalikan</TableHead>
                  <TableHead className="min-w-[120px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product, index) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.category?.name || '-'}</TableCell>
                    <TableCell>{product.subcategory?.name || '-'}</TableCell>
                    <TableCell>{product.stock}</TableCell>
                    <TableCell>Rp{product.purchase_price ? parseFloat(product.purchase_price).toLocaleString('id-ID') : '-'}</TableCell>
                    <TableCell>Rp{product.empty_bottle_price ? parseFloat(product.empty_bottle_price).toLocaleString('id-ID') : '-'}</TableCell>
                    <TableCell>{product.is_returnable ? 'Ya' : 'Tidak'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReorder(index, 'up')}
                            disabled={index === 0}
                        >
                            <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReorder(index, 'down')}
                            disabled={index === products.length - 1}
                        >
                            <ArrowDown className="h-4 w-4" />
                        </Button>
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
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onOpenChange={(isOpen) => {
          setIsCategoryModalOpen(isOpen);
          if (!isOpen && isModalOpen) {
            fetchCategories();  
            setIsModalOpen(true);
          }
        }}
        onCategoriesUpdated={fetchCategories}
      />
    </Card>
  );
};

export default ProductSettings;