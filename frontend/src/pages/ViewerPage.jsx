import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getDeviceInfo } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import * as pdfjsLib from 'pdfjs-dist'

// Configurer PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export default function ViewerPage() {
  const { docId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const viewStartRef = useRef(Date.now())

  const [document, setDocument] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState(null)

  // Protection: désactiver clic droit
  useEffect(() => {
    const preventContextMenu = (e) => e.preventDefault()
    const preventKeyShortcuts = (e) => {
      // Bloquer Ctrl+S, Ctrl+P, Ctrl+Shift+I, F12
      if (
        (e.ctrlKey && (e.key === 's' || e.key === 'p' || e.key === 'u')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        e.key === 'F12'
      ) {
        e.preventDefault()
        toast.error('Action non autorisée')
      }
    }
    const preventDragDrop = (e) => e.preventDefault()
    const preventSelect = (e) => e.preventDefault()

    window.addEventListener('contextmenu', preventContextMenu)
    window.addEventListener('keydown', preventKeyShortcuts)
    window.addEventListener('dragstart', preventDragDrop)
    document.addEventListener('selectstart', preventSelect)

    return () => {
      window.removeEventListener('contextmenu', preventContextMenu)
      window.removeEventListener('keydown', preventKeyShortcuts)
      window.removeEventListener('dragstart', preventDragDrop)
      document.removeEventListener('selectstart', preventSelect)
    }
  }, [])

  // Enregistrer la consultation au départ
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

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage)
  }, [pdfDoc, currentPage, scale])

  async function loadDocument() {
    try {
      // Charger les infos du document
      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .select('*, folders(name)')
        .eq('id', docId)
        .single()

      if (docErr || !doc) throw new Error('Document introuvable')
      setDocument(doc)

      // Obtenir l'URL signée du PDF (accès temporaire 1h)
      const { data: urlData, error: urlErr } = await supabase.storage
        .from('pdfs')
        .createSignedUrl(doc.file_path, 3600)

      if (urlErr || !urlData?.signedUrl) throw new Error('Accès au fichier refusé')

      // Charger le PDF
      const loadingTask = pdfjsLib.getDocument({
        url: urlData.signedUrl,
        disableAutoFetch: false,
        disableStream: false,
      })

      const pdf = await loadingTask.promise
      setPdfDoc(pdf)
      setTotalPages(pdf.numPages)
    } catch (err) {
      console.error(err)
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function renderPage(pageNum) {
    if (!pdfDoc || !canvasRef.current) return
    setRendering(true)
    try {
      const page = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({ canvasContext: context, viewport }).promise
    } catch (err) {
      console.error('Erreur rendu:', err)
    } finally {
      setRendering(false)
    }
  }

  function prevPage() { if (currentPage > 1) setCurrentPage(p => p - 1) }
  function nextPage() { if (currentPage < totalPages) setCurrentPage(p => p + 1) }
  function zoomIn() { setScale(s => Math.min(s + 0.2, 3)) }
  function zoomOut() { setScale(s => Math.max(s - 0.2, 0.5)) }

  return (
    <div className="viewer-page">
      {/* Watermark invisible */}
      <div className="watermark">{user?.email}</div>

      {/* Toolbar */}
      <header className="viewer-header">
        <div className="viewer-header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Retour
          </button>
          {document && (
            <div className="doc-breadcrumb">
              <span>{document.folders?.name}</span>
              <span>›</span>
              <span className="doc-breadcrumb-title">{document.title}</span>
            </div>
          )}
        </div>

        <div className="viewer-controls">
          {/* Pagination */}
          <button className="ctrl-btn" onClick={prevPage} disabled={currentPage <= 1 || rendering}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="page-info">
            {totalPages > 0 ? `${currentPage} / ${totalPages}` : '—'}
          </span>
          <button className="ctrl-btn" onClick={nextPage} disabled={currentPage >= totalPages || rendering}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          <div className="ctrl-divider" />

          {/* Zoom */}
          <button className="ctrl-btn" onClick={zoomOut} disabled={scale <= 0.5}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <span className="zoom-info">{Math.round(scale * 100)}%</span>
          <button className="ctrl-btn" onClick={zoomIn} disabled={scale >= 3}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
        </div>

        <div className="viewer-header-right">
          <div className="protected-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Document protégé
          </div>
        </div>
      </header>

      {/* Viewer area */}
      <div className="viewer-area" ref={containerRef}>
        {loading && (
          <div className="viewer-loading">
            <div className="loading-spinner" />
            <p>Chargement du document...</p>
          </div>
        )}

        {error && (
          <div className="viewer-error">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h3>Impossible d'ouvrir ce document</h3>
            <p>{error}</p>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
              Retour au tableau de bord
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="canvas-wrapper">
            {rendering && (
              <div className="page-loading">
                <div className="loading-spinner small" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="pdf-canvas"
              style={{ opacity: rendering ? 0.5 : 1 }}
            />
          </div>
        )}
      </div>

      {/* Keyboard shortcuts info */}
      {totalPages > 0 && (
        <div className="viewer-footer">
          <span>← → pour naviguer • + − pour zoomer</span>
          <span>Page {currentPage} sur {totalPages}</span>
        </div>
      )}

      <style>{`
        .viewer-page {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--bg-primary);
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
        }
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 18px;
          color: rgba(255,255,255,0.03);
          pointer-events: none;
          z-index: 1000;
          white-space: nowrap;
          letter-spacing: 2px;
          font-weight: 700;
        }
        .viewer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          height: 56px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          gap: 16px;
          flex-shrink: 0;
          z-index: 50;
        }
        .viewer-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }
        .doc-breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-secondary);
          overflow: hidden;
        }
        .doc-breadcrumb-title {
          color: var(--text-primary);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .viewer-controls {
          display: flex;
          align-items: center;
          gap: 4px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius);
          padding: 6px 10px;
        }
        .ctrl-btn {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition);
        }
        .ctrl-btn:hover:not(:disabled) {
          background: var(--bg-card);
          color: var(--text-primary);
        }
        .ctrl-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-info, .zoom-info {
          font-size: 13px;
          color: var(--text-secondary);
          min-width: 60px;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }
        .ctrl-divider {
          width: 1px;
          height: 20px;
          background: var(--border);
          margin: 0 4px;
        }
        .viewer-header-right {}
        .protected-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--text-muted);
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 99px;
          padding: 4px 10px;
        }
        .viewer-area {
          flex: 1;
          overflow: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 24px;
          background: #1a1f2e;
        }
        .viewer-loading, .viewer-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          color: var(--text-secondary);
          min-height: 300px;
          text-align: center;
        }
        .viewer-error h3 { font-family: var(--font-display); font-size: 18px; color: var(--text-primary); }
        .viewer-error p { font-size: 13px; }
        .loading-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .loading-spinner.small {
          width: 20px;
          height: 20px;
          border-width: 2px;
        }
        .canvas-wrapper {
          position: relative;
          box-shadow: var(--shadow-lg);
        }
        .page-loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
        }
        .pdf-canvas {
          display: block;
          transition: opacity var(--transition);
          pointer-events: none;
        }
        .viewer-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 20px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
          font-size: 11px;
          color: var(--text-muted);
          flex-shrink: 0;
        }
        @media (max-width: 768px) {
          .doc-breadcrumb { display: none; }
          .viewer-header { padding: 0 12px; }
          .viewer-header-right { display: none; }
          .viewer-area { padding: 12px; }
        }
      `}</style>
    </div>
  )
}
