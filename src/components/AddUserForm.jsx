import { useState } from 'react';
import { supabase } from '../lib/supabase';
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

const AddUserForm = ({ open, onOpenChange, onUserAdded }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
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
      // Update role secara manual setelah user dibuat
      if (role !== 'user') {
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role: role })
          .eq('id', user.id);

        if (roleError) {
          console.error('Error updating user role:', roleError.message);
          toast.error('Gagal memperbarui peran pengguna.');
        } else {
          toast.success('Pengguna berhasil ditambahkan!');
          onUserAdded({ id: user.id, email: user.email, full_name: null, role: role });
        }
      } else {
        toast.success('Pengguna berhasil ditambahkan!');
        onUserAdded({ id: user.id, email: user.email, full_name: null, role: role });
      }

      setEmail('');
      setPassword('');
      setRole('user');
      onOpenChange(false);
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
          <div>
            <label className="text-sm font-medium">Peran</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Peran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Memproses...' : 'Tambah Pengguna'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddUserForm;