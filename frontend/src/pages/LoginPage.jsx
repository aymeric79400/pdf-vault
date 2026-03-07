import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs')
      return
    }
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      toast.error('Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Fond animé */}
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="grid-pattern" />
      </div>

      <div className="login-container animate-fade-in">
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="2" width="18" height="24" rx="2" fill="rgba(212,168,67,0.15)" stroke="#d4a843" strokeWidth="1.5"/>
              <rect x="10" y="6" width="20" height="24" rx="2" fill="rgba(212,168,67,0.08)" stroke="rgba(212,168,67,0.4)" strokeWidth="1.5"/>
              <line x1="8" y1="10" x2="18" y2="10" stroke="#d4a843" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="14" x2="18" y2="14" stroke="rgba(212,168,67,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="18" x2="14" y2="18" stroke="rgba(212,168,67,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="login-title font-display">PDF Vault</h1>
            <p className="login-subtitle">Espace de consultation sécurisé</p>
          </div>
        </div>

        {/* Formulaire */}
        <div className="login-card">
          <h2 className="login-card-title font-display">Connexion</h2>
          <p className="login-card-desc">Accédez à votre espace documentaire</p>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label className="form-label">Adresse email</label>
              <input
                className="input"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              className="btn btn-primary btn-full"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Connexion...
                </>
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

        <div className="login-version">PDF Vault v1.0 · Sécurisé</div>
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
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, #d4a843, transparent);
          top: -200px;
          right: -200px;
        }
        .login-orb-2 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, #3b82f6, transparent);
          bottom: -100px;
          left: -100px;
        }
        .grid-pattern {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
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
          width: 52px;
          height: 52px;
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
        .form-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
        }
        .btn-full { width: 100%; justify-content: center; padding: 13px; margin-top: 4px; }
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0,0,0,0.2);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
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
      `}</style>
    </div>
  )
}
