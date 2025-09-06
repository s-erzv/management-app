// src/components/AddUserForm.jsx
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

const AddUserForm = ({ open, onOpenChange, onUserAdded }) => {
  const { companyId } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rekening, setRekening] = useState(''); 
  const [loading, setLoading] = useState(false);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          email, 
          password, 
          role: 'user', 
          companyId,
          full_name: fullName,
          rekening: rekening,
        }),
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      toast.success('Pengguna berhasil ditambahkan!');
      onUserAdded({ id: data.userId, email, full_name: fullName, rekening: rekening, role: 'user' });
      setEmail('');
      setPassword('');
      setFullName('');
      setRekening(''); 
      onOpenChange(false);

    } catch (error) {
      console.error('Error adding user:', error.message);
      toast.error('Gagal menambahkan pengguna: ' + error.message);
    } finally {
      setLoading(false);
    }
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
            <Label className="text-sm font-medium">Nama Lengkap</Label>
            <Input
              type="text"
              placeholder="Nama Lengkap"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Email</Label>
            <Input
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Kata Sandi</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Nomor Rekening</Label>
            <Input
              type="text"
              placeholder="Nomor Rekening"
              value={rekening}
              onChange={(e) => setRekening(e.target.value)}
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