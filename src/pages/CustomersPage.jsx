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
import { Loader2, Plus, Users, MessageSquareText, Search, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const CustomersPage = () => {
  const { session, companyId, companyName } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState({ 
    name: '', 
    phone: '', 
    address: '',
    customer_status: '',
  });

  useEffect(() => {
    if (companyId) {
      fetchCustomers();
      fetchCustomerStatuses();
    }
  }, [companyId]);

  const fetchCustomers = async () => {
    setLoading(true);
    if (!companyId) return;

    const { data, error } = await supabase
      .from('customers')
      .select('*, customer_statuses(status_name)')
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

  const filteredCustomers = customers.filter((customer) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        customer.name?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query) ||
        customer.address?.toLowerCase().includes(query) ||
        customer.customer_statuses?.status_name?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || customer.customer_statuses?.status_name === statusFilter;

      return matchesSearch && matchesStatus;
    });


  
  const fetchCustomerStatuses = async () => {
    if (!companyId) return;

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
  
  const handleContactCustomer = (customerName, customerPhone) => {
    const phone = (customerPhone || '').replace(/[^\d]/g, '');
    const message = `Assalamualaikum Warahmatullahi Wabarakatuh, Yth. Bapak/Ibu Pelanggan Setia ${companyName}

Semoga Bapak/Ibu senantiasa dalam lindungan Allah Ta’ala, diberi kesehatan, kelancaran rezeki, dan keberkahan dalam segala aktivitasnya.

Kami mohon izin mengingatkan, barangkali persediaan Air Minum Dalam Kemasan di rumah/kantor sudah mulai menipis. InsyaaAllah, dengan senang hati kami siap membantu proses pemesanan ulang apabila diperlukan.

Terima kasih atas kepercayaan Bapak/Ibu selama ini kepada ${companyName}. Semoga Allah Ta’ala membalas dengan kebaikan yang berlipat ganda.

Jazaakumullahu khayran wa baarakallahu fiikum.`;

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#10182b]" />
      </div>
    );
  }

  return (
    // Mengurangi padding untuk mobile (p-4)
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        {/* Mengurangi ukuran font judul untuk mobile */}
        <h1 className="text-2xl font-bold text-[#10182b] flex items-center gap-2">
          <Users className="h-6 w-6 md:h-8 md:w-8" />
          Manajemen Pelanggan
        </h1>
        <Button onClick={() => {
          resetForm();
          setIsModalOpen(true);
        }} className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#20283b] text-sm">
          <Plus className="h-4 w-4 mr-2" /> Tambah Pelanggan
        </Button>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</DialogTitle>
            <DialogDescription>
              {currentCustomer ? 'Perbarui informasi pelanggan.' : 'Isi formulir untuk menambahkan pelanggan baru.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Pelanggan</Label>
              <Input
                id="name"
                name="name"
                placeholder="Nama Pelanggan"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Nomor Telepon</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="Nomor Telepon"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Alamat Lengkap</Label>
              <Input
                id="address"
                name="address"
                placeholder="Alamat Lengkap"
                value={formData.address}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_status">Status Pelanggan</Label>
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
            <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#20283b]" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : currentCustomer ? 'Perbarui Pelanggan' : 'Tambah Pelanggan'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg font-semibold text-[#10182b]">
            Daftar Pelanggan
          </CardTitle>
        </CardHeader>
        
        {/* Kontrol Pencarian dan Filter yang Responsif */}
        <div className="flex flex-col sm:flex-row gap-2 px-4 md:px-6 mb-4 items-center">
          {/* Search - Full width di mobile */}
          <div className="flex items-center gap-2 w-full">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Cari nama, telepon, alamat, atau status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm"
            />
          </div>

          {/* Filter Status - Full width di mobile */}
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
            <SelectTrigger className="w-full sm:w-[200px] text-sm">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {customerStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CardContent className="p-0">
          <div className="rounded-md border-t overflow-x-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="text-xs md:text-sm">
                  <TableHead className="min-w-[120px] text-[#10182b]">Nama</TableHead>
                  <TableHead className="min-w-[100px] text-[#10182b]">Telepon</TableHead>
                  <TableHead className="min-w-[150px] text-[#10182b]">Alamat</TableHead>
                  <TableHead className="min-w-[100px] text-[#10182b]">Status</TableHead>
                  <TableHead className="min-w-[200px] text-[#10182b]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="text-xs md:text-sm">
                    <TableCell className="font-medium text-[#10182b] whitespace-nowrap">{customer.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{customer.phone}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{customer.address}</TableCell>
                    <TableCell className="whitespace-nowrap">{customer.customer_statuses?.status_name ?? 'N/A'}</TableCell>
                    <TableCell className="flex flex-wrap gap-1">
                      <Button variant="outline" size="xs" onClick={() => handleEditClick(customer)} className="text-[#10182b] hover:bg-gray-100 text-xs">
                        <Pencil className="h-3 w-3 sm:mr-1" /> <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <Button variant="destructive" size="xs" onClick={() => handleDeleteClick(customer.id)} className="bg-red-500 p-1 text-white hover:bg-red-600 text-xs">
                        <Trash2 className="h-3 w-3 sm:mr-1" /> <span className="hidden sm:inline">Hapus</span>
                      </Button>
                      <Button 
                        variant="default"
                        size="xs"
                        onClick={() => handleContactCustomer(customer.name, customer.phone)}
                        className="bg-green-500 hover:bg-green-600 text-white text-xs p-1"
                        title="Hubungi via WhatsApp"
                      >
                        <MessageSquareText className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">WA</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                      Tidak ada data pelanggan yang cocok.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomersPage;