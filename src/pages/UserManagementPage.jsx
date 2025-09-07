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
import EditUserForm from '@/components/EditUserForm';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold">Manajemen Pengguna</h2>
        {userRole === 'super_admin' ? (
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90"
          >
            + Tambah Admin
          </Button>
        ) : userRole === 'admin' ? (
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90"
          >
            + Tambah Pengguna
          </Button>
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
      
      {userToEdit && (
        <EditUserForm
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          userToEdit={userToEdit}
          onUserUpdated={handleUserUpdated}
        />
      )}

      <Card className="mb-8 border-0 shadow-lg bg-white">
        <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
          <CardTitle>Daftar Pengguna</CardTitle>
          <CardDescription className="text-gray-200">Kelola daftar pengguna yang ada di sistem.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Nama Lengkap</TableHead>
                    <TableHead className="min-w-[200px]">Email</TableHead>
                    <TableHead className="min-w-[150px]">Rekening</TableHead>
                    <TableHead className="min-w-[160px]">Peran</TableHead>
                    <TableHead className="min-w-[150px]">Aksi</TableHead>
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
                          disabled={user.id === session.user.id || user.role === 'super_admin' || (userRole === 'admin' && user.role === 'admin')}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Pilih Peran" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Kondisi untuk menampilkan opsi berdasarkan peran user yang login */}
                            {userRole === 'super_admin' ? (
                              <>
                                <SelectItem value="super_admin">Super Admin</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                              </>
                            ) : (
                              <SelectItem value="user">User</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditUser(user)}
                            >
                              <Pencil className="h-4 w-4 text-blue-500" />
                            </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Tidak ada data.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* COMPANIES TABLE – hanya untuk super_admin */}
      {userRole === 'super_admin' && (
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-t-lg border-b">
            <CardTitle>Manajemen Perusahaan</CardTitle>
            <CardDescription className="text-gray-600">Kelola daftar perusahaan yang ada di sistem.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCompanies ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Nama Perusahaan</TableHead>
                      <TableHead className="min-w-[150px]">Dibuat</TableHead>
                      <TableHead className="min-w-[120px]">Aksi</TableHead>
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
                            size="icon"
                            onClick={() => handleDeleteCompany(c.id, c.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {companies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          Tidak ada perusahaan.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserManagementPage;