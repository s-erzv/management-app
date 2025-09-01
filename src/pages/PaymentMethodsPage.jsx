import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2, PlusCircle, PenLine, Trash2, Banknote, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge'; // Mengimpor komponen Badge

const PaymentMethodsPage = () => {
  const { userProfile, companyId } = useAuth();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentMethod, setCurrentMethod] = useState(null);
  const [formState, setFormState] = useState({
    method_name: '',
    type: 'cash',
    account_name: '',
    account_number: '',
  });

  useEffect(() => {
    if (userProfile?.role === 'super_admin' || userProfile?.role === 'admin') {
      fetchPaymentMethods();
    } else {
      setLoading(false);
    }
  }, [userProfile, companyId]);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('company_id', companyId)
      .order('type', { ascending: false });

    if (error) {
      console.error('Error fetching payment methods:', error);
      toast.error('Gagal memuat metode pembayaran.');
    } else {
      setMethods(data);
    }
    setLoading(false);
  };

  const handleOpenModal = (method = null) => {
    setCurrentMethod(method);
    if (method) {
      setFormState({
        method_name: method.method_name,
        type: method.type,
        account_name: method.account_name || '',
        account_number: method.account_number || '',
      });
    } else {
      setFormState({
        method_name: '',
        type: 'cash',
        account_name: '',
        account_number: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentMethod(null);
  };

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormState((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const dataToSave = {
      company_id: companyId,
      ...formState,
      account_name: formState.type === 'transfer' ? formState.account_name : null,
      account_number: formState.type === 'transfer' ? formState.account_number : null,
    };

    let error;
    if (currentMethod) {
      // Update method
      ({ error } = await supabase
        .from('payment_methods')
        .update(dataToSave)
        .eq('id', currentMethod.id));
    } else {
      // Add new method
      ({ error } = await supabase
        .from('payment_methods')
        .insert(dataToSave));
    }

    if (error) {
      console.error('Error saving payment method:', error);
      toast.error('Gagal menyimpan metode pembayaran.');
    } else {
      toast.success(`Metode pembayaran berhasil ${currentMethod ? 'diperbarui' : 'ditambahkan'}!`);
      fetchPaymentMethods();
      handleCloseModal();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (methodId) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus metode pembayaran ini?')) {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', methodId);

      if (error) {
        console.error('Error deleting payment method:', error);
        toast.error('Gagal menghapus metode pembayaran.');
      } else {
        toast.success('Metode pembayaran berhasil dihapus!');
        fetchPaymentMethods();
      }
    }
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
        <h1 className="text-2xl font-bold">Metode Pembayaran</h1>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Tambah Metode
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Metode Pembayaran</CardTitle>
          <CardDescription>
            Kelola metode pembayaran yang tersedia untuk kurir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {methods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-4" />
              <p>Belum ada metode pembayaran yang ditambahkan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Metode</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Nama Akun</TableHead>
                    <TableHead>Nomor Akun</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {methods.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell className="font-medium">{method.method_name}</TableCell>
                      <TableCell>
                        <Badge variant={method.type === 'transfer' ? 'default' : 'secondary'}>
                          {method.type.charAt(0).toUpperCase() + method.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{method.account_name || '-'}</TableCell>
                      <TableCell>{method.account_number || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleOpenModal(method)}
                          >
                            <PenLine className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handleDelete(method.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentMethod ? 'Edit' : 'Tambah'} Metode Pembayaran</DialogTitle>
            <DialogDescription>
              Lengkapi detail metode pembayaran.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="method_name">Nama Metode</Label>
              <Input
                id="method_name"
                value={formState.method_name}
                onChange={handleFormChange}
                placeholder="mis. Transfer BCA, Uang Tunai"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Tipe</Label>
              <Select
                value={formState.type}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tunai (Cash)</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formState.type === 'transfer' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="account_name">Nama Pemilik Akun</Label>
                  <Input
                    id="account_name"
                    value={formState.account_name}
                    onChange={handleFormChange}
                    placeholder="mis. PT. Tirta Segar"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="account_number">Nomor Rekening</Label>
                  <Input
                    id="account_number"
                    value={formState.account_number}
                    onChange={handleFormChange}
                    placeholder="mis. 1234567890"
                    required
                  />
                </div>
              </>
            )}
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  'Simpan'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentMethodsPage;