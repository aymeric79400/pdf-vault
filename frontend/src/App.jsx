import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ViewerPage from './pages/ViewerPage'
import AdminPage from './pages/AdminPage'
import './styles/index.css'

function LoadingScreen() {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'100vh', gap:'16px', color:'var(--text-secondary)'
    }}>
      <div style={{
        width:36, height:36, border:'3px solid var(--border)',
        borderTopColor:'var(--accent)', borderRadius:'50%',
        animation:'spin 0.8s linear infinite'
      }}/>
      <span style={{fontSize:14}}>Chargement...</span>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 5000)
    return () => clearTimeout(t)
  }, [])

  if (loading && !timedOut) return <LoadingScreen />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />
      <Route path="/viewer/:docId" element={user ? <ViewerPage /> : <Navigate to="/login" replace />} />
      <Route path="/admin" element={user ? <AdminPage /> : <Navigate to="/login" replace />} />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background:'var(--bg-card)', color:'var(--text-primary)',
            border:'1px solid var(--border-strong)', borderRadius:'10px',
            fontSize:'13px', fontFamily:'var(--font-body)', boxShadow:'var(--shadow-lg)',
          },
          success:{ iconTheme:{ primary:'var(--success)', secondary:'var(--bg-card)' } },
          error:{ iconTheme:{ primary:'var(--error)', secondary:'var(--bg-card)' } },
        }}
      />
    </AuthProvider>
  )
}
