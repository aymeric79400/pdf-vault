import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getDeviceInfo } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let resolved = false

    function done() {
      if (mounted && !resolved) {
        resolved = true
        setLoading(false)
      }
    }

    // Timeout absolu 4s — si rien ne répond, on affiche login
    const timer = setTimeout(done, 4000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      clearTimeout(timer)
      if (session?.user) {
        setUser(session.user)
        try {
          const { data } = await supabase
            .from('profiles').select('*').eq('id', session.user.id).single()
          if (mounted && data) setProfile(data)
        } catch (e) {
          console.error('profile error:', e)
        }
      }
      done()
    }).catch((e) => {
      console.error('getSession error:', e)
      clearTimeout(timer)
      done()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' && session?.user) {
        clearTimeout(timer)
        setUser(session.user)
        try {
          const { data } = await supabase
            .from('profiles').select('*').eq('id', session.user.id).single()
          if (mounted && data) setProfile(data)
        } catch {}
        await logLogin(session.user.id)
        done()
      }
      if (event === 'SIGNED_OUT') {
        setUser(null); setProfile(null); done()
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
