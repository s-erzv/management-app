import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [activeCompanyId, setActiveCompanyId] = useState(null);

  const mountedRef = useRef(true)
  const profilePromiseRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true

    const safeSet = (fn) => mountedRef.current && fn()

    const applySession = async (nextSession) => {
      safeSet(() => setSession(nextSession))
      if (!nextSession?.user?.id) safeSet(() => setUserProfile(null))
    }

    const initialize = async () => {
      setAuthLoading(true)
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        await applySession(data?.session ?? null)
      } catch (e) {
        console.error('[Auth] init getSession failed:', e)
        try { await supabase.auth.signOut() } catch {}
        safeSet(() => setSession(null))
        safeSet(() => setUserProfile(null))
      } finally {
        if (mountedRef.current) setAuthLoading(false)
      }
    }

    initialize()

    // Listen basic auth changes only
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      await applySession(newSession)
    })

    return () => {
      mountedRef.current = false
      listener?.subscription?.unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    if (profilePromiseRef.current) return

    let cancelled = false
    profilePromiseRef.current = (async () => {
      try {
        setProfileLoading(true)
        const { data, error } = await supabase
          .from('profiles')
          .select(`id, role, company_id, full_name, companies(name, logo_url)`) 
          .eq('id', userId)
          .single()
        if (error) throw error
        if (!cancelled) {
          setUserProfile(data);
          setActiveCompanyId(data.company_id); 
        }
      } catch (err) {
        console.warn('[Auth] profile load failed, will retry on next auth change/focus:', err)
      } finally {
        profilePromiseRef.current = null
        if (!cancelled) setProfileLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [session?.user?.id])

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return
      if (!session?.user?.id) return
      if (userProfile || profilePromiseRef.current) return
      const { data, error } = await supabase
        .from('profiles')
        .select(`id, role, company_id, full_name, companies(name, logo_url)`) 
        .eq('id', session.user.id)
        .single()
      if (!error) {
        setUserProfile(data);
        setActiveCompanyId(data.company_id); 
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [session?.user?.id, userProfile])
  
  const handleSetActiveCompany = (companyId) => {
    if (userProfile?.role === 'super_admin') {
      setActiveCompanyId(companyId);
    }
  };

  const contextValue = useMemo(() => ({
    session,
    userProfile,
    loading: authLoading || profileLoading,
    authLoading,
    profileLoading,
    isAuthenticated: !!session,
    userId: session?.user?.id ?? null,
    userRole: userProfile?.role ?? null,
    companyId: activeCompanyId ?? userProfile?.company_id ?? null,
    companyName: userProfile?.companies?.name ?? null,
    companyLogo: userProfile?.companies?.logo_url ?? null,
    refreshProfile: async () => {
      if (!session?.user?.id) return null
      const { data, error } = await supabase
        .from('profiles')
        .select(`id, role, company_id, full_name, companies(name, logo_url)`) 
        .eq('id', session.user.id)
        .single()
      if (!error) {
        setUserProfile(data);
        setActiveCompanyId(data.company_id);
      }
      return data ?? null
    },
    setActiveCompany: handleSetActiveCompany,
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) console.warn('[Auth] signOut error', error)
    },
  }), [session, userProfile, authLoading, profileLoading, activeCompanyId])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext;