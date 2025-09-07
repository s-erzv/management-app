// src/components/CustomerStatusSettings.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { Loader2, PlusCircle, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const CustomerStatusSettings = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [statusName, setStatusName] = useState('');

  useEffect(() => {
    if (!authLoading && userProfile?.company_id) {
      fetchStatuses();
    }
  }, [authLoading, userProfile]);

  const fetchStatuses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customer_statuses')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('sort_order', { ascending: true }); // Mengurutkan berdasarkan sort_order
    
    if (error) {
      console.error('Error fetching customer statuses:', error);
      toast.error('Gagal mengambil data status pelanggan.');
    } else {
      setStatuses(data);
    }
    setLoading(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (!statusName) {
      toast.error('Nama status tidak boleh kosong.');
      setLoading(false);
      return;
    }

    try {
      if (currentStatus) {
        const { error } = await supabase
          .from('customer_statuses')
          .update({ status_name: statusName })
          .eq('status_name', currentStatus.status_name);
        if (error) throw error;
        toast.success('Status berhasil diperbarui.');
      } else {
        // Dapatkan sort_order tertinggi yang ada
        const maxSortOrder = statuses.reduce((max, s) => s.sort_order > max ? s.sort_order : max, 0);

        const { error } = await supabase
          .from('customer_statuses')
          .insert([{ 
            status_name: statusName,
            company_id: userProfile.company_id,
            sort_order: maxSortOrder + 1, // Atur sort_order baru
          }]);
        if (error) throw error;
        toast.success('Status berhasil ditambahkan.');
      }
      fetchStatuses();
      resetForm();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Gagal menyimpan status: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleReorder = async (index, direction) => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === statuses.length - 1)) {
        return;
    }

    setLoading(true);
    const currentItem = statuses[index];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const neighborItem = statuses[newIndex];
    
    const newSortOrder = neighborItem.sort_order;
    const neighborSortOrder = currentItem.sort_order;

    try {
        await supabase
            .from('customer_statuses')
            .update({ sort_order: newSortOrder })
            .eq('status_name', currentItem.status_name);

        await supabase
            .from('customer_statuses')
            .update({ sort_order: neighborSortOrder })
            .eq('status_name', neighborItem.status_name);
        
        toast.success('Urutan berhasil diubah!');
        fetchStatuses();
    } catch (error) {
        console.error('Error reordering:', error);
        toast.error('Gagal mengubah urutan.');
    } finally {
        setLoading(false);
    }
};

  const handleEditClick = (status) => {
    setCurrentStatus(status);
    setStatusName(status.status_name);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (statusName) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus status ini? Ini akan memengaruhi data pelanggan yang terkait.')) {
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customer_statuses')
        .delete()
        .eq('status_name', statusName);
      if (error) throw error;
      toast.success('Status berhasil dihapus.');
      fetchStatuses();
    } catch (error) {
      console.error('Error deleting status:', error);
      toast.error('Gagal menghapus status: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStatus(null);
    setStatusName('');
    setIsModalOpen(false);
  };

  if (authLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#10182b] text-white rounded-t-lg p-6">
        <CardTitle>Manajemen Status Pelanggan</CardTitle>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-white text-[#10182b] hover:bg-gray-200"
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}>
              <PlusCircle className="h-4 w-4 mr-2" /> Tambah Status
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{currentStatus ? 'Edit Status' : 'Tambah Status Baru'}</DialogTitle>
              <DialogDescription>
                {currentStatus ? 'Perbarui nama status pelanggan.' : 'Isi nama status pelanggan baru.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status-name">Nama Status</Label>
                <Input
                  id="status-name"
                  name="status-name"
                  value={statusName}
                  onChange={(e) => setStatusName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (currentStatus ? 'Perbarui Status' : 'Tambah Status')}
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
        ) : statuses.length === 0 ? (
          <p className="text-center text-gray-500">Tidak ada status pelanggan.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((status, index) => (
                  <TableRow key={status.status_name}>
                    <TableCell>{status.status_name}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
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
                            disabled={index === statuses.length - 1}
                        >
                            <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(status)}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(status.status_name)}
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

export default CustomerStatusSettings;