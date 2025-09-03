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
import AddAdminForm from '@/components/AddAdminForm';
import EditUserForm from '@/components/EditUserForm'; // Import komponen edit
import { Loader2, Pencil } from 'lucide-react';

const UserManagementPage = () => {
  const { session, userRole, companyId } = useAuth();

  // users
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // companies (khusus super_admin)
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // modal tambah user/admin
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // State baru untuk modal edit
  const [userToEdit, setUserToEdit] = useState(null); // State untuk data user yang akan diedit

  useEffect(() => {
    if (!session) return;
    fetchUsers();
    if (userRole === 'super_admin') {
      fetchCompanies();
    }
  }, [session, userRole, companyId]);

  /* ------------------------- FETCHERS ------------------------- */

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase.rpc('list_profiles_with_email');
    if (error) {
      console.error('Error fetching users:', error);
      toast.error('Gagal mengambil data pengguna.');
      setUsers([]);
    } else {
      setUsers(data ?? []);
    }
    setLoadingUsers(false);
  };

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching companies:', error);
      toast.error('Gagal mengambil data perusahaan.');
      setCompanies([]);
    } else {
      setCompanies(data ?? []);
    }
    setLoadingCompanies(false);
  };

  /* ------------------------- HANDLERS ------------------------- */

  const handleRoleChange = async (userId, newRole) => {
    if (userId === session.user.id) {
      toast.error('Anda tidak bisa mengubah peran diri sendiri.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user role:', error);
      toast.error('Gagal mengubah peran pengguna.');
    } else {
      toast.success('Peran pengguna berhasil diubah!');
      setUsers((prev) => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return;
    if (userId === session.user.id) {
      toast.error('Anda tidak bisa menghapus akun Anda sendiri.');
      return;
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error('Error deleting user:', error);
      toast.error('Gagal menghapus pengguna.');
    } else {
      toast.success('Pengguna berhasil dihapus.');
      setUsers((prev) => prev.filter(u => u.id !== userId));
    }
  };

  const handleEditUser = (user) => {
    setUserToEdit(user);
    setIsEditModalOpen(true);
  };

  const handleUserUpdated = (updatedUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    setIsEditModalOpen(false);
  };
  
  const handleDeleteCompany = async (id, name) => {
    const ok = window.confirm(
      `Hapus perusahaan “${name}”? Semua data terkait mungkin ikut terhapus sesuai aturan FK.`
    );
    if (!ok) return;

    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Gagal hapus perusahaan:', error);
      toast.error('Gagal menghapus perusahaan.');
    } else {
      toast.success('Perusahaan berhasil dihapus.');
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      fetchUsers();
    }
  };

  const handleUserAdded = () => {
    fetchUsers();
    if (userRole === 'super_admin') fetchCompanies();
  };

  /* ------------------------- RENDER ------------------------- */

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Manajemen Pengguna</h2>
        {userRole === 'super_admin' ? (
          <Button onClick={() => setIsAddModalOpen(true)}>+ Tambah Admin</Button>
        ) : userRole === 'admin' ? (
          <Button onClick={() => setIsAddModalOpen(true)}>+ Tambah Pengguna</Button>
        ) : null}
      </div>

      {userRole === 'super_admin' ? (
        <AddAdminForm
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onUserAdded={handleUserAdded}
        />
      ) : (
        <AddUserForm
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onUserAdded={handleUserAdded}
        />
      )}
      
      {/* Modal Edit Pengguna */}
      {userToEdit && (
        <EditUserForm
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          userToEdit={userToEdit}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {/* USERS TABLE */}
      {loadingUsers ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="rounded-md border mb-10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Lengkap</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rekening</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name ?? '-'}</TableCell>
                  <TableCell>{user.email ?? '-'}</TableCell>
                  <TableCell>{user.rekening ?? '-'}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                      disabled={user.id === session.user.id || userRole !== 'super_admin'}
                    >
                      <SelectTrigger className="w-[160px]">
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
                    <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.id === session.user.id}
                        >
                          Hapus
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* COMPANIES TABLE – hanya untuk super_admin */}
      {userRole === 'super_admin' && (
        <>
          <h3 className="text-xl font-semibold mb-3">Manajemen Perusahaan</h3>
          {loadingCompanies ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Perusahaan</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="w-[140px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{new Date(c.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          onClick={() => handleDeleteCompany(c.id, c.name)}
                        >
                          Hapus
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {companies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        Tidak ada perusahaan.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserManagementPage;