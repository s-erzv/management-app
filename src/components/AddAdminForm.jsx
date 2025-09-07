// src/components/AddAdminForm.jsx
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
import { Label } from '@/components/ui/label';

const AddAdminForm = ({ open, onOpenChange, onUserAdded }) => {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        throw new Error('User not authenticated');
      }

      let logoUrl = null;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `company_logos/${crypto.randomUUID()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile, {
            cacheControl: '3600',
            upsert: false,
          });
        
        if (uploadError) {
          throw new Error('Gagal mengunggah logo: ' + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from('logos')
          .getPublicUrl(filePath);
        
        logoUrl = publicUrlData.publicUrl;
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
          role: 'admin', 
          companyName,
          full_name: fullName,
          logoUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create admin');
      }
      
      toast.success('Admin dan perusahaan berhasil ditambahkan!');
      onUserAdded({ id: data.userId, email, full_name: fullName, role: 'admin' });
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
    setFullName('');
    setLogoFile(null);
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
            <label className="text-sm font-medium">Nama Lengkap Admin</label>
            <Input
              type="text"
              placeholder="Nama Lengkap"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
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
          <div>
            <Label htmlFor="logo">Logo Perusahaan (Opsional)</Label>
            <Input
              id="logo"
              type="file"
              onChange={(e) => setLogoFile(e.target.files[0])}
              accept="image/*"
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