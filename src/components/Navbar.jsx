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
import { LogOut, UserCircle, LayoutDashboard, ListOrdered, Users, Package, Calendar, BarChart, Settings, Home, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';


const navItems = [
  { path: '/dashboard', name: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/orders', name: 'Pesanan', icon: <ListOrdered className="h-5 w-5" />, roles: ['super_admin', 'admin'] },
  { path: '/customers', name: 'Pelanggan', icon: <Users className="h-5 w-5" />, roles: ['super_admin', 'admin'] },
  { path: '/stock', name: 'Stok Galon', icon: <Package className="h-5 w-5" />, roles: ['super_admin', 'admin'] },
   { path: '/central-orders', name: 'Pesan dari Pusat', icon: <Truck className="h-5 w-5" />, roles: ['super_admin', 'admin'] },
  { path: '/calendar', name: 'Jadwal', icon: <Calendar className="h-5 w-5" />, roles: ['super_admin', 'admin'] },
  { path: '/reports', name: 'Laporan', icon: <BarChart className="h-5 w-5" />, roles: ['super_admin', 'admin'] },
  { path: '/settings', name: 'Pengaturan', icon: <Settings className="h-5 w-5" />, roles: ['super_admin', 'admin'] },
  { path: '/users', name: 'Manajemen Pengguna', icon: <Users className="h-5 w-5" />, roles: ['super_admin', 'admin'] }, 
  { path: '/courier', name: 'Tugas', icon: <Home className="h-5 w-5" />, roles: ['user'] },
];

const Sidebar = () => {
  const { session, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
  
  const filteredItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="flex h-screen">
      <aside className="group fixed bg-gray-100 inset-y-0 left-0 z-50 flex w-16 hover:w-64 flex-col border-r bg-background transition-all duration-300 ease-in-out">
        <nav className="flex flex-col items-start gap-2 px-3 py-4 h-full">
          {/* Logo/Brand */}
          <Link 
            to="/dashboard" 
            className="flex h-10 items-center gap-3 rounded-lg px-3 py-2 text-primary transition-all hover:bg-muted mb-4"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
              GA
            </div>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-semibold">
              Galon App
            </span>
          </Link>

          {/* Navigation Items */}
          {filteredItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-muted
                ${location.pathname === item.path 
                  ? 'bg-muted text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                {item.icon}
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm font-medium whitespace-nowrap">
                {item.name}
              </span>
            </Link>
          ))}

          {/* User Menu - sejajar dengan menu lain */}
          <div className="mt-auto w-full">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex h-10 w-full items-center justify-start gap-3 rounded-lg px-3 py-2 
                            hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  <div className="flex h-5 w-5 items-center justify-center">
                    <UserCircle className="h-5 w-5" />
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm font-medium whitespace-nowrap">
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
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Keluar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </aside>
    </div>
  );
};

export default Sidebar;