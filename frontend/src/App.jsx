import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ViewerPage from './pages/ViewerPage'
import AdminPage from './pages/AdminPage'
import './styles/index.css'

function LoadingScreen() {
  const [log, setLog] = useState(['démarrage...'])
  const add = (msg) => setLog(p => [...p, msg])

  useEffect(() => {
    add('appel getSession...')
    const start = Date.now()
    
    supabase.auth.getSession().then(({ data, error }) => {
      const ms = Date.now() - start
      add(`getSession répondu en ${ms}ms`)
      if (error) add('ERREUR: ' + error.message)
      else if (data?.session) add('session OK: ' + data.session.user.email)
      else add('session: NULL (pas connecté)')
    }).catch(e => {
      add('CATCH: ' + e.message)
    })

    // Log localStorage
    try {
      const keys = Object.keys(localStorage).filter(k => k.includes('supabase'))
      add('localStorage keys: ' + (keys.length ? keys.join(', ') : 'aucune'))
    } catch(e) {
      add('localStorage: inaccessible')
    }
  }, [])

  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'100vh', gap:'12px', color:'var(--text-secondary)',
      padding:'24px'
    }}>
      <div style={{
        width:36, height:36, border:'3px solid var(--border)',
        borderTopColor:'var(--accent)', borderRadius:'50%',
        animation:'spin 0.8s linear infinite', flexShrink:0
      }}/>
      <span style={{fontSize:14}}>Chargement...</span>
      <div style={{
        background:'#0a0f1a', border:'1px solid #1e3a5f', borderRadius:8,
        padding:'12px 16px', fontSize:11, color:'#4ade80', fontFamily:'monospace',
        maxWidth:'100%', width:400, marginTop:8
      }}>
        {log.map((l, i) => <div key={i}>▶ {l}</div>)}
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(t)
  }, [])

  if (loading && !timedOut) return <LoadingScreen />

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/viewer/:docId" element={<ViewerPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster position="top-right" toastOptions={{
        style: {
          background:'var(--bg-card)', color:'var(--text-primary)',
          border:'1px solid var(--border-strong)', borderRadius:'10px',
          fontSize:'13px', fontFamily:'var(--font-body)', boxShadow:'var(--shadow-lg)',
        },
        success:{ iconTheme:{ primary:'var(--success)', secondary:'var(--bg-card)' } },
        error:{ iconTheme:{ primary:'var(--error)', secondary:'var(--bg-card)' } },
      }}/>
    </AuthProvider>
  )
}
