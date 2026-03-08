import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getDeviceInfo } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function ViewerPage() {
  const { docId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const viewStartRef = { current: Date.now() }

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
        const duration = Math.floor((Date.now() - viewStartRef.current) / 1000)
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
        .select('*, folders(name)')
        .eq('id', docId)
        .single()

      if (docErr || !doc) throw new Error('Document introuvable')
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

      {/* Header */}
      <header style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px', height:56, background:'var(--bg-secondary)',
        borderBottom:'1px solid var(--border)', flexShrink:0, gap:16
      }}>
        <div style={{display:'flex',alignItems:'center',gap:16,flex:1,minWidth:0}}>
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Document protégé
        </div>
      </header>

      {/* Contenu */}
      <div style={{flex:1,overflow:'hidden',background:'#1a1f2e',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {loading && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,color:'var(--text-secondary)'}}>
            <div style={{width:36,height:36,border:'3px solid var(--border)',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
            <p>Chargement du document...</p>
          </div>
        )}

        {error && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,color:'var(--text-secondary)',textAlign:'center',padding:24}}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
