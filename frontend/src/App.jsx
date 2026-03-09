import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ViewerPage from './pages/ViewerPage'
import AdminPage from './pages/AdminPage'
import './styles/index.css'

function AppRoutes() {
  const { user } = useAuth()

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
