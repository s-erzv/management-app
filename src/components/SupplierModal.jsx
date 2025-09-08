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
import { Loader2, Trash2, Pencil } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SupplierModal = ({ isOpen, onOpenChange, onSuppliersUpdated }) => {
  const { companyId } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [newSupplierForm, setNewSupplierForm] = useState({ name: '', phone: '', location: '' });
  const [loading, setLoading] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen]);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (error) {
      toast.error('Gagal mengambil data supplier.');
      console.error(error);
    } else {
      setSuppliers(data);
    }
    setLoading(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setNewSupplierForm({ ...newSupplierForm, [name]: value });
  };

  const handleAddOrUpdateSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierForm.name.trim()) {
      return toast.error('Nama supplier tidak boleh kosong.');
    }
    setLoading(true);

    try {
      if (currentSupplier) {
        // Update
        const { error } = await supabase
          .from('suppliers')
          .update(newSupplierForm)
          .eq('id', currentSupplier.id);
        if (error) throw error;
        toast.success('Supplier berhasil diperbarui!');
      } else {
        // Add
        const { error } = await supabase
          .from('suppliers')
          .insert({ ...newSupplierForm, company_id: companyId });
        if (error) throw error;
        toast.success('Supplier berhasil ditambahkan!');
      }

      setNewSupplierForm({ name: '', phone: '', location: '' });
      setCurrentSupplier(null);
      fetchSuppliers();
      onSuppliersUpdated();
    } catch (error) {
      toast.error('Gagal menyimpan data supplier.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus supplier ini?')) return;
    setLoading(true);
    const { error } = await supabase.from('suppliers').delete().eq('id', id);

    if (error) {
      toast.error('Gagal menghapus supplier. Pastikan tidak ada produk yang terhubung.');
      console.error(error);
    } else {
      toast.success('Supplier berhasil dihapus.');
      fetchSuppliers();
      onSuppliersUpdated();
    }
    setLoading(false);
  };
  
  const handleEditClick = (supplier) => {
      setCurrentSupplier(supplier);
      setNewSupplierForm({ name: supplier.name, phone: supplier.phone, location: supplier.location });
  };
  
  const handleCloseModal = () => {
      onOpenChange(false);
      setCurrentSupplier(null);
      setNewSupplierForm({ name: '', phone: '', location: '' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="sm:max-w-[425px] md:max-w-xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Kelola Supplier</DialogTitle>
          <DialogDescription>
            Tambah, edit, atau hapus supplier untuk produk Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <form onSubmit={handleAddOrUpdateSupplier} className="space-y-4">
            <div>
              <Label htmlFor="name">Nama Supplier</Label>
              <Input
                id="name"
                name="name"
                value={newSupplierForm.name}
                onChange={handleFormChange}
                placeholder="Nama Supplier"
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Nomor Telepon</Label>
              <Input
                id="phone"
                name="phone"
                value={newSupplierForm.phone}
                onChange={handleFormChange}
                placeholder="Nomor telepon"
              />
            </div>
            <div>
              <Label htmlFor="location">Alamat</Label>
              <Input
                id="location"
                name="location"
                value={newSupplierForm.location}
                onChange={handleFormChange}
                placeholder="Alamat Lengkap"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : currentSupplier ? 'Perbarui Supplier' : 'Tambah Supplier'}
              </Button>
            </DialogFooter>
          </form>

          <div className="mt-4">
            <h4 className="font-semibold">Daftar Supplier</h4>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Telepon</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell>{supplier.name}</TableCell>
                        <TableCell>{supplier.phone || '-'}</TableCell>
                        <TableCell>{supplier.location || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(supplier)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteSupplier(supplier.id)}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierModal;