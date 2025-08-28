import { Link, useNavigate } from 'react-router-dom';
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
import { LogOut, UserCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const Navbar = () => {
  const { session, userRole } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Gagal keluar.');
      console.error('Error signing out:', error);
    } else {
      navigate('/login');
    }
  };

  if (!session) {
    return null;
  }
  
  const navItems = [
    { path: '/dashboard', name: 'Dashboard', roles: ['super_admin', 'admin', 'user'] },
    { path: '/orders', name: 'Pesanan', roles: ['super_admin', 'admin'] },
    { path: '/customers', name: 'Pelanggan', roles: ['super_admin', 'admin'] },
    { path: '/stock', name: 'Stok Galon', roles: ['super_admin', 'admin'] },
    { path: '/calendar', name: 'Jadwal', roles: ['super_admin', 'admin'] },
    { path: '/reports', name: 'Laporan', roles: ['super_admin', 'admin'] },
    { path: '/settings', name: 'Pengaturan', roles: ['super_admin', 'admin'] },
    { path: '/users', name: 'Manajemen Pengguna', roles: ['super_admin', 'admin'] }, 
    { path: '/courier', name: 'Tugas', roles: ['user'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2 font-bold text-xl">
              <span className="text-primary">Galon App</span>
            </Link>
            <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
              {filteredItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium text-gray-900 border-transparent hover:border-gray-300"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <UserCircle className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session.user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      Role: {userRole}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Keluar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;