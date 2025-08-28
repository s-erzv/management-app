import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
 
const AuthContext = createContext();
 
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const fetchUserAndRole = async () => {
      setLoading(true);
      setLoadingRole(true);
       
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession) { 
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentSession.user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          toast.error('Gagal memuat peran pengguna.');
          setUserRole(null);
        } else {
          setUserRole(profile?.role);
        }
      }
      
      setLoading(false);
      setLoadingRole(false);
    };

    fetchUserAndRole();
 
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (newSession) { 
          setLoadingRole(true);
          supabase
            .from('profiles')
            .select('role')
            .eq('id', newSession.user.id)
            .single()
            .then(({ data: profile, error }) => {
              if (error) {
                console.error('Error fetching user role on state change:', error);
                setUserRole(null);
              } else {
                setUserRole(profile?.role);
              }
              setLoadingRole(false);
            });
        } else {
          setUserRole(null);
        }
      }
    );
 
    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    userRole,
    loading,
    loadingRole,
  };

  return (
    <AuthContext.Provider value={value}> 
      {(!loading && !loadingRole) && children}
    </AuthContext.Provider>
  );
};
 
export const useAuth = () => {
  return useContext(AuthContext);
};