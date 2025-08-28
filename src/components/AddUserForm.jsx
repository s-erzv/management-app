import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const AddUserForm = ({ open, onOpenChange, onUserAdded }) => {
  const { companyId } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('Error adding user:', error.message);
      toast.error('Gagal menambahkan pengguna: ' + error.message);
    } else {
      // Perbarui profil dengan peran 'user' dan company_id dari admin
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'user', company_id: companyId })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating user role and company:', profileError.message);
        toast.error('Gagal memperbarui profil pengguna.');
      } else {
        toast.success('Pengguna berhasil ditambahkan!');
        onUserAdded({ id: user.id, email: user.email, full_name: null, role: 'user' });
        setEmail('');
        setPassword('');
        onOpenChange(false);
      }
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Pengguna Baru</DialogTitle>
          <DialogDescription>
            Isi formulir untuk membuat akun pengguna baru.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Kata Sandi</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambah Pengguna'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddUserForm;
