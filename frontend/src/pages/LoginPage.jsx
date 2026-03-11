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
    if (!username || !password) { toast.error('Veuillez remplir tous les champs'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_user_status', { p_username: username.toLowerCase().trim() })
      if (error || !data || data.length === 0) { toast.error('Identifiant introuvable'); setLoading(false); return }
      const { email, is_active } = data[0]
      if (!is_active) { toast.error("Votre compte est désactivé, contactez l'administrateur", { duration: 6000 }); setLoading(false); return }
      await signIn(email, password)
      navigate('/dashboard')
    } catch { toast.error('Identifiant ou mot de passe incorrect') }
    finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      {/* Chèvre filigrane — collée à gauche, style sidebar */}
      <img src="/tete-chevre.png" alt="" className="login-goat-watermark" />

      <div className="login-container animate-fade-in">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-badge">
            <img src="/tete-chevre.png" alt="Soignon" className="login-goat-badge" />
          </div>
          <div>
            <h1 className="login-title">Planning Viewer</h1>
            <p className="login-subtitle">SOIGNON · EURIAL · AGRIAL</p>
          </div>
        </div>

        {/* Card blanche */}
        <div className="login-card">
          <div className="login-card-stripe" />
          <h2 className="login-card-title">Bonjour 👋</h2>
          <p className="login-card-desc">Connectez-vous pour accéder à vos documents</p>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label className="form-label">Identifiant</label>
              <div className="input-wrapper">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input className="input input-icon" type="text" placeholder="votre identifiant" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <div className="input-wrapper">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input className="input input-icon" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading
                ? <><span className="spinner" /> Connexion...</>
                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Se connecter</>
              }
            </button>
          </form>

          <div className="login-footer-text">
            Accès réservé · Contactez l'administrateur pour vos identifiants.
          </div>
        </div>

        <div className="login-version">Planning Viewer · Sécurisé</div>
      </div>

      {/* Logo AA fixe en bas à droite */}
      <footer className="app-footer">
        <img src="/logo-aa.png" alt="Logo" className="footer-logo-img" />
      </footer>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 24px;
          overflow: hidden;
          font-family: var(--font-body);
          background: var(--green-deep);
          background-image: linear-gradient(160deg, var(--green) 0%, var(--green-deep) 100%);
        }
        /* Halo derrière la chèvre */
        .login-page::before {
          content: '';
          position: fixed;
          left: -100px; top: 50%;
          transform: translateY(-50%);
          width: 600px; height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(92,158,82,0.25) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }
        /* Liseré rouge Soignon en haut */
        .login-page::after {
          content: '';
          position: fixed;
          top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, var(--red), var(--red-bright) 50%, var(--straw));
          z-index: 10;
        }
        /* Chèvre filigrane — même traitement que sidebar */
        .login-goat-watermark {
          position: fixed;
          left: -55px;
          top: 50%;
          transform: translateY(-50%);
          height: 88vh;
          max-height: 720px;
          width: auto;
          opacity: 0.13;
          pointer-events: none;
          z-index: 0;
          filter: saturate(0) brightness(2.5);
          mix-blend-mode: lighten;
          user-select: none;
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
        .login-logo { display: flex; align-items: center; gap: 14px; }
        .login-logo-badge {
          width: 54px; height: 54px;
          background: rgba(212,168,75,0.18);
          border: 1.5px solid rgba(212,168,75,0.35);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        }
        .login-goat-badge { height: 62px; margin-top: 6px; mix-blend-mode: lighten; opacity: 0.92; }
        .login-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: white; }
        .login-subtitle { font-size: 10px; color: rgba(255,255,255,0.45); margin-top: 3px; letter-spacing: 0.1em; }
        .login-card {
          background: var(--white);
          border-radius: var(--r-xl);
          padding: 36px 32px;
          box-shadow: 0 16px 56px rgba(30,42,26,0.22);
          position: relative;
        }
        .login-card-stripe {
          position: absolute; top: 0; left: 0; right: 0; height: 5px;
          background: linear-gradient(90deg, var(--red), var(--red-bright) 55%, var(--straw));
          border-radius: var(--r-xl) var(--r-xl) 0 0;
        }
        .login-card-title { font-family: var(--font-display); font-size: 24px; font-style: italic; font-weight: 600; color: var(--text); margin-bottom: 5px; }
        .login-card-desc { font-size: 13px; color: var(--text-soft); margin-bottom: 26px; }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 7px; }
        .form-label { font-size: 12px; font-weight: 700; color: var(--text-mid); }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-wrapper svg { position: absolute; left: 14px; color: var(--text-light); pointer-events: none; }
        .input.input-icon { padding-left: 40px; padding-right: 42px; }
        .password-toggle { position: absolute; right: 12px; background: transparent; border: none; cursor: pointer; font-size: 15px; padding: 4px; }
        .btn-full { width: 100%; justify-content: center; padding: 14px; margin-top: 4px; font-size: 15px; }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; }
        .login-footer-text { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-light); text-align: center; line-height: 1.5; }
        .login-version { text-align: center; font-size: 11px; color: rgba(255,255,255,0.25); }
        .app-footer { position: fixed; bottom: 12px; right: 16px; z-index: 50; pointer-events: none; }
        .footer-logo-img { height: 30px; width: auto; opacity: 0.3; transition: opacity 0.2s; pointer-events: all; }
        .footer-logo-img:hover { opacity: 0.65; }
        @media (max-width: 600px) {
          .login-goat-watermark { height: 55vh; left: -80px; opacity: 0.08; }
        }
      `}</style>
    </div>
  )
}
