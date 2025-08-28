import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const CustomersPage = () => {
  const { session } = useAuth(); // Asumsikan session sudah membawa role
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null); // Untuk data yang akan diedit
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('customers').select('*');
    if (error) {
      console.error('Error fetching customers:', error);
      toast.error('Gagal mengambil data pelanggan.');
    } else {
      setCustomers(data);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (currentCustomer) {
      // Logika untuk memperbarui pelanggan
      const { data, error } = await supabase
        .from('customers')
        .update(formData)
        .eq('id', currentCustomer.id)
        .select();
      if (error) {
        console.error('Error updating customer:', error);
        toast.error('Gagal memperbarui pelanggan.');
      } else {
        setCustomers(customers.map(c => (c.id === currentCustomer.id ? data[0] : c)));
        toast.success('Pelanggan berhasil diperbarui.');
        resetForm();
      }
    } else {
      // Logika untuk menambah pelanggan baru
      const { data, error } = await supabase
        .from('customers')
        .insert([formData])
        .select();
      if (error) {
        console.error('Error adding customer:', error);
        toast.error('Gagal menambahkan pelanggan.');
      } else {
        setCustomers([...customers, ...data]);
        toast.success('Pelanggan berhasil ditambahkan.');
        resetForm();
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '' });
    setCurrentCustomer(null);
    setIsModalOpen(false);
  };

  const handleEditClick = (customer) => {
    setFormData({ name: customer.name, phone: customer.phone, address: customer.address });
    setCurrentCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (customerId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pelanggan ini?')) return;
    setLoading(true);
    const { error } = await supabase.from('customers').delete().eq('id', customerId);
    if (error) {
      console.error('Error deleting customer:', error);
      toast.error('Gagal menghapus pelanggan.');
    } else {
      setCustomers(customers.filter(c => c.id !== customerId));
      toast.success('Pelanggan berhasil dihapus.');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manajemen Pelanggan</h1>
        <Button onClick={() => setIsModalOpen(true)}>+ Tambah Pelanggan</Button>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</DialogTitle>
            <DialogDescription>
              {currentCustomer ? 'Perbarui informasi pelanggan.' : 'Isi formulir untuk menambahkan pelanggan baru.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <Input
              name="name"
              placeholder="Nama Pelanggan"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
            <Input
              name="phone"
              placeholder="Nomor Telepon"
              value={formData.phone}
              onChange={handleInputChange}
              required
            />
            <Input
              name="address"
              placeholder="Alamat Lengkap"
              value={formData.address}
              onChange={handleInputChange}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : currentCustomer ? 'Perbarui Pelanggan' : 'Tambah Pelanggan'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>{customer.address}</TableCell>
                <TableCell className="flex gap-2">
                  <Button variant="outline" onClick={() => handleEditClick(customer)}>Edit</Button>
                  <Button variant="destructive" onClick={() => handleDeleteClick(customer.id)}>Hapus</Button>
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Tidak ada data pelanggan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CustomersPage;