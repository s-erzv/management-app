import { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const EditUserForm = ({ open, onOpenChange, userToEdit, onUserUpdated }) => {
  const { userRole } = useAuth();
  const [fullName, setFullName] = useState('');
  const [rekening, setRekening] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userToEdit) {
      setFullName(userToEdit.full_name || '');
      setRekening(userToEdit.rekening || '');
    }
  }, [userToEdit]);

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!userToEdit?.id) throw new Error('User ID not found');

      // Perbarui tabel profiles
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          rekening: rekening,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userToEdit.id);

      if (error) throw error;
      
      // Jika role adalah admin, perbarui juga logo perusahaan jika ada file baru
      if (userRole === 'super_admin' && userToEdit.role === 'admin' && logoFile) {
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
          
        const { error: companyUpdateError } = await supabase
          .from('companies')
          .update({ logo_url: publicUrlData.publicUrl })
          .eq('id', userToEdit.company_id);
          
        if (companyUpdateError) throw companyUpdateError;
      }

      toast.success('Pengguna berhasil diperbarui!');
      onUserUpdated({ ...userToEdit, full_name: fullName, rekening: rekening });
      onOpenChange(false);

    } catch (error) {
      console.error('Error updating user:', error.message);
      toast.error('Gagal memperbarui pengguna: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Pengguna</DialogTitle>
          <DialogDescription>
            Perbarui detail pengguna {userToEdit?.email}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div>
            <Label>Nama Lengkap</Label>
            <Input
              type="text"
              placeholder="Nama Lengkap"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Nomor Rekening</Label>
            <Input
              type="text"
              placeholder="Nomor Rekening"
              value={rekening}
              onChange={(e) => setRekening(e.target.value)}
            />
          </div>
          {userRole === 'super_admin' && userToEdit?.role === 'admin' && (
            <div>
              <Label htmlFor="logo">Logo Perusahaan (Opsional)</Label>
              <Input
                id="logo"
                type="file"
                onChange={(e) => setLogoFile(e.target.files[0])}
                accept="image/*"
              />
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Perbarui Pengguna'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserForm;