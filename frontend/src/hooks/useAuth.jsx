import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getDeviceInfo } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Race: getSession vs timeout 2s
    const timer = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth timeout')
        setLoading(false)
      }
    }, 2000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      clearTimeout(timer)
      if (session?.user) {
        setUser(session.user)
        try {
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
          if (mounted && data) setProfile(data)
        } catch {}
      }
      if (mounted) setLoading(false)
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // Auth changes après init
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        try {
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
          if (data) setProfile(data)
        } catch {}
        await logLogin(session.user.id)
        setLoading(false)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null); setProfile(null); setLoading(false)
      }
    })

    return () => {
      mounted = false
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  async function logLogin(userId) {
    try {
      const { deviceType, deviceInfo } = getDeviceInfo()
      await supabase.from('login_history').insert({ user_id: userId, device_type: deviceType, device_info: deviceInfo, ip_address: 'N/A', success: true })
    } catch {}
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, isAdmin, fetchProfile: async () => {} }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être dans AuthProvider')
  return context
}
