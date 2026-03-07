import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const { profile, isAdmin, signOut } = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead, requestPushPermission, subscribePush } = useNotifications()
  const navigate = useNavigate()
  const [folders, setFolders] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [newDocStatus, setNewDocStatus] = useState({})
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
    loadNewDocStatus()
    requestPushPermission().then(granted => {
      if (granted) subscribePush()
    })
  }, [])

  async function loadData() {
    try {
      const [foldersRes, docsRes] = await Promise.all([
        supabase.from('folders').select('*').order('year', { ascending: false }),
        supabase.from('documents').select('*, folders(name, year)')
          .eq('is_active', true)
          .order('published_at', { ascending: false })
      ])

      if (foldersRes.data) setFolders(foldersRes.data)
      if (docsRes.data) setDocuments(docsRes.data)
    } catch (err) {
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  async function loadNewDocStatus() {
    const { data } = await supabase
      .from('user_document_status')
      .select('document_id, is_new')

    if (data) {
      const status = {}
      data.forEach(s => { status[s.document_id] = s.is_new })
      setNewDocStatus(status)
    }
  }

  async function openDocument(doc) {
    navigate(`/viewer/${doc.id}`)
    // Marquer comme lu
    if (newDocStatus[doc.id]) {
      await supabase.rpc('mark_document_viewed', { doc_id: doc.id })
      setNewDocStatus(prev => ({ ...prev, [doc.id]: false }))
    }
  }

  const filteredDocs = documents.filter(doc => {
    const matchesFolder = selectedFolder ? doc.folder_id === selectedFolder : true
    const matchesSearch = searchQuery
      ? doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true
    return matchesFolder && matchesSearch
  })

  const newDocsCount = Object.values(newDocStatus).filter(Boolean).length

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon-sm">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="2" width="18" height="24" rx="2" fill="rgba(212,168,67,0.2)" stroke="#d4a843" strokeWidth="1.5"/>
              <rect x="10" y="6" width="16" height="22" rx="2" fill="rgba(212,168,67,0.1)" stroke="rgba(212,168,67,0.3)" strokeWidth="1"/>
            </svg>
          </div>
          <span className="font-display sidebar-brand">PDF Vault</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          <button
            className={`nav-item ${!selectedFolder ? 'active' : ''}`}
            onClick={() => setSelectedFolder(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            Tous les documents
            {filteredDocs.length > 0 && <span className="nav-badge">{documents.length}</span>}
          </button>

          <div className="nav-section-label" style={{marginTop: 16}}>Années</div>
          {folders.map(folder => (
            <button
              key={folder.id}
              className={`nav-item ${selectedFolder === folder.id ? 'active' : ''}`}
              onClick={() => setSelectedFolder(folder.id)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              {folder.name}
              <span className="nav-badge">
                {documents.filter(d => d.folder_id === folder.id).length}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {isAdmin && (
            <button className="nav-item admin-link" onClick={() => navigate('/admin')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Administration
            </button>
          )}
          <div className="user-info">
            <div className="user-avatar">{profile?.full_name?.[0] || profile?.email?.[0] || '?'}</div>
            <div className="user-details">
              <div className="user-name">{profile?.full_name || 'Utilisateur'}</div>
              <div className="user-role">{isAdmin ? 'Administrateur' : 'Utilisateur'}</div>
            </div>
            <button className="btn-ghost icon-btn" onClick={signOut} title="Déconnexion">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <h2 className="font-display page-title">
              {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Tous les documents'}
            </h2>
            {newDocsCount > 0 && (
              <span className="badge-new">{newDocsCount} nouveau{newDocsCount > 1 ? 'x' : ''}</span>
            )}
          </div>

          <div className="topbar-right">
            <div className="search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Notifications */}
            <div className="notif-wrapper">
              <button
                className="btn-ghost icon-btn notif-btn"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
              </button>

              {showNotifications && (
                <div className="notif-panel">
                  <div className="notif-header">
                    <span className="font-display">Notifications</span>
                    {unreadCount > 0 && (
                      <button className="btn-ghost" style={{fontSize: 12, padding: '4px 8px'}} onClick={markAllAsRead}>
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">Aucune notification</div>
                    ) : notifications.map(notif => (
                      <div
                        key={notif.id}
                        className={`notif-item ${!notif.is_read ? 'unread' : ''}`}
                        onClick={() => markAsRead(notif.id)}
                      >
                        <div className="notif-title">{notif.title}</div>
                        <div className="notif-msg">{notif.message}</div>
                        <div className="notif-time">
                          {format(new Date(notif.created_at), 'dd MMM HH:mm', { locale: fr })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Documents grid */}
        {loading ? (
          <div className="grid-auto" style={{padding: '24px'}}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{height: 160}} />
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <h3>Aucun document</h3>
            <p>{searchQuery ? 'Aucun résultat pour votre recherche' : 'Aucun document disponible pour le moment'}</p>
          </div>
        ) : (
          <div className="docs-grid">
            {filteredDocs.map(doc => (
              <button
                key={doc.id}
                className="doc-card"
                onClick={() => openDocument(doc)}
              >
                <div className="doc-card-header">
                  <div className="doc-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="rgba(212,168,67,0.1)" stroke="#d4a843" strokeWidth="1.5"/>
                      <polyline points="14 2 14 8 20 8" stroke="#d4a843" strokeWidth="1.5" fill="none"/>
                      <line x1="9" y1="13" x2="15" y2="13" stroke="rgba(212,168,67,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="9" y1="17" x2="13" y2="17" stroke="rgba(212,168,67,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="doc-meta-top">
                    {newDocStatus[doc.id] && <span className="badge-new">Nouveau</span>}
                    {doc.version > 1 && (
                      <span className="version-badge">v{doc.version}</span>
                    )}
                  </div>
                </div>

                <div className="doc-card-body">
                  <h3 className="doc-title">{doc.title}</h3>
                  {doc.description && (
                    <p className="doc-desc">{doc.description}</p>
                  )}
                </div>

                <div className="doc-card-footer">
                  <span className="doc-folder">{doc.folders?.name}</span>
                  <span className="doc-date">
                    {format(new Date(doc.published_at), 'dd MMM yyyy', { locale: fr })}
                  </span>
                </div>

                <div className="doc-hover-overlay">
                  <span>Ouvrir le document</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <style>{`
        .dashboard {
          display: flex;
          min-height: 100vh;
          background: var(--bg-primary);
        }
        .sidebar {
          width: 260px;
          min-height: 100vh;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 0;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 100;
          overflow-y: auto;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 20px 20px 16px;
          border-bottom: 1px solid var(--border);
        }
        .logo-icon-sm {
          width: 36px;
          height: 36px;
          background: rgba(212,168,67,0.08);
          border: 1px solid rgba(212,168,67,0.2);
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sidebar-brand {
          font-size: 17px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }
        .sidebar-nav {
          flex: 1;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .nav-section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-muted);
          padding: 0 8px;
          margin-bottom: 4px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--radius);
          font-size: 14px;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all var(--transition);
          text-align: left;
          width: 100%;
        }
        .nav-item:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }
        .nav-item.active {
          background: var(--accent-dim);
          color: var(--accent);
          border: 1px solid var(--accent-border);
        }
        .nav-badge {
          margin-left: auto;
          font-size: 11px;
          padding: 2px 6px;
          background: var(--bg-primary);
          border-radius: 99px;
          color: var(--text-muted);
        }
        .admin-link {
          color: var(--blue-light) !important;
        }
        .sidebar-bottom {
          border-top: 1px solid var(--border);
          padding: 12px;
        }
        .user-info {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 8px;
          border-radius: var(--radius);
          margin-top: 4px;
        }
        .user-avatar {
          width: 34px;
          height: 34px;
          background: var(--accent-dim);
          border: 1px solid var(--accent-border);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: var(--accent);
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .user-details { flex: 1; min-width: 0; }
        .user-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-role {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 1px;
        }
        .icon-btn {
          padding: 8px;
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .main-content {
          flex: 1;
          margin-left: 260px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 28px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
          position: sticky;
          top: 0;
          z-index: 50;
          gap: 16px;
        }
        .topbar-left { display: flex; align-items: center; gap: 12px; }
        .topbar-right { display: flex; align-items: center; gap: 8px; }
        .page-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-input);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius);
          padding: 8px 14px;
        }
        .search-box svg { color: var(--text-muted); flex-shrink: 0; }
        .search-input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 13px;
          font-family: var(--font-body);
          width: 180px;
        }
        .search-input::placeholder { color: var(--text-muted); }
        .notif-wrapper { position: relative; }
        .notif-btn { position: relative; }
        .notif-dot {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 18px;
          height: 18px;
          background: var(--error);
          border-radius: 50%;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--bg-secondary);
        }
        .notif-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 320px;
          background: var(--bg-card);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          z-index: 200;
          animation: fadeIn 0.15s ease;
        }
        .notif-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .notif-list { max-height: 360px; overflow-y: auto; }
        .notif-item {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          transition: background var(--transition);
        }
        .notif-item:hover { background: var(--bg-elevated); }
        .notif-item.unread { background: rgba(212,168,67,0.04); }
        .notif-title { font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 3px; }
        .notif-msg { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
        .notif-time { font-size: 11px; color: var(--text-muted); }
        .notif-empty { padding: 32px 16px; text-align: center; font-size: 13px; color: var(--text-muted); }
        .docs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          padding: 24px 28px;
        }
        .doc-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px;
          cursor: pointer;
          transition: all 0.25s ease;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          overflow: hidden;
        }
        .doc-card:hover {
          border-color: var(--accent-border);
          transform: translateY(-3px);
          box-shadow: var(--shadow-md), var(--shadow-accent);
        }
        .doc-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }
        .doc-icon {
          width: 44px;
          height: 44px;
          background: rgba(212,168,67,0.06);
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .doc-meta-top { display: flex; gap: 6px; align-items: center; }
        .version-badge {
          font-size: 10px;
          padding: 2px 7px;
          background: var(--blue-dim);
          border: 1px solid rgba(59,130,246,0.2);
          color: var(--blue-light);
          border-radius: 99px;
          font-weight: 600;
        }
        .doc-card-body { flex: 1; }
        .doc-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.4;
          margin-bottom: 6px;
        }
        .doc-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .doc-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-muted);
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .doc-folder { 
          background: var(--bg-elevated);
          padding: 2px 8px;
          border-radius: 99px;
        }
        .doc-hover-overlay {
          position: absolute;
          inset: 0;
          background: rgba(212,168,67,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--accent);
          opacity: 0;
          transition: opacity var(--transition);
          border-radius: var(--radius-lg);
        }
        .doc-card:hover .doc-hover-overlay { opacity: 1; }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 24px;
          color: var(--text-muted);
          text-align: center;
          gap: 12px;
        }
        .empty-state h3 { font-size: 17px; color: var(--text-secondary); font-family: var(--font-display); }
        .empty-state p { font-size: 13px; }
        @media (max-width: 768px) {
          .sidebar { 
            transform: translateX(-100%);
            transition: transform var(--transition);
          }
          .main-content { margin-left: 0; }
          .docs-grid { grid-template-columns: 1fr; padding: 16px; }
          .topbar { padding: 16px; }
          .search-input { width: 120px; }
        }
      `}</style>
    </div>
  )
}
