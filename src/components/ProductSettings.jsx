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
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock: '',
    is_returnable: false,
  });

  useEffect(() => {
    if (!authLoading && userProfile?.company_id) {
      fetchProducts();
    }
  }, [authLoading, userProfile]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal memuat daftar produk.');
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setNewProduct({ ...newProduct, [name]: value });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setCurrentProduct({ ...currentProduct, [name]: value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const isEditing = !!currentProduct;
    setLoading(true);

    const productData = {
      name: isEditing ? currentProduct.name : newProduct.name,
      price: parseFloat(isEditing ? currentProduct.price : newProduct.price),
      stock: parseInt(isEditing ? currentProduct.stock : newProduct.stock),
      is_returnable: isEditing ? currentProduct.is_returnable : newProduct.is_returnable,
      company_id: userProfile.company_id,
    };

    if (isEditing) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', currentProduct.id);

      if (error) {
        console.error('Error updating product:', error);
        toast.error('Gagal memperbarui produk.');
      } else {
        toast.success('Produk berhasil diperbarui.');
        fetchProducts();
        setIsModalOpen(false);
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert(productData);

      if (error) {
        console.error('Error adding product:', error);
        toast.error('Gagal menambahkan produk.');
      } else {
        toast.success('Produk berhasil ditambahkan.');
        fetchProducts();
        setIsModalOpen(false);
        setNewProduct({ name: '', price: '', stock: '', is_returnable: false });
      }
    }
    setLoading(false);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini? Semua data terkait di pesanan akan terhapus.')) {
      return;
    }
    
    setLoading(true);

    try {
      // Langkah 1: Hapus semua item pesanan yang merujuk pada produk ini
      const { error: deleteItemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('product_id', productId);

      if (deleteItemsError) {
        throw new Error(deleteItemsError.message);
      }

      // Langkah 2: Hapus produk itu sendiri
      const { error: deleteProductError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (deleteProductError) {
        throw new Error(deleteProductError.message);
      }
      
      toast.success('Produk berhasil dihapus!');
      fetchProducts(); // Refresh daftar produk
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Gagal menghapus produk: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product) => {
    setCurrentProduct(product);
    setIsModalOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manajemen Produk</CardTitle>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setCurrentProduct(null);
              setIsModalOpen(true);
            }}>
              <PlusCircle className="h-4 w-4 mr-2" /> Tambah Produk
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{currentProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
              <DialogDescription>
                {currentProduct ? 'Perbarui detail produk.' : 'Isi formulir untuk menambahkan produk baru.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nama Produk</Label>
                <Input
                  id="name"
                  name="name"
                  value={currentProduct ? currentProduct.name : newProduct.name}
                  onChange={currentProduct ? handleEditChange : handleFormChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="price">Harga</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  value={currentProduct ? currentProduct.price : newProduct.price}
                  onChange={currentProduct ? handleEditChange : handleFormChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="stock">Stok Awal</Label>
                <Input
                  id="stock"
                  name="stock"
                  type="number"
                  value={currentProduct ? currentProduct.stock : newProduct.stock}
                  onChange={currentProduct ? handleEditChange : handleFormChange}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_returnable"
                  checked={currentProduct ? currentProduct.is_returnable : newProduct.is_returnable}
                  onCheckedChange={(checked) => {
                    const target = currentProduct ? setCurrentProduct : setNewProduct;
                    target(prev => ({ ...prev, is_returnable: checked }));
                  }}
                />
                <Label htmlFor="is_returnable">Produk ini dapat dikembalikan (misal: galon)</Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
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
                  <TableHead>Nama Produk</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead>Dapat Dikembalikan</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{`Rp ${product.price.toLocaleString('id-ID')}`}</TableCell>
                    <TableCell>{product.stock}</TableCell>
                    <TableCell>{product.is_returnable ? 'Ya' : 'Tidak'}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
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