import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const ProductSettings = () => {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '' });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal mengambil data produk.');
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (currentProduct) {
      setCurrentProduct({ ...currentProduct, [name]: value });
    } else {
      setNewProduct({ ...newProduct, [name]: value });
    }
  };

  const handleOpenModal = (product = null) => {
    setCurrentProduct(product);
    setNewProduct(product ? { name: product.name, price: product.price, stock: product.stock } : { name: '', price: '', stock: '' });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (currentProduct) {
      // Logic untuk UPDATE produk
      const { data, error } = await supabase
        .from('products')
        .update({ name: currentProduct.name, price: currentProduct.price, stock: currentProduct.stock })
        .eq('id', currentProduct.id)
        .select();

      if (error) {
        console.error('Error updating product:', error);
        toast.error('Gagal memperbarui produk.');
      } else {
        toast.success('Produk berhasil diperbarui.');
        setProducts(products.map(p => (p.id === currentProduct.id ? data[0] : p)));
        setIsModalOpen(false);
      }
    } else {
      // Logic untuk CREATE produk baru
      const { data, error } = await supabase
        .from('products')
        .insert([{ ...newProduct, stock: parseInt(newProduct.stock) || 0 }])
        .select();

      if (error) {
        console.error('Error adding product:', error);
        toast.error('Gagal menambah produk.');
      } else {
        toast.success('Produk berhasil ditambahkan.');
        setProducts([...products, ...data]);
        setIsModalOpen(false);
      }
    }
    setLoading(false);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    setLoading(true);
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);
    
    if (error) {
      console.error('Error deleting product:', error);
      toast.error('Gagal menghapus produk.');
    } else {
      toast.success('Produk berhasil dihapus.');
      setProducts(products.filter(p => p.id !== productId));
    }
    setLoading(false);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Manajemen Produk</h2>
        <Button onClick={() => handleOpenModal()}>+ Tambah Produk</Button>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Harga</TableHead>
              <TableHead>Stok</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-500" />
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>Rp{product.price}</TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(product)}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteProduct(product.id)}>Hapus</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
            {!loading && products.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Tidak ada data produk.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
            <DialogDescription>
              {currentProduct ? 'Perbarui informasi produk.' : 'Isi formulir untuk menambahkan produk baru.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <Input
              type="text"
              name="name"
              placeholder="Nama Produk (misal: Galon Isi)"
              value={currentProduct ? currentProduct.name : newProduct.name}
              onChange={handleInputChange}
              required
            />
            <Input
              type="number"
              name="price"
              placeholder="Harga (Rp)"
              value={currentProduct ? currentProduct.price : newProduct.price}
              onChange={handleInputChange}
              required
              step="0.01"
            />
            <Input
              type="number"
              name="stock"
              placeholder="Jumlah Stok"
              value={currentProduct ? currentProduct.stock : newProduct.stock}
              onChange={handleInputChange}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (currentProduct ? 'Perbarui Produk' : 'Tambah Produk')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductSettings;