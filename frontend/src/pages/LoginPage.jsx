import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Veuillez remplir tous les champs')
      return
    }
    setLoading(true)
    try {
      // Récupérer email + statut depuis l'identifiant
      const { data, error } = await supabase
        .rpc('get_user_status', { p_username: username.toLowerCase().trim() })

      if (error || !data || data.length === 0) {
        toast.error('Identifiant introuvable')
        setLoading(false)
        return
      }

      const { email, is_active } = data[0]

      if (!is_active) {
        toast.error('Votre compte est désactivé, veuillez contacter l\'administrateur', { duration: 6000 })
        setLoading(false)
        return
      }

      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      toast.error('Identifiant ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="grid-pattern" />
      </div>

      <div className="login-container animate-fade-in">
        <div className="login-logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="3" y="6" width="26" height="23" rx="3" fill="rgba(212,168,67,0.12)" stroke="#d4a843" strokeWidth="1.5"/>
              <line x1="3" y1="13" x2="29" y2="13" stroke="#d4a843" strokeWidth="1.5"/>
              <line x1="10" y1="3" x2="10" y2="9" stroke="#d4a843" strokeWidth="2" strokeLinecap="round"/>
              <line x1="22" y1="3" x2="22" y2="9" stroke="#d4a843" strokeWidth="2" strokeLinecap="round"/>
              <rect x="8" y="17" width="4" height="3" rx="1" fill="#d4a843" opacity="0.8"/>
              <rect x="14" y="17" width="4" height="3" rx="1" fill="#d4a843" opacity="0.5"/>
              <rect x="20" y="17" width="4" height="3" rx="1" fill="#d4a843" opacity="0.3"/>
              <rect x="8" y="22" width="4" height="3" rx="1" fill="#d4a843" opacity="0.5"/>
              <rect x="14" y="22" width="4" height="3" rx="1" fill="#d4a843" opacity="0.3"/>
            </svg>
          </div>
          <div>
            <h1 className="login-title font-display">Planning Viewer</h1>
            <p className="login-subtitle">Espace de consultation sécurisé</p>
          </div>
        </div>

        <div className="login-card">
          <h2 className="login-card-title font-display">Connexion</h2>
          <p className="login-card-desc">Accédez à votre espace documentaire</p>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label className="form-label">Identifiant</label>
              <div className="input-wrapper">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  className="input input-icon"
                  type="text"
                  placeholder="votre identifiant"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <div className="input-wrapper">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  className="input input-icon"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary btn-full"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <><span className="spinner" /> Connexion...</>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Se connecter
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>Accès réservé. Contactez l'administrateur pour obtenir vos identifiants.</p>
          </div>
        </div>

        <div className="login-version">Planning Viewer v1.0 · Sécurisé</div>

        <div className="login-footer-logo">
          <img src="/logo-aa.png" alt="Logo" className="footer-logo-img" />
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 24px;
        }
        .login-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
        }
        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.12;
        }
        .login-orb-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, #d4a843, transparent);
          top: -200px; right: -200px;
        }
        .login-orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #3b82f6, transparent);
          bottom: -100px; left: -100px;
        }
        .grid-pattern {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .login-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .login-logo {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .logo-icon {
          width: 52px; height: 52px;
          background: rgba(212,168,67,0.08);
          border: 1px solid rgba(212,168,67,0.2);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-title {
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }
        .login-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .login-card {
          background: var(--bg-card);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-xl);
          padding: 32px;
          box-shadow: var(--shadow-lg), 0 0 60px rgba(212,168,67,0.04);
        }
        .login-card-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 6px;
        }
        .login-card-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 28px;
        }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 8px; }
        .form-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-wrapper svg {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
          pointer-events: none;
          flex-shrink: 0;
        }
        .input.input-icon {
          padding-left: 40px;
          padding-right: 40px;
        }
        .password-toggle {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 15px;
          padding: 4px;
          line-height: 1;
        }
        .btn-full { width: 100%; justify-content: center; padding: 13px; margin-top: 4px; }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(0,0,0,0.2);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }
        .login-footer {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid var(--border);
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.5;
        }
        .login-version {
          text-align: center;
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }
        .login-footer-logo {
          display: flex;
          justify-content: center;
          padding-top: 4px;
        }
        .footer-logo-img {
          height: 36px;
          width: auto;
          opacity: 0.55;
          transition: opacity 0.2s;
        }
        .footer-logo-img:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}
