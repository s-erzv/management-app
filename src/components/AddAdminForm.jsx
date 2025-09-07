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
  const [googleSheetsLink, setGoogleSheetsLink] = useState('');
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

      // Langkah 1: Buat user dan perusahaan terlebih dahulu (tanpa logo)
      const payload = { 
        email, 
        password, 
        role: 'admin', 
        companyName,
        full_name: fullName,
        googleSheetsLink,
      };

      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create admin');
      }
      
      const { userId, companyId } = data;
      let logoUrl = null;

      // Langkah 2: Unggah logo jika ada
      if (logoFile && companyId) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `company_logos/${companyId}-${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile, {
            cacheControl: '3600',
            upsert: false,
          });
        
        if (uploadError) {
          console.warn('Gagal mengunggah logo, melanjutkan tanpa logo:', uploadError);
          toast.error('Gagal mengunggah logo, tetapi admin berhasil ditambahkan.');
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('logos')
            .getPublicUrl(filePath);
          
          logoUrl = publicUrlData.publicUrl;

          // Langkah 3: Perbarui perusahaan dengan URL logo
          const { error: updateError } = await supabase
            .from('companies')
            .update({ logo_url: logoUrl })
            .eq('id', companyId);
          
          if (updateError) {
            console.error('Gagal memperbarui URL logo:', updateError);
          }
        }
      }

      toast.success('Admin dan perusahaan berhasil ditambahkan!');
      onUserAdded({ id: userId, email, full_name: fullName, role: 'admin' });
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
    setGoogleSheetsLink('');
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
          <div>
            <Label htmlFor="google-sheets-link">Link Google Sheets</Label>
            <Input
              id="google-sheets-link"
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={googleSheetsLink}
              onChange={(e) => setGoogleSheetsLink(e.target.value)}
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