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
      ) {
        e.preventDefault()
        toast.error('Action non autorisée')
      }
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
          document_id: docId,
          user_id: user.id,
          device_type: deviceType,
          device_info: deviceInfo,
          duration_seconds: duration
        }).then(() => {})
      }
    }
  }, [docId, user])

  useEffect(() => {
    loadDocument()
  }, [docId])

  async function loadDocument() {
    try {
      setLoading(true)
      setError(null)

      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .select('*, folders(name, is_active)')
        .eq('id', docId)
        .single()

      if (docErr || !doc) throw new Error('Document introuvable')
      if (!doc.is_active) throw new Error('Ce document n\'est plus disponible')
      if (doc.folder_id && doc.folders?.is_active === false) throw new Error('Ce document n\'est plus disponible')
      setDocInfo(doc)

      const { data: urlData, error: urlErr } = await supabase.storage
        .from('pdfs')
        .createSignedUrl(doc.file_path, 3600)

      if (urlErr || !urlData?.signedUrl) throw new Error('Accès au fichier refusé')

      setPdfUrl(urlData.signedUrl)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'var(--bg-primary)',userSelect:'none'}}>

      <header style={{
        display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'0 20px',height:56,background:'var(--bg-secondary)',
        borderBottom:'1px solid var(--border)',flexShrink:0,gap:16
      }}>
        <div style={{display:'flex',alignItems:'center',gap:16,flex:1,minWidth:0}}>
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
            Retour
          </button>
          {docInfo && (
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-secondary)',overflow:'hidden'}}>
              <span>{docInfo.folders?.name}</span>
              <span>›</span>
              <span style={{color:'var(--text-primary)',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {docInfo.title}
              </span>
            </div>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--text-muted)',background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:99,padding:'4px 12px'}}>
          Document protégé
        </div>
      </header>

      <div style={{flex:1,overflow:'hidden',background:'#1a1f2e',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {loading && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,color:'var(--text-secondary)'}}>
            <div style={{width:36,height:36,border:'3px solid var(--border)',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
            <p>Chargement du document...</p>
          </div>
        )}

        {error && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,color:'var(--text-secondary)',textAlign:'center',padding:24}}>
            <h3 style={{color:'var(--text-primary)'}}>Impossible d'ouvrir ce document</h3>
            <p style={{fontSize:13}}>{error}</p>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Retour</button>
          </div>
        )}

        {!loading && !error && pdfUrl && (
          <iframe
            src={pdfUrl + '#toolbar=0&navpanes=0'}
            style={{width:'100%',height:'100%',border:'none'}}
            title={docInfo?.title}
          />
        )}
      </div>
      <footer style={{position:'fixed',bottom:12,right:16,zIndex:50,pointerEvents:'none'}}>
        <img src="/logo-aa.png" alt="Logo" style={{height:32,width:'auto',opacity:0.3,pointerEvents:'all'}} />
      </footer>
    </div>
  )
}
