import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-hot-toast';
import { Loader2, ArrowLeft, Plus, Tags, ShoppingBag, Pencil } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import CategoryModal from '@/components/CategoryModal';
import SupplierModal from '@/components/SupplierModal';
import { Separator } from '@/components/ui/separator';

const EditProductPage = () => {
    const { id } = useParams();
    const { userProfile, loading: authLoading, companyId } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [customerStatuses, setCustomerStatuses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    const [productForm, setProductForm] = useState({
        name: '',
        stock: '',
        purchase_price: '',
        is_returnable: false,
        empty_bottle_price: '',
        category_id: '',
        subcategory_id: '',
        supplier_id: '',
    });

    const [productPrices, setProductPrices] = useState([]);

    useEffect(() => {
        if (!authLoading && companyId && id) {
            fetchData();
        }
    }, [authLoading, companyId, id]);

    const fetchData = async () => {
        setLoading(true);
        
        const [
            { data: productData, error: productError },
            { data: statusData, error: statusError },
            { data: categoriesData, error: categoriesError },
            { data: suppliersData, error: suppliersError },
        ] = await Promise.all([
            supabase.from('products').select('*, product_prices(*, customer_statuses(status_name))').eq('id', id).single(),
            supabase.from('customer_statuses').select('status_name').eq('company_id', companyId).order('sort_order', { ascending: true }),
            supabase.from('categories').select('*, subcategories(*)').eq('company_id', companyId),
            supabase.from('suppliers').select('*').eq('company_id', companyId),
        ]);

        if (productError || statusError || categoriesError || suppliersError) {
            console.error('Error fetching data:', productError || statusError || categoriesError || suppliersError);
            toast.error('Gagal memuat data produk.');
            setLoading(false);
            return;
        }

        setCategories(categoriesData);
        setSuppliers(suppliersData);
        setCustomerStatuses(statusData);

        setProductForm({
            name: productData.name,
            stock: productData.stock,
            purchase_price: productData.purchase_price,
            is_returnable: productData.is_returnable,
            empty_bottle_price: productData.empty_bottle_price,
            category_id: productData.category_id || '',
            subcategory_id: productData.subcategory_id || '',
            supplier_id: productData.supplier_id || '',
        });

        const pricesForProduct = statusData.map(status => {
            const existingPrice = productData.product_prices.find(p => p.customer_status === status.status_name);
            return {
                product_id: id,
                customer_status: status.status_name,
                name: status.status_name,
                price: existingPrice ? existingPrice.price : '',
            };
        });
        setProductPrices(pricesForProduct);

        const selectedCategory = categoriesData.find(cat => cat.id === productData.category_id);
        setSubCategories(selectedCategory ? selectedCategory.subcategories : []);

        setLoading(false);
    };

    const handleProductFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setProductForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };
    
    const handlePriceChange = (statusName, value) => {
        setProductPrices(prev => prev.map(p => 
            p.customer_status === statusName ? { ...p, price: value } : p
        ));
    };

    const handleCategoryChange = (value) => {
        const selectedCategory = categories.find(cat => cat.id === value);
        setProductForm(prev => ({
            ...prev,
            category_id: value,
            subcategory_id: '',
        }));
        setSubCategories(selectedCategory ? selectedCategory.subcategories : []);
    };
    
    const handleSubCategoryChange = (value) => {
        setProductForm(prev => ({ ...prev, subcategory_id: value }));
    };

    const handleSupplierChange = (value) => {
        setProductForm(prev => ({ ...prev, supplier_id: value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase
                .from('products')
                .update({
                    ...productForm,
                    stock: parseInt(productForm.stock),
                    purchase_price: parseFloat(productForm.purchase_price) || 0,
                    empty_bottle_price: productForm.is_returnable ? parseFloat(productForm.empty_bottle_price) || 0 : null,
                    category_id: productForm.category_id || null,
                    subcategory_id: productForm.subcategory_id || null,
                    supplier_id: productForm.supplier_id || null,
                })
                .eq('id', id);

            if (error) throw error;
            
            const priceUpdates = productPrices.map(p => ({
                product_id: id,
                customer_status: p.customer_status,
                price: parseFloat(p.price) || 0,
                company_id: companyId,
            }));
            
            const { error: priceError } = await supabase
                .from('product_prices')
                .upsert(priceUpdates, { onConflict: ['product_id', 'customer_status'] });
            
            if (priceError) throw priceError;
            
            toast.success('Produk berhasil diperbarui.');
            navigate('/settings');
        } catch (error) {
            console.error('Error in form submission:', error);
            toast.error('Gagal memperbarui produk: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const allPricesSet = productPrices.every(p => p.price !== '' && p.price >= 0);
    const isFormValid = productForm.name && productForm.stock !== '' && productForm.purchase_price !== '' && allPricesSet;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Pencil className="h-6 w-6" /> Edit Produk
                </h1>
                <Button onClick={() => navigate('/settings')} variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
                </Button>
            </div>

            <Card className="border-0 shadow-lg bg-white">
                <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
                    <CardTitle>Formulir Edit Produk</CardTitle>
                    <CardDescription className="text-gray-200">
                        Perbarui detail produk yang sudah ada.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
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
                                    onClick={() => setIsCategoryModalOpen(true)}
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
                                    onClick={() => setIsCategoryModalOpen(true)}
                                    disabled={!productForm.category_id}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="supplier_id">Supplier</Label>
                            <div className="flex gap-2">
                                <Select value={productForm.supplier_id} onValueChange={handleSupplierChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(supplier => (
                                            <SelectItem key={supplier.id} value={supplier.id}>
                                                {supplier.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setIsSupplierModalOpen(true)}
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
                                
                                placeholder="Harga beli dari pusat"
                                value={productForm.purchase_price}
                                onChange={handleProductFormChange}
                                required
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_returnable"
                                name="is_returnable"
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

                        <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={loading || !isFormValid}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Perbarui Produk'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
            <CategoryModal
                isOpen={isCategoryModalOpen}
                onOpenChange={setIsCategoryModalOpen}
                onCategoriesUpdated={() => {
                    fetchData();
                }}
            />
            <SupplierModal
                isOpen={isSupplierModalOpen}
                onOpenChange={setIsSupplierModalOpen}
                onSuppliersUpdated={() => {
                    fetchData();
                }}
            />
        </div>
    );
};

export default EditProductPage;