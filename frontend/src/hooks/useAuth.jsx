import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getDeviceInfo } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Init error:', err)
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
        await logLogin(session.user.id)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null); setProfile(null); setLoading(false)
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('fetchProfile error:', err)
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
