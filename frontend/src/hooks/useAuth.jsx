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

    async function init() {
      try {
        setDebugMsg('getSession...')
        const { data: { session }, error } = await supabase.auth.getSession()
        if (!mounted) return

        setDebugMsg(`session: ${session ? session.user.email : 'null'}, err: ${error?.message || 'none'}`)

        if (error || !session?.user) {
          setLoading(false)
          return
        }
        setUser(session.user)
        setDebugMsg('fetchProfile...')
        await fetchProfile(session.user.id)
        setDebugMsg('done')
      } catch (err) {
        setDebugMsg('CATCH: ' + err.message)
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      setDebugMsg('authEvent: ' + event)
      if (event === 'SIGNED_OUT') {
        setUser(null); setProfile(null); setLoading(false); return
      }
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
        await logLogin(session.user.id)
      }
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
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
      console.error('Erreur profil:', err)
      setDebugMsg('fetchProfile ERR: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function logLogin(userId) {
    try {
      const { deviceType, deviceInfo } = getDeviceInfo()
      await supabase.from('login_history').insert({ user_id: userId, device_type: deviceType, device_info: deviceInfo, ip_address: 'N/A', success: true })
    } catch (err) { console.error('Erreur log connexion:', err) }
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
      {/* DEBUG TEMPORAIRE - à retirer après diagnostic */}
      <div style={{position:'fixed',bottom:60,left:8,background:'rgba(0,0,0,0.85)',color:'#0f0',fontSize:11,padding:'4px 8px',borderRadius:6,zIndex:9999,maxWidth:'90vw',wordBreak:'break-all',pointerEvents:'none'}}>
        🔍 {debugMsg} | user:{user?'✓':'✗'} | profile:{profile?'✓':'✗'} | loading:{loading?'⏳':'✓'}
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
