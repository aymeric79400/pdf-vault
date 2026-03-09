import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getDeviceInfo } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [debugMsg, setDebugMsg] = useState('init...')

  useEffect(() => {
    let mounted = true

    // Log ce qui est dans le localStorage
    const keys = Object.keys(localStorage)
    const supaKeys = keys.filter(k => k.includes('supabase') || k.includes('planning'))
    setDebugMsg('LS keys: ' + (supaKeys.join(', ') || 'AUCUNE'))

    setTimeout(async () => {
      if (!mounted) return
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        setDebugMsg(`sess:${session?.user?.email ?? 'null'} err:${error?.message ?? 'ok'}`)
        if (!session?.user) { setLoading(false); return }
        setUser(session.user)
        await fetchProfile(session.user.id)
      } catch(e) {
        setDebugMsg('ERR: ' + e.message)
        setLoading(false)
      }
    }, 100)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      setDebugMsg('event:' + event + ' u:' + (session?.user?.email ?? 'null'))
      if (event === 'SIGNED_OUT') { setUser(null); setProfile(null); setLoading(false) }
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
        await logLogin(session.user.id)
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
      setDebugMsg('profile ERR: ' + err.message)
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
      <div style={{position:'fixed',bottom:50,left:4,right:4,background:'rgba(0,0,0,0.9)',color:'#0f0',fontSize:10,padding:'4px 8px',borderRadius:6,zIndex:9999,wordBreak:'break-all',pointerEvents:'none'}}>
        🔍 {debugMsg} | u:{user?'✓':'✗'} p:{profile?'✓':'✗'} l:{loading?'⏳':'✓'}
      </div>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être dans AuthProvider')
  return context
}
