// src/components/CustomerForm.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const CustomerForm = ({ isOpen, onOpenChange, onCustomerAdded }) => {
  const { companyId } = useAuth();
  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    phone: '', 
    address: '',
    customer_status: '',
  });

  useEffect(() => {
    if (companyId) {
      fetchCustomerStatuses();
    }
  }, [companyId]);

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

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...formData, company_id: companyId }])
        .select()
        .single();
      
      if (error) throw error;
      
      onCustomerAdded(data);
      resetForm();

    } catch (error) {
      console.error('Error adding customer:', error);
      toast.error('Gagal menambahkan pelanggan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '', customer_status: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Pelanggan Baru</DialogTitle>
          <DialogDescription>
            Isi formulir untuk menambahkan pelanggan baru.
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambah Pelanggan'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerForm;