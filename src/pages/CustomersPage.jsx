// src/pages/CustomersPage.jsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const CustomersPage = () => {
  const { session, companyId } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    phone: '', 
    address: '',
    customer_status: '',
  });

  useEffect(() => {
    fetchCustomers();
    fetchCustomerStatuses();
  }, [companyId]);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*, customer_statuses(status_name)') // Kolom diperbaiki
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching customers:', error);
      toast.error('Gagal mengambil data pelanggan.');
    } else {
      setCustomers(data);
    }
    setLoading(false);
  };
  
  const fetchCustomerStatuses = async () => {
    const { data, error } = await supabase
      .from('customer_statuses')
      .select('status_name')
      .eq('company_id', companyId);
    
    if (error) {
      console.error('Error fetching customer statuses:', error);
      toast.error('Gagal memuat status pelanggan.');
    } else {
      setCustomerStatuses(data.map(item => item.status_name));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleStatusChange = (statusName) => {
    setFormData({ ...formData, customer_status: statusName });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (!companyId) {
      toast.error('Tidak dapat menambahkan pelanggan tanpa ID perusahaan.');
      setLoading(false);
      return;
    }

    if (currentCustomer) {
      const { data, error } = await supabase
        .from('customers')
        .update(formData)
        .eq('id', currentCustomer.id)
        .select();
      if (error) {
        console.error('Error updating customer:', error);
        toast.error('Gagal memperbarui pelanggan.');
      } else {
        fetchCustomers();
        toast.success('Pelanggan berhasil diperbarui.');
        resetForm();
      }
    } else {
      const newCustomerData = { ...formData, company_id: companyId };
      const { data, error } = await supabase
        .from('customers')
        .insert([newCustomerData])
        .select();
      if (error) {
        console.error('Error adding customer:', error);
        toast.error('Gagal menambahkan pelanggan.');
      } else {
        fetchCustomers();
        toast.success('Pelanggan berhasil ditambahkan.');
        resetForm();
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '', customer_status: '' });
    setCurrentCustomer(null);
    setIsModalOpen(false);
  };

  const handleEditClick = (customer) => {
    setFormData({ 
      name: customer.name, 
      phone: customer.phone, 
      address: customer.address,
      customer_status: customer.customer_status
    });
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
        <Button onClick={() => {
          resetForm();
          setIsModalOpen(true);
        }}>+ Tambah Pelanggan</Button>
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
            <div>
              <Label>Status Pelanggan</Label>
              <Select
                name="customer_status"
                value={formData.customer_status}
                onValueChange={handleStatusChange}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Status Pelanggan" />
                </SelectTrigger>
                <SelectContent>
                  {customerStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>{customer.address}</TableCell>
                <TableCell>{customer.customer_statuses?.status_name ?? 'N/A'}</TableCell>
                <TableCell className="flex gap-2">
                  <Button variant="outline" onClick={() => handleEditClick(customer)}>Edit</Button>
                  <Button variant="destructive" onClick={() => handleDeleteClick(customer.id)}>Hapus</Button>
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
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