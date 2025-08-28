import { useEffect, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import AddUserForm from '@/components/AddUserForm';
import { Loader2 } from 'lucide-react';

const UserManagementPage = () => {
  const { session } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('list_profiles_with_email');

    if (error) {
      console.error('Error fetching users via RPC:', error);
      toast.error('Gagal mengambil data pengguna.');
      setUsers([]);
    } else {
      setUsers(data ?? []);
    }
    setLoading(false);
  };

  const handleRoleChange = async (userId, newRole) => {
    if (userId === session.user.id) {
      toast.error('Anda tidak bisa mengubah peran diri sendiri.');
      return;
    }
    
    // Perbarui peran di database
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user role:', error);
      toast.error('Gagal mengubah peran pengguna.');
    } else {
      toast.success('Peran pengguna berhasil diubah!');
      // Perbarui state lokal
      setUsers(users.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return;

    if (userId === session.user.id) {
      toast.error('Anda tidak bisa menghapus akun Anda sendiri.');
      return;
    }
    
    // Hapus pengguna dari auth.users
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error('Error deleting user:', error);
      toast.error('Gagal menghapus pengguna.');
    } else {
      toast.success('Pengguna berhasil dihapus.');
      // Perbarui state lokal
      setUsers(users.filter(u => u.id !== userId));
    }
  };
  
  const handleUserAdded = (newUser) => {
    setUsers((prevUsers) => [...prevUsers, newUser]);
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Manajemen Pengguna</h2>
        <Button onClick={() => setIsModalOpen(true)}>+ Tambah Pengguna</Button>
      </div>

      <AddUserForm
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onUserAdded={handleUserAdded}
      />
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Lengkap</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name ?? '-'}</TableCell>
                  <TableCell>{user.email ?? '-'}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                      disabled={user.id === session.user.id}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Pilih Peran" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={user.id === session.user.id}
                    >
                      Hapus
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;