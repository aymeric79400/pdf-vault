import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getDeviceInfo } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function ViewerPage() {
  const { docId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const viewStart = useRef(Date.now())

  const [docInfo, setDocInfo] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const preventContextMenu = (e) => e.preventDefault()
    const preventKeys = (e) => {
      if (
        (e.ctrlKey && ['s','p','u'].includes(e.key)) ||
        (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) ||
        e.key === 'F12'
      ) { e.preventDefault(); toast.error('Action non autorisée') }
    }
    window.addEventListener('contextmenu', preventContextMenu)
    window.addEventListener('keydown', preventKeys)
    return () => {
      window.removeEventListener('contextmenu', preventContextMenu)
      window.removeEventListener('keydown', preventKeys)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (user && docId) {
        const duration = Math.floor((Date.now() - viewStart.current) / 1000)
        const { deviceType, deviceInfo } = getDeviceInfo()
        supabase.from('document_views').insert({
          document_id: docId, user_id: user.id,
          device_type: deviceType, device_info: deviceInfo, duration_seconds: duration
        }).then(() => {})
      }
    }
  }, [docId, user])

  useEffect(() => { loadDocument() }, [docId])

  async function loadDocument() {
    try {
      setLoading(true); setError(null)
      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .select('*, document_folders(folder_id, folders(id, name, is_active))')
        .eq('id', docId).single()
      if (docErr || !doc) throw new Error('Document introuvable')
      if (!doc.is_active) throw new Error("Ce document n'est plus disponible")
      // Vérifier que tous les dossiers associés sont actifs
      const hasInactiveFolder = (doc.document_folders || []).some(df => df.folders?.is_active === false)
      if (hasInactiveFolder) throw new Error("Ce document n'est plus disponible")
      setDocInfo(doc)
      const { data: urlData, error: urlErr } = await supabase.storage.from('pdfs').createSignedUrl(doc.file_path, 3600)
      if (urlErr || !urlData?.signedUrl) throw new Error('Accès au fichier refusé')
      setPdfUrl(urlData.signedUrl)
    } catch (err) { console.error(err); setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="viewer-page">

      {/* Header vert Soignon */}
      <header className="viewer-header">
        <div className="viewer-header-left">
          <button className="viewer-back-btn" onClick={() => navigate('/dashboard')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Retour
          </button>
          {docInfo && (
            <div className="viewer-breadcrumb">
              <span className="breadcrumb-folder">{(docInfo.document_folders?.[0]?.folders?.name) || ''}</span>
              <span className="breadcrumb-sep">›</span>
              <span className="breadcrumb-title">{docInfo.title}</span>
            </div>
          )}
        </div>
        <div className="viewer-header-right">
          <div className="viewer-protected-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Document protégé
          </div>
        </div>
      </header>

      {/* Liseré rouge sous le header */}
      <div className="viewer-stripe" />

      {/* Zone PDF */}
      <div className="viewer-body">
        {loading && (
          <div className="viewer-state">
            <div className="viewer-spinner" />
            <p>Chargement du document...</p>
          </div>
        )}
        {error && (
          <div className="viewer-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{opacity:0.4}}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <h3>Impossible d'ouvrir ce document</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>← Retour</button>
          </div>
        )}
        {!loading && !error && pdfUrl && (
          <iframe
            src={pdfUrl + '#toolbar=0&navpanes=0'}
            style={{width:'100%', height:'100%', border:'none'}}
            title={docInfo?.title}
          />
        )}
      </div>

      <footer className="app-footer">
        <img src="/logo-aa.png" alt="Logo" className="footer-logo-img" />
      </footer>

      <style>{`
        .viewer-page { display:flex; flex-direction:column; height:100vh; background:var(--cream); user-select:none; }

        .viewer-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:0 20px; height:54px; flex-shrink:0;
          background:var(--green-deep);
          background-image:linear-gradient(160deg, var(--green) 0%, var(--green-deep) 100%);
          gap:16px;
        }
        .viewer-header-left { display:flex; align-items:center; gap:14px; flex:1; min-width:0; }
        .viewer-header-right { flex-shrink:0; }

        .viewer-back-btn {
          display:flex; align-items:center; gap:5px;
          background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15);
          border-radius:8px; padding:6px 12px; color:rgba(255,255,255,0.85);
          font-family:var(--font-body); font-size:13px; font-weight:600;
          cursor:pointer; transition:all 0.15s; flex-shrink:0;
        }
        .viewer-back-btn:hover { background:rgba(255,255,255,0.18); color:white; }

        .viewer-breadcrumb { display:flex; align-items:center; gap:7px; font-size:13px; overflow:hidden; }
        .breadcrumb-folder { color:rgba(255,255,255,0.45); white-space:nowrap; flex-shrink:0; }
        .breadcrumb-sep { color:rgba(255,255,255,0.25); flex-shrink:0; }
        .breadcrumb-title { color:rgba(255,255,255,0.85); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        .viewer-protected-badge {
          display:flex; align-items:center; gap:6px;
          background:rgba(212,168,75,0.15); border:1px solid rgba(212,168,75,0.3);
          border-radius:99px; padding:5px 12px;
          font-size:11px; font-weight:700; color:rgba(240,192,96,0.9);
          letter-spacing:0.03em;
        }

        .viewer-stripe { height:3px; background:linear-gradient(90deg, var(--red), var(--red-bright) 50%, var(--straw)); flex-shrink:0; }

        .viewer-body { flex:1; overflow:hidden; background:#1a1e16; display:flex; align-items:center; justify-content:center; }

        .viewer-state {
          display:flex; flex-direction:column; align-items:center; gap:14px;
          color:rgba(255,255,255,0.5); text-align:center; padding:24px;
        }
        .viewer-state h3 { font-family:var(--font-display); font-size:17px; color:rgba(255,255,255,0.75); }
        .viewer-state p { font-size:13px; max-width:300px; }

        .viewer-spinner {
          width:36px; height:36px;
          border:3px solid rgba(255,255,255,0.1);
          border-top-color:var(--straw);
          border-radius:50%; animation:spin 0.8s linear infinite;
        }

        .app-footer { position:fixed; bottom:12px; right:16px; z-index:50; pointer-events:none; }
        .footer-logo-img { height:30px; width:auto; opacity:0.3; transition:opacity 0.2s; pointer-events:all; }
        .footer-logo-img:hover { opacity:0.65; }
      `}</style>
    </div>
  )
}
