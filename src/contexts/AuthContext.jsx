import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let profileLoadPromise = null;

    const loadUserProfile = async (userId) => {
      // Prevent multiple simultaneous profile loads
      if (profileLoadPromise) {
        return profileLoadPromise;
      }

      profileLoadPromise = supabase
        .from('profiles')
        .select('id, role, company_id, full_name')
        .eq('id', userId)
        .single();

      try {
        const { data: profile, error } = await profileLoadPromise;
        
        if (!isMounted) return null;

        if (error) {
          console.error('Error fetching user profile:', error);
          toast.error('Gagal memuat profil pengguna.');
          return null;
        }
        
        return profile;
      } catch (error) {
        console.error('Error in loadUserProfile:', error);
        if (isMounted) {
          toast.error('Terjadi kesalahan saat memuat profil.');
        }
        return null;
      } finally {
        profileLoadPromise = null;
      }
    };

    const handleAuthChange = async (newSession, skipProfileLoad = false) => {
      if (!isMounted) return;

      // Check if session actually changed
      const sessionChanged = JSON.stringify(session) !== JSON.stringify(newSession);
      
      if (!sessionChanged && isInitialized && !skipProfileLoad) {
        return; // No change, skip update
      }

      if (newSession) {
        setSession(newSession);
        
        if (!skipProfileLoad) {
          const profile = await loadUserProfile(newSession.user.id);
          if (isMounted) {
            setUserProfile(profile);
          }
        }
      } else {
        setSession(null);
        setUserProfile(null);
      }
    };

    const initializeAuth = async () => {
      if (!isMounted) return;
      
      setLoading(true);
      
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting initial session:', error);
          toast.error('Gagal mendapatkan sesi awal.');
          return;
        }
        
        await handleAuthChange(currentSession);
        
        if (isMounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
        toast.error('Gagal menginisialisasi otentikasi.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted || !isInitialized) return;
        
        console.log('Auth state changed:', event, !!newSession);
        
        // Only handle auth changes after initialization
        await handleAuthChange(newSession);
        
        if (isMounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    session,
    userProfile,
    loading,
    userRole: userProfile?.role,
    companyId: userProfile?.company_id,
    isAuthenticated: !!session,
    userId: session?.user?.id,
  }), [session, userProfile, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
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