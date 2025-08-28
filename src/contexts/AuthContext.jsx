import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
 
const AuthContext = createContext();
 
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      setLoading(true);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession) { 
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, company_id, full_name') 
          .eq('id', currentSession.user.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
          toast.error('Gagal memuat profil pengguna.');
          setUserProfile(null);
        } else {
          setUserProfile(profile);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    };

    fetchUserAndProfile();
 
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (newSession) { 
          supabase
            .from('profiles')
            .select('role, company_id, full_name')
            .eq('id', newSession.user.id)
            .single()
            .then(({ data: profile, error }) => {
              if (error) {
                console.error('Error fetching user profile on state change:', error);
                setUserProfile(null);
              } else {
                setUserProfile(profile);
              }
            });
        } else {
          setUserProfile(null);
        }
      }
    );
 
    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    userProfile,
    loading,
    userRole: userProfile?.role,
    companyId: userProfile?.company_id,
  };

  return (
    <AuthContext.Provider value={value}> 
      {!loading && children}
    </AuthContext.Provider>
  );
};
 
export const useAuth = () => {
  return useContext(AuthContext);
};