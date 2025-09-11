// src/components/ProductSettings.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { Loader2, PlusCircle, Pencil, Trash2, ArrowUp, ArrowDown, Tags, Package, ShoppingBag } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import CategoryModal from './CategoryModal';
import SupplierModal from './SupplierModal';

const ProductSettings = () => {
  const { userProfile, loading: authLoading, companyId } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  
  useEffect(() => {
    if (!authLoading && userProfile?.company_id) {
      fetchData();
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
        subcategory:subcategory_id(id, name),
        supplier:supplier_id(id, name)
      `)
      .eq('company_id', userProfile.company_id)
      .order('sort_order', { ascending: true });

    if (productsError) {
      console.error('Error fetching data:', productsError);
      toast.error('Gagal memuat data produk.');
    } else {
      setProducts(productsData);
    }
    setLoading(false);
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
  
  const fetchSuppliersForModal = async () => {
    if (!companyId) return [];
    // Re-fetch data to ensure modal is updated
    await fetchData();
  };

  const fetchCategoriesForModal = async () => {
    if (!companyId) return [];
    // Re-fetch data to ensure modal is updated
    await fetchData();
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
            <Button
                className="bg-white text-[#10182b] hover:bg-gray-200"
                onClick={() => setIsSupplierModalOpen(true)}
                type="button"
            >
                <ShoppingBag className="h-4 w-4 mr-2" /> Kelola Supplier
            </Button>
            <Button
              className="bg-white text-[#10182b] hover:bg-gray-200"
              onClick={() => navigate('/products/add')}
            >
              <PlusCircle className="h-4 w-4 mr-2" /> Tambah Produk
            </Button>
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
                  <TableHead className="min-w-[150px]">Supplier</TableHead>
                  <TableHead className="min-w-[100px]">Stok</TableHead>
                  <TableHead className="min-w-[150px]">Harga Beli</TableHead>
                  <TableHead className="min-w-[150px]">Harga Product Returnable Kosong</TableHead>
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
                    <TableCell>{product.supplier?.name || '-'}</TableCell>
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
                          onClick={() => navigate(`/products/edit/${product.id}`)}
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
        onOpenChange={setIsCategoryModalOpen}
        onCategoriesUpdated={() => {
            fetchCategoriesForModal();
        }}
      />
       <SupplierModal
        isOpen={isSupplierModalOpen}
        onOpenChange={setIsSupplierModalOpen}
        onSuppliersUpdated={() => {
            fetchSuppliersForModal();
        }}
      />
    </Card>
  );
};

export default ProductSettings;