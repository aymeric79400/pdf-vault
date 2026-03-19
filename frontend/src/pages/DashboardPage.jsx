import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

const SIDEBAR_STYLES = `
  .dashboard { display:flex; min-height:100vh; background:var(--cream); }

  /* ── SIDEBAR ── */
  .sidebar {
    width:258px; min-height:100vh;
    background: var(--green-deep);
    background-image: linear-gradient(175deg, var(--green) 0%, var(--green-deep) 100%);
    display:flex; flex-direction:column;
    position:fixed; top:0; left:0; bottom:0; z-index:100;
    overflow:hidden;
  }
  /* Chèvre en filigrane */
  .sidebar-goat {
    position:absolute; bottom:44px; right:-18px;
    height:155px; pointer-events:none;
    opacity:0.13; filter:saturate(0) brightness(2.5);
    mix-blend-mode:lighten;
    z-index:0;
  }
  /* Logo vert avec chèvre */
  .sidebar-logo {
    display:flex; align-items:center; gap:10px;
    padding:18px 16px 14px;
    border-bottom:1px solid rgba(255,255,255,0.08);
    position:relative; z-index:1; flex-shrink:0;
  }
  .logo-badge {
    width:36px; height:36px;
    background:rgba(212,168,75,0.18);
    border:1.5px solid rgba(212,168,75,0.3);
    border-radius:10px;
    display:flex; align-items:center; justify-content:center;
    overflow:hidden; flex-shrink:0;
  }
  .logo-badge img { height:42px; margin-top:2px; mix-blend-mode:lighten; opacity:0.92; }
  .sidebar-brand { font-family:var(--font-display); font-size:15px; font-weight:700; color:white; line-height:1.2; }
  .sidebar-brand-sub { font-size:9px; color:rgba(255,255,255,0.4); letter-spacing:0.08em; }
  /* Liseré rouge */
  .sidebar-stripe { height:3px; background:linear-gradient(90deg, var(--red), rgba(200,38,28,0.25), transparent); flex-shrink:0; }

  .sidebar-nav { flex:1; padding:14px 12px; display:flex; flex-direction:column; gap:2px; position:relative; z-index:1; overflow-y:auto; }
  .nav-section-label { font-size:9px; font-weight:800; letter-spacing:0.15em; text-transform:uppercase; color:rgba(255,255,255,0.28); padding:0 10px; margin:14px 0 5px; }
  .nav-item {
    display:flex; align-items:center; gap:9px;
    padding:10px 12px; border-radius:12px;
    font-size:13px; font-weight:600; color:rgba(255,255,255,0.58);
    background:transparent; border:1px solid transparent;
    cursor:pointer; transition:all 0.15s; text-align:left; width:100%;
  }
  .nav-item:hover { background:rgba(255,255,255,0.07); color:white; }
  .nav-item.active { background:rgba(255,255,255,0.14); color:white; box-shadow:inset 0 0 0 1px rgba(255,255,255,0.1); }
  .nav-active-dot { width:7px; height:7px; background:var(--red-bright); border-radius:50%; flex-shrink:0; }
  .nav-badge { margin-left:auto; background:rgba(212,168,75,0.2); color:#f0c060; font-size:10px; font-weight:800; padding:1px 8px; border-radius:99px; }
  .admin-link { color:rgba(240,192,96,0.75) !important; }

  .sidebar-bottom { padding:10px 12px; border-top:1px solid rgba(255,255,255,0.07); position:relative; z-index:1; flex-shrink:0; }
  .user-info { display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:12px; background:rgba(255,255,255,0.06); }
  .user-avatar { width:30px; height:30px; border-radius:50%; background:linear-gradient(135deg,var(--red),var(--red-bright)); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:white; text-transform:uppercase; flex-shrink:0; }
  .user-details { flex:1; min-width:0; }
  .user-name { font-size:12px; font-weight:700; color:rgba(255,255,255,0.85); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .user-role { font-size:10px; color:rgba(255,255,255,0.32); }
  .icon-btn { padding:6px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:transparent; border:none; color:rgba(255,255,255,0.4); cursor:pointer; transition:all 0.15s; flex-shrink:0; }
  .icon-btn:hover { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.85); }

  /* ── MOBILE DRAWER ── */
  .mobile-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(2px); z-index:299; }
  .mobile-drawer {
    display:none; position:fixed; top:0; left:0; bottom:0; width:275px;
    background:var(--green-deep);
    background-image:linear-gradient(175deg, var(--green) 0%, var(--green-deep) 100%);
    z-index:300; transform:translateX(-100%); transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);
    flex-direction:column; overflow-y:auto; overflow-x:hidden;
  }
  .mobile-drawer.open { transform:translateX(0); }
  .mobile-drawer-header { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.08); padding:0 16px 0 0; }
  .drawer-close { background:transparent; border:none; color:rgba(255,255,255,0.5); cursor:pointer; padding:10px; border-radius:8px; }
  .drawer-close:hover { color:white; background:rgba(255,255,255,0.1); }

  /* ── MAIN ── */
  .main-content { flex:1; margin-left:258px; min-height:100vh; display:flex; flex-direction:column; }
  .topbar { display:flex; align-items:center; justify-content:space-between; padding:16px 26px; border-bottom:1px solid var(--border); background:var(--white); position:sticky; top:0; z-index:50; gap:16px; }
  .topbar-left { display:flex; align-items:center; gap:10px; }
  .topbar-right { display:flex; align-items:center; gap:8px; }
  .page-title { font-family:var(--font-display); font-size:19px; font-weight:700; color:var(--text); }
  .hamburger-btn { display:none; background:transparent; border:none; color:var(--text-soft); cursor:pointer; padding:6px; border-radius:var(--r-sm); }
  .hamburger-btn:hover { background:var(--green-soft); color:var(--text); }
  .search-box { display:flex; align-items:center; gap:8px; background:var(--parchment); border:1.5px solid var(--border-warm); border-radius:var(--r-sm); padding:7px 13px; }
  .search-box svg { color:var(--text-soft); flex-shrink:0; }
  .search-input { background:transparent; border:none; outline:none; color:var(--text); font-size:13px; font-family:var(--font-body); width:170px; }
  .search-input::placeholder { color:var(--text-light); }

  /* ── NOTIFICATIONS ── */
  .notif-wrapper { position:relative; }
  .notif-btn { position:relative; background:transparent; border:none; color:var(--text-soft); cursor:pointer; padding:8px; border-radius:var(--r-sm); display:flex; align-items:center; transition:all 0.15s; }
  .notif-btn:hover { background:var(--green-soft); color:var(--text); }
  .notif-dot { position:absolute; top:2px; right:2px; width:18px; height:18px; background:var(--red); border-radius:50%; font-size:10px; font-weight:800; display:flex; align-items:center; justify-content:center; border:2px solid var(--white); color:white; }
  .notif-panel { position:absolute; top:calc(100% + 8px); right:0; width:310px; background:var(--white); border:1.5px solid var(--border-warm); border-radius:var(--r-lg); box-shadow:var(--shadow-lg); overflow:hidden; z-index:200; animation:fadeIn 0.15s ease; }
  .notif-header { display:flex; align-items:center; justify-content:space-between; padding:13px 16px; border-bottom:1px solid var(--border); font-family:var(--font-display); font-size:14px; font-weight:700; color:var(--text); }
  .notif-list { max-height:340px; overflow-y:auto; }
  .notif-item { padding:13px 16px; border-bottom:1px solid var(--border); cursor:pointer; transition:background 0.15s; }
  .notif-item:hover { background:var(--green-pale); }
  .notif-item.unread { background:var(--red-pale); border-left:3px solid var(--red); }
  .notif-title { font-size:13px; font-weight:700; color:var(--text); margin-bottom:2px; }
  .notif-msg { font-size:12px; color:var(--text-soft); margin-bottom:5px; }
  .notif-time { font-size:10px; color:var(--text-light); }
  .notif-empty { padding:32px 16px; text-align:center; font-size:13px; color:var(--text-light); }

  /* ── DOC GRID ── */
  .docs-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:14px; padding:22px 26px; }
  .doc-card {
    background:var(--white); border:1.5px solid var(--border); border-radius:var(--r-lg);
    padding:18px; cursor:pointer; transition:all 0.22s; text-align:left;
    display:flex; flex-direction:column; gap:10px; position:relative; overflow:hidden;
    box-shadow:var(--shadow-sm);
  }
  .doc-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--red),var(--straw)); border-radius:var(--r-lg) var(--r-lg) 0 0; opacity:0; transition:opacity 0.2s; }
  .doc-card:hover { border-color:rgba(200,38,28,0.25); transform:translateY(-3px); box-shadow:var(--shadow-md); }
  .doc-card:hover::before { opacity:1; }
  .doc-card-header { display:flex; align-items:flex-start; justify-content:space-between; }
  .doc-icon { width:42px; height:42px; background:var(--straw-pale); border:1.5px solid var(--straw-border); border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .doc-meta-top { display:flex; gap:5px; align-items:center; }
  .version-badge { font-size:10px; padding:2px 8px; background:var(--green-soft); border:1px solid var(--green-border); color:var(--green-deep); border-radius:99px; font-weight:700; }
  .doc-card-body { flex:1; }
  .doc-title { font-family:var(--font-display); font-size:15px; font-weight:700; color:var(--text); line-height:1.3; margin-bottom:4px; }
  .doc-desc { font-size:12px; color:var(--text-soft); line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .doc-card-footer { display:flex; align-items:center; justify-content:space-between; font-size:11px; color:var(--text-light); padding-top:10px; border-top:1px solid var(--border); }
  .doc-service { background:var(--straw-pale); color:var(--straw); border:1px solid var(--straw-border); padding:1px 7px; border-radius:99px; font-weight:700; font-size:10px; display:inline-block; }
  .doc-folder { background:var(--green-soft); color:var(--green-deep); padding:2px 8px; border-radius:99px; font-weight:700; }
  .doc-hover-overlay { position:absolute; inset:0; background:rgba(200,38,28,0.03); display:flex; align-items:center; justify-content:center; gap:7px; font-size:13px; font-weight:700; color:var(--red); opacity:0; transition:opacity 0.2s; border-radius:var(--r-lg); }
  .doc-card:hover .doc-hover-overlay { opacity:1; }

  /* ── EMPTY STATE ── */
  .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 24px; color:var(--text-light); text-align:center; gap:12px; }
  .empty-state svg { color:var(--text-light); opacity:0.5; }
  .empty-state h3 { font-family:var(--font-display); font-size:17px; color:var(--text-soft); }
  .empty-state p { font-size:13px; }

  /* ── FOOTER ── */
  .app-footer { position:fixed; bottom:12px; right:16px; z-index:50; pointer-events:none; }
  .footer-logo-img { height:30px; width:auto; opacity:0.3; transition:opacity 0.2s; pointer-events:all; }
  .footer-logo-img:hover { opacity:0.65; }

  /* ── RESPONSIVE ── */
  @media (max-width:768px) {
    .hamburger-btn { display:flex; }
    .mobile-overlay { display:block; }
    .mobile-drawer { display:flex; }
    .sidebar { display:none; }
    .main-content { margin-left:0; }
    .docs-grid { grid-template-columns:1fr 1fr; padding:12px; gap:10px; }
    .topbar { padding:12px 16px; }
    .search-input { width:120px; }
  }
  @media (max-width:400px) { .docs-grid { grid-template-columns:1fr; } }
`

const LogoIcon = () => (
  <div className="logo-badge">
    <img src="/tete-chevre.png" alt="Soignon" />
  </div>
)

const CalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
    <rect x="3" y="6" width="26" height="23" rx="3" fill="rgba(212,168,75,0.15)" stroke="#d4a84b" strokeWidth="1.8"/>
    <line x1="3" y1="13" x2="29" y2="13" stroke="#d4a84b" strokeWidth="1.5"/>
    <line x1="10" y1="3" x2="10" y2="9" stroke="#d4a84b" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="22" y1="3" x2="22" y2="9" stroke="#d4a84b" strokeWidth="2.2" strokeLinecap="round"/>
    <rect x="8" y="17" width="4" height="3" rx="1" fill="#d4a84b" opacity="0.85"/>
    <rect x="14" y="17" width="4" height="3" rx="1" fill="#d4a84b" opacity="0.5"/>
    <rect x="8" y="22" width="4" height="3" rx="1" fill="#d4a84b" opacity="0.5"/>
    <rect x="14" y="22" width="4" height="3" rx="1" fill="#d4a84b" opacity="0.3"/>
  </svg>
)

const SidebarContent = ({ selectedFolder, setSelectedFolder, folders, documents, isAdmin, navigate, profile, signOut, onClose }) => (
  <>
    <div className="sidebar-logo">
      <LogoIcon />
      <div>
        <div className="sidebar-brand">Planning Viewer</div>
        <div className="sidebar-brand-sub">SOIGNON · EURIAL</div>
      </div>
    </div>
    <div className="sidebar-stripe" />
    <nav className="sidebar-nav">
      <div className="nav-section-label">Documents</div>
      <button className={`nav-item ${!selectedFolder ? 'active' : ''}`} onClick={() => { setSelectedFolder(null); onClose?.() }}>
        {!selectedFolder && <span className="nav-active-dot"/>}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        Tous les documents
        {documents.length > 0 && <span className="nav-badge">{documents.length}</span>}
      </button>
      <div className="nav-section-label" style={{marginTop:10}}>Dossiers</div>
      {folders.map(folder => (
        <button key={folder.id} className={`nav-item ${selectedFolder === folder.id ? 'active' : ''}`} onClick={() => { setSelectedFolder(folder.id); onClose?.() }}>
          {selectedFolder === folder.id && <span className="nav-active-dot"/>}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>
            {folder.name}
            {(folder.folder_services || []).length > 0 &&
              <span style={{fontSize:9,opacity:0.5,display:'block',lineHeight:1}}>
                {(folder.folder_services || []).map(fs => fs.services?.name).filter(Boolean).join(', ')}
              </span>
            }
          </span>
          <span className="nav-badge">{documents.filter(d => (d.document_folders || []).some(df => df.folder_id === folder.id)).length}</span>
        </button>
      ))}
      {isAdmin && (
        <>
          <div className="nav-section-label" style={{marginTop:10}}>Admin</div>
          <button className="nav-item admin-link" onClick={() => { navigate('/admin'); onClose?.() }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Administration
          </button>
        </>
      )}
    </nav>
    <div className="sidebar-bottom">
      <div className="user-info">
        <div className="user-avatar">{profile?.full_name ? profile.full_name.trim().split(/\s+/).filter(n => n.length > 0).slice(0,2).map(n => n[0].toUpperCase()).join('').slice(0,2) : '?'}</div>
        <div className="user-details">
          <div className="user-name">{profile?.full_name || profile?.email || 'Utilisateur'}</div>
          <div className="user-role">{isAdmin ? 'Administrateur' : 'Utilisateur'}</div>
        </div>
        <button className="icon-btn" onClick={signOut} title="Déconnexion">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </div>
  </>
)

export default function DashboardPage() {
  const { profile, isAdmin, signOut } = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead, requestPushPermission, subscribePush } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()
  const [folders, setFolders] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [newDocStatus, setNewDocStatus] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [userServiceIds, setUserServiceIds] = useState(null) // null = admin (tout voir)

  useEffect(() => {
    if (profile === null && !isAdmin) return // Attendre que le profil soit chargé
    loadData()
    loadNewDocStatus()
    requestPushPermission().then(granted => { if (granted) subscribePush() })
  }, [location.key, profile?.id, isAdmin])

  async function loadData() {
    try {
      // Charger les services de l'utilisateur (sauf admin)
      let serviceIds = null
      if (!isAdmin && profile?.id) {
        const { data: us } = await supabase.from('user_services').select('service_id').eq('user_id', profile.id)
        serviceIds = us ? us.map(r => r.service_id) : []
        setUserServiceIds(serviceIds)
      }

      const [foldersRes, docsRes] = await Promise.all([
        supabase.from('folders')
          .select('*, folder_services(service_id, services(id, name, is_active))')
          .eq('is_active', true)
          .order('name'),
        supabase.from('documents')
          .select('*, document_folders(folder_id, folders(id, name, is_active, folder_services(service_id, services(id, name))))')
          .eq('is_active', true)
          .order('published_at', { ascending: false })
      ])

      if (foldersRes.data) {
        let visibleFolders = foldersRes.data
        if (!isAdmin && serviceIds !== null) {
          visibleFolders = foldersRes.data.filter(f => {
            const fServiceIds = (f.folder_services || []).map(fs => fs.service_id)
            if (fServiceIds.length === 0) return true // pas de service → visible
            return fServiceIds.some(sid => serviceIds.includes(sid))
          })
        }
        setFolders(visibleFolders)
      }

      if (docsRes.data) {
        let visibleDocs = docsRes.data.filter(doc => {
          const docFolders = doc.document_folders || []
          if (docFolders.length === 0) return true
          return docFolders.every(df => df.folders?.is_active !== false)
        })
        if (!isAdmin && serviceIds !== null) {
          visibleDocs = visibleDocs.filter(doc => {
            const docFolders = doc.document_folders || []
            if (docFolders.length === 0) return true
            return docFolders.some(df => {
              const fServiceIds = (df.folders?.folder_services || []).map(fs => fs.service_id)
              if (fServiceIds.length === 0) return true
              return fServiceIds.some(sid => serviceIds.includes(sid))
            })
          })
        }
        setDocuments(visibleDocs)
      }
    } catch { toast.error('Erreur lors du chargement') }
    finally { setLoading(false) }
  }

  async function loadNewDocStatus() {
    const { data } = await supabase.from('user_document_status').select('document_id, is_new')
    if (data) {
      const status = {}
      data.forEach(s => { status[s.document_id] = s.is_new })
      setNewDocStatus(status)
    }
  }

  async function openDocument(doc) {
    if (newDocStatus[doc.id]) {
      setNewDocStatus(prev => ({ ...prev, [doc.id]: false }))
      supabase.rpc('mark_document_viewed', { doc_id: doc.id }).catch(() => {})
    }
    navigate(`/viewer/${doc.id}`)
  }

  const filteredDocs = documents.filter(doc => {
    const matchesFolder = selectedFolder ? (doc.document_folders || []).some(df => df.folder_id === selectedFolder) : true
    const matchesSearch = searchQuery ? doc.title.toLowerCase().includes(searchQuery.toLowerCase()) : true
    return matchesFolder && matchesSearch
  })

  const newDocsCount = Object.values(newDocStatus).filter(Boolean).length

  return (
    <div className="dashboard">
      <style>{SIDEBAR_STYLES}</style>

      {/* Sidebar desktop */}
      <aside className="sidebar">
        <img className="sidebar-goat" src="/tete-chevre.png" alt="" />
        <SidebarContent
          selectedFolder={selectedFolder} setSelectedFolder={setSelectedFolder}
          folders={folders} documents={documents} isAdmin={isAdmin}
          navigate={navigate} profile={profile} signOut={signOut}
        />
      </aside>

      {/* Mobile overlay + drawer */}
      {showMobileMenu && <div className="mobile-overlay" onClick={() => setShowMobileMenu(false)} />}
      <div className={`mobile-drawer ${showMobileMenu ? 'open' : ''}`}>
        <div className="mobile-drawer-header">
          <div className="sidebar-logo" style={{borderBottom:'none'}}>
            <LogoIcon />
            <div>
              <div className="sidebar-brand">Planning Viewer</div>
              <div className="sidebar-brand-sub">SOIGNON · EURIAL</div>
            </div>
          </div>
          <button className="drawer-close" onClick={() => setShowMobileMenu(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="sidebar-stripe" />
        <SidebarContent
          selectedFolder={selectedFolder} setSelectedFolder={setSelectedFolder}
          folders={folders} documents={documents} isAdmin={isAdmin}
          navigate={navigate} profile={profile} signOut={signOut}
          onClose={() => setShowMobileMenu(false)}
        />
      </div>

      {/* Contenu principal */}
      <main className="main-content">
        <div className="topbar">
          <div className="topbar-left">
            <button className="hamburger-btn" onClick={() => setShowMobileMenu(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <h2 className="page-title">
              {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Tous les documents'}
            </h2>
            {newDocsCount > 0 && <span className="badge-new">{newDocsCount} nouveau{newDocsCount > 1 ? 'x' : ''}</span>}
          </div>
          <div className="topbar-right">
            <div className="search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="search-input" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="notif-wrapper">
              <button className="notif-btn" onClick={() => setShowNotifications(!showNotifications)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="notif-panel">
                  <div className="notif-header">
                    Notifications
                    {unreadCount > 0 && <button className="btn-ghost" style={{fontSize:12,padding:'4px 8px'}} onClick={markAllAsRead}>Tout lire</button>}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0
                      ? <div className="notif-empty">Aucune notification</div>
                      : notifications.map(notif => (
                        <div key={notif.id} className={`notif-item ${!notif.is_read ? 'unread' : ''}`} onClick={() => markAsRead(notif.id)}>
                          <div className="notif-title">{notif.title}</div>
                          <div className="notif-msg">{notif.message}</div>
                          <div className="notif-time">{format(new Date(notif.created_at), 'dd MMM HH:mm', { locale: fr })}</div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="docs-grid">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{height:160}} />)}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <h3>Aucun document</h3>
            <p>{searchQuery ? 'Aucun résultat pour votre recherche' : 'Aucun document disponible pour le moment'}</p>
          </div>
        ) : (
          <div className="docs-grid">
            {filteredDocs.map(doc => (
              <button key={doc.id} className="doc-card" onClick={() => openDocument(doc)}>
                <div className="doc-card-header">
                  <div className="doc-icon"><CalIcon /></div>
                  <div className="doc-meta-top">
                    {newDocStatus[doc.id] && <span className="badge-new">Nouveau</span>}
                    {doc.version > 1 && <span className="version-badge">v{doc.version}</span>}
                  </div>
                </div>
                <div className="doc-card-body">
                  <h3 className="doc-title">{doc.title}</h3>
                  {doc.description && <p className="doc-desc">{doc.description}</p>}
                </div>
                <div className="doc-card-footer">
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    {(() => {
                      const docFolders = doc.document_folders || []
                      const serviceNames = [...new Set(docFolders.flatMap(df =>
                        (df.folders?.folder_services || []).map(fs => fs.services?.name).filter(Boolean)
                      ))]
                      const folderNames = docFolders.map(df => df.folders?.name).filter(Boolean)
                      return <>
                        {serviceNames.length > 0 && <span className="doc-service">{serviceNames.join(', ')}</span>}
                        <span className="doc-folder">{folderNames.length > 0 ? folderNames.join(', ') : '—'}</span>
                      </>
                    })()}
                  </div>
                  <span className="doc-date">{format(new Date(doc.published_at), 'dd MMM yyyy', { locale: fr })}</span>
                </div>
                <div className="doc-hover-overlay">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Ouvrir
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <img src="/logo-aa.png" alt="Logo" className="footer-logo-img" />
      </footer>
    </div>
  )
}
