import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getDeviceInfo } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Timeout de sécurité absolu — 3s max
    const safetyTimeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 3000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      clearTimeout(safetyTimeout)

      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null); setProfile(null); setLoading(false)
        return
      }
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
        if (event === 'SIGNED_IN') await logLogin(session.user.id)
      }
    })

    // getSession déclenche onAuthStateChange
    supabase.auth.getSession().catch(() => {
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('fetchProfile:', err)
    } finally {
      setLoading(false)
    }
  }

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
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, isAdmin, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être dans AuthProvider')
  return context
}
