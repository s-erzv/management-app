// src/components/Navbar.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { LogOut, UserCircle, LayoutDashboard, ListOrdered, Users, Package, Calendar, BarChart, Settings, Truck, Files, ReceiptText, Wallet, PiggyBank, Menu, Lock, Building2, Database } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const navItems = [
  { path: '/dashboard', name: 'Dashboard', icon: <LayoutDashboard />, roles: ['super_admin', 'super_admin-main', 'admin', 'user'] },
  { path: '/orders', name: 'Manajemen Pesanan', icon: <ListOrdered />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/customers', name: 'Customers', icon: <Users />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/stock', name: 'Manajemen Stok', icon: <Package />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/stock-reconciliation', name: 'Update Stok', icon: <Files />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/central-orders', name: 'Order Pusat', icon: <Truck />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/expenses', name: 'Uang Terpakai', icon: <ReceiptText />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/financial-management', name: 'Manajemen Keuangan', icon: <PiggyBank />, roles: ['super_admin', 'admin'] },
  { path: '/financials', name: 'Keuangan', icon: <Wallet />, roles: ['super_admin', 'admin'] },
  { path: '/reports', name: 'Analisis', icon: <BarChart />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/data-export', name: 'Data Center', icon: <Database />, roles: ['super_admin-main', 'admin'] },
  { path: '/settings', name: 'Pengaturan', icon: <Settings />, roles: ['super_admin', 'admin'] },
  { path: '/users', name: 'Manajemen Pengguna', icon: <Users />, roles: ['super_admin', 'super_admin-main'] },
];

const Sidebar = () => {
  const { session, userRole, companyName, companyLogo, setActiveCompany, companyId, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loadingPasswordChange, setLoadingPasswordChange] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(userRole === 'super_admin');

  useEffect(() => {
    const fetchCompanies = async () => {
      if (userRole === 'super_admin') {
        setLoadingCompanies(true);
        const { data, error } = await supabase.from('companies').select('id, name');
        if (error) {
          console.error('Error fetching companies:', error);
          toast.error('Gagal memuat daftar perusahaan.');
        } else {
          setCompanies(data || []);
        }
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
  }, [userRole]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Gagal keluar.');
      console.error('Error signing out:', error);
    } else {
      navigate('/login');
    }
  };
  
  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error('Kata sandi baru tidak boleh kosong.');
      return;
    }
    setLoadingPasswordChange(true);
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    setLoadingPasswordChange(false);
    if (error) {
      toast.error('Gagal memperbarui kata sandi: ' + error.message);
    } else {
      toast.success('Kata sandi berhasil diperbarui!');
      setIsChangePasswordModalOpen(false);
      setNewPassword('');
    }
  };

  if (!session) {
    return null;
  }
  
  // Logika baru untuk menentukan peran yang sedang aktif
  const currentRole = userRole === 'super_admin' && !companyId ? 'super_admin-main' : userRole;
  
  // Filter menu berdasarkan peran yang sedang aktif
  const filteredItems = navItems.filter(item => item.roles.includes(currentRole));
  
  const NavContent = ({ onLinkClick, isMobile = false }) => (
    <nav className="flex flex-col gap-2 px-3 py-4 h-full overflow-y-auto scrollbar-hide">
      <Link 
        to="/dashboard" 
        className={`flex h-10 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100 mb-4 ${isMobile ? '' : 'group'}`}
        onClick={onLinkClick}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          {companyLogo ? (
            <img src={companyLogo} alt="Company Logo" className="h-full w-full rounded-md object-contain" />
          ) : (
            companyName ? companyName[0].toUpperCase() : 'A'
          )}
        </div>
        <span className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-sm font-semibold transition-opacity duration-300 whitespace-nowrap`}>
          {companyName || 'Nama Perusahaan'}
        </span>
      </Link>
      
      {userRole === 'super_admin' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex w-full items-center justify-start gap-2 h-10 px-3 py-2 cursor-pointer"
              disabled={loadingCompanies}
            >
              <Building2 className="h-4 w-4" />
              <span className="truncate">
                {companyId ? companies.find(c => c.id === companyId)?.name : "Pilih Perusahaan"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel>Pilih Perusahaan</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setActiveCompany(null);
                navigate('/dashboard');
              }}
              className={!companyId ? 'bg-gray-100 font-medium cursor-pointer' : ''}
            >
              Kembali ke Dashboard Utama
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {companies.map((comp) => (
              <DropdownMenuItem
                key={comp.id}
                onClick={() => {
                  setActiveCompany(comp.id);
                  navigate('/dashboard');
                }}
                className={comp.id === companyId ? 'bg-gray-100 font-medium' : ''}
              >
                {comp.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {filteredItems.map((item) => (
        <Link
          key={item.name}
          to={item.path}
          className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 py-2 transition-all duration-150 ease-in-out
            ${location.pathname === item.path 
              ? 'bg-gray-200 text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:bg-gray-100'
            } ${isMobile ? '' : 'group'}`}
          onClick={onLinkClick}
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            {item.icon}
          </div>
          <span className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-sm font-medium transition-opacity duration-300 whitespace-nowrap`}>
            {item.name}
          </span>
        </Link>
      ))}

      <div className="mt-auto w-full border-t border-gray-200 pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex h-10 w-full items-center justify-start gap-3 rounded-lg px-3 py-2 
                        text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
            >
              <div className="flex h-5 w-5 items-center justify-center">
                <UserCircle className="h-5 w-5" />
              </div>
              <span className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-sm font-medium transition-opacity duration-300 whitespace-nowrap`}>
                Profile
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{session.user.email}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  Role: {userRole}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsChangePasswordModalOpen(true)}>
              <Lock className="mr-2 h-4 w-4" />
              <span>Ganti Kata Sandi</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden sm:block">
        <aside className="group fixed inset-y-0 left-0 z-50 flex w-16 hover:w-64 flex-col border-r border-gray-200 bg-white shadow-sm transition-all duration-300 ease-in-out">
          <NavContent onLinkClick={() => {}} />
        </aside>
      </div>
      
      {/* Mobile Navbar with Hamburger Menu */}
      <header className="sm:hidden sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b bg-white px-4 shadow-sm md:px-6">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="flex flex-col bg-white" aria-describedby={undefined}>
            <SheetHeader className="px-1">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>

            <NavContent onLinkClick={() => setIsSheetOpen(false)} isMobile={true} />
          </SheetContent>
        </Sheet>

        <div className="flex-1 text-center font-bold text-lg">
          {companyName || 'Nama Perusahaan'}
        </div>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <UserCircle className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{session.user.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    Role: {userRole}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsChangePasswordModalOpen(true)}>
                <Lock className="mr-2 h-4 w-4" />
                <span>Ganti Kata Sandi</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Keluar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      
      {/* Change Password Modal */}
      <Dialog open={isChangePasswordModalOpen} onOpenChange={setIsChangePasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ganti Kata Sandi</DialogTitle>
            <DialogDescription>
              Masukkan kata sandi baru Anda.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Kata Sandi Baru</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loadingPasswordChange} className="w-full">
              {loadingPasswordChange ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Simpan Kata Sandi'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Sidebar;