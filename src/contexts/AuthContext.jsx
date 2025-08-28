import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const handleAuthChange = async (newSession) => {
      if (!isMounted) return;

      if (newSession) {
        setSession(newSession);
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role, company_id, full_name')
            .eq('id', newSession.user.id)
            .single();

          if (isMounted) {
            if (error) {
              console.error('Error fetching user profile:', error);
              setUserProfile(null);
              toast.error('Gagal memuat profil pengguna.');
            } else {
              setUserProfile(profile);
            }
          }
        } catch (error) {
          console.error('Error in handleAuthChange:', error);
          if (isMounted) {
            setUserProfile(null);
            toast.error('Terjadi kesalahan saat otentikasi. Silakan login ulang.');
          }
        }
      } else {
        setSession(null);
        setUserProfile(null);
      }
      if (isMounted) {
        setLoading(false);
      }
    };

    const initialLoad = async () => {
      setLoading(true);
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting initial session:', error);
        toast.error('Gagal mendapatkan sesi awal.');
        setLoading(false);
        return;
      }
      
      await handleAuthChange(currentSession);
    };

    initialLoad();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        handleAuthChange(newSession);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    userProfile,
    loading,
    userRole: userProfile?.role,
    companyId: userProfile?.company_id,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};