// Isi file ini sudah benar dari respons sebelumnya.
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const AddAdminForm = ({ open, onOpenChange, onUserAdded }) => {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Langkah 1: Buat entri perusahaan baru
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert([{ name: companyName }])
        .select();

      if (companyError) {
        throw companyError;
      }

      const newCompanyId = companyData[0].id;
      
      // Langkah 2: Buat akun pengguna baru di auth.users dengan peran 'admin'
      const { data: { user }, error: userError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (userError) {
        // Jika pembuatan user gagal, hapus perusahaan yang sudah dibuat
        await supabase.from('companies').delete().eq('id', newCompanyId);
        throw userError;
      }

      // Langkah 3: Perbarui profil pengguna dengan peran 'admin' dan company_id baru
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          { id: user.id, role: 'admin', company_id: newCompanyId },
          { onConflict: 'id' } // kalau sudah ada, update; kalau belum, insert
        );
        
        if (profileError) {
            await supabase.from('companies').delete().eq('id', newCompanyId);
            throw profileError;
        }

      toast.success('Admin dan perusahaan berhasil ditambahkan!');
      onUserAdded({ id: user.id, email: user.email, full_name: null, role: 'admin' });
      resetForm();

    } catch (error) {
      console.error('Error adding admin:', error.message);
      toast.error('Gagal menambahkan admin: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setCompanyName('');
    setEmail('');
    setPassword('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetForm}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Admin Baru</DialogTitle>
          <DialogDescription>
            Isi formulir untuk membuat akun admin dan perusahaan baru.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddAdmin} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nama Perusahaan</label>
            <Input
              type="text"
              placeholder="Nama Perusahaan"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email Admin</label>
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambah Admin'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddAdminForm;
