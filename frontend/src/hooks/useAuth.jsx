import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getDeviceInfo } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Timeout de sécurité — jamais bloqué plus de 5s
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth timeout — forcing loading false')
        setLoading(false)
      }
    }, 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      console.log('Auth event:', event, session?.user?.email)

      if (!session?.user) {
        setUser(null); setProfile(null); setLoading(false)
        return
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        setUser(session.user)
        await fetchProfile(session.user.id)
        if (event === 'SIGNED_IN') await logLogin(session.user.id)
      }
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      if (error) {
        console.error('fetchProfile error:', error.code, error.message)
        // Continuer même sans profil — l'user est connecté
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error('fetchProfile catch:', err)
    } finally {
      setLoading(false)
    }
  }

  async function logLogin(userId) {
    try {
      const { deviceType, deviceInfo } = getDeviceInfo()
      await supabase.from('login_history').insert({
        user_id: userId, device_type: deviceType,
        device_info: deviceInfo, ip_address: 'N/A', success: true
      })
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
