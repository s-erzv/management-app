import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const CategoryModal = ({ isOpen, onOpenChange, onCategoriesUpdated }) => {
  const { companyId } = useAuth();
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*, subcategories(*)');

    if (categoriesError) {
      toast.error('Gagal mengambil kategori.');
      console.error(categoriesError);
    } else {
      setCategories(categoriesData);
    }
    setLoading(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      return toast.error('Nama kategori tidak boleh kosong.');
    }
    setLoading(true);
    const { error } = await supabase
      .from('categories')
      .insert({ name: newCategoryName, company_id: companyId });

    if (error) {
      toast.error('Gagal menambahkan kategori.');
      console.error(error);
    } else {
      toast.success('Kategori berhasil ditambahkan!');
      setNewCategoryName('');
      fetchCategories();
      onCategoriesUpdated();
    }
    setLoading(false);
  };

  const handleDeleteCategory = async (id) => {
    setLoading(true);
    const { error } = await supabase.from('categories').delete().eq('id', id);

    if (error) {
      toast.error('Gagal menghapus kategori. Pastikan tidak ada subkategori atau produk yang terhubung.');
      console.error(error);
    } else {
      toast.success('Kategori berhasil dihapus.');
      fetchCategories();
      onCategoriesUpdated();
    }
    setLoading(false);
  };

  const handleAddSubCategory = async () => {
    if (!newSubCategoryName.trim()) {
      return toast.error('Nama subkategori tidak boleh kosong.');
    }
    if (!selectedCategory) {
      return toast.error('Pilih kategori terlebih dahulu.');
    }
    setLoading(true);
    const { error } = await supabase
      .from('subcategories')
      .insert({ name: newSubCategoryName, category_id: selectedCategory.id });

    if (error) {
      toast.error('Gagal menambahkan subkategori.');
      console.error(error);
    } else {
      toast.success('Subkategori berhasil ditambahkan!');
      setNewSubCategoryName('');
      fetchCategories();
      onCategoriesUpdated();
    }
    setLoading(false);
  };

  const handleDeleteSubCategory = async (id) => {
    setLoading(true);
    const { error } = await supabase.from('subcategories').delete().eq('id', id);

    if (error) {
      toast.error('Gagal menghapus subkategori. Pastikan tidak ada produk yang terhubung.');
      console.error(error);
    } else {
      toast.success('Subkategori berhasil dihapus.');
      fetchCategories();
      onCategoriesUpdated();
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Kelola Kategori & Subkategori Produk</DialogTitle>
          <DialogDescription>
            Tambahkan, edit, atau hapus kategori dan subkategori untuk produk Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category-name" className="text-right">
              Kategori Baru
            </Label>
            <Input
              id="category-name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="col-span-3"
              placeholder="Contoh: Makanan, Minuman, Pakaian"
            />
          </div>
          <Button onClick={handleAddCategory} className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambah Kategori'}
          </Button>

          <div className="mt-4">
            <h4 className="font-semibold">Daftar Kategori</h4>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Kategori</TableHead>
                      <TableHead>Jumlah Subkategori</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow
                        key={category.id}
                        className={`cursor-pointer ${selectedCategory?.id === category.id ? 'bg-gray-100' : ''}`}
                        onClick={() => setSelectedCategory(category)}
                      >
                        <TableCell>{category.name}</TableCell>
                        <TableCell>{category.subcategories.length}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteCategory(category.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {selectedCategory && (
            <div className="mt-4 p-4 border rounded-md">
              <h4 className="font-semibold">Subkategori untuk: {selectedCategory.name}</h4>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newSubCategoryName}
                  onChange={(e) => setNewSubCategoryName(e.target.value)}
                  placeholder="Nama subkategori baru"
                />
                <Button onClick={handleAddSubCategory} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambah'}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Subkategori</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCategory.subcategories.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>{sub.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteSubCategory(sub.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryModal;