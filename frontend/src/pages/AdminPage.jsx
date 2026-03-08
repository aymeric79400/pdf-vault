import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

const TABS = ['documents', 'dossiers', 'utilisateurs', 'statistiques', 'connexions']

export default function AdminPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('documents')
  const [documents, setDocuments] = useState([])
  const [folders, setFolders] = useState([])
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState([])
  const [loginHistory, setLoginHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [uploadModal, setUploadModal] = useState(false)
  const [userModal, setUserModal] = useState(false)
  const [folderModal, setFolderModal] = useState(false)
  const [editDoc, setEditDoc] = useState(null)
  const [editFolder, setEditFolder] = useState(null)

  // Forms
  const [docForm, setDocForm] = useState({ title: '', description: '', folder_id: '', file: null })
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'user' })
  const [folderForm, setFolderForm] = useState({ name: '', year: new Date().getFullYear() })
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return }
    loadAll()
  }, [isAdmin])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadDocuments(), loadFolders(), loadUsers(), loadStats(), loadLoginHistory()])
    setLoading(false)
  }

  async function loadDocuments() {
    const { data } = await supabase
      .from('documents')
      .select('*, folders(name)')
      .order('published_at', { ascending: false })
    if (data) setDocuments(data)
  }

  async function loadFolders() {
    const { data } = await supabase.from('folders').select('*').order('year', { ascending: false })
    if (data) setFolders(data)
  }

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setUsers(data)
  }

  async function loadStats() {
    const { data } = await supabase.from('document_stats').select('*').order('total_views', { ascending: false })
    if (data) setStats(data)
  }

  async function loadLoginHistory() {
    const { data } = await supabase
      .from('login_history')
      .select('*, profiles(email, full_name)')
      .order('logged_in_at', { ascending: false })
      .limit(200)
    if (data) setLoginHistory(data)
  }

  // ── DOSSIERS ──────────────────────────────────────────────
  async function saveFolder() {
    if (!folderForm.name || !folderForm.year) {
      toast.error('Nom et année requis')
      return
    }
    try {
      if (editFolder) {
        await supabase.from('folders').update({
          name: folderForm.name,
          year: parseInt(folderForm.year)
        }).eq('id', editFolder.id)
        toast.success('Dossier modifié')
      } else {
        await supabase.from('folders').insert({
          name: folderForm.name,
          year: parseInt(folderForm.year)
        })
        toast.success('Dossier créé')
      }
      setFolderModal(false)
      setEditFolder(null)
      setFolderForm({ name: '', year: new Date().getFullYear() })
      loadFolders()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
  }

  async function deleteFolder(folder) {
    const docsInFolder = documents.filter(d => d.folder_id === folder.id).length
    if (docsInFolder > 0) {
      if (!confirm(`Ce dossier contient ${docsInFolder} document(s). Les documents seront déplacés hors dossier. Continuer ?`)) return
      await supabase.from('documents').update({ folder_id: null }).eq('folder_id', folder.id)
    } else {
      if (!confirm(`Supprimer le dossier "${folder.name}" ?`)) return
    }
    try {
      await supabase.from('folders').delete().eq('id', folder.id)
      toast.success('Dossier supprimé')
      loadAll()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
  }

  // ── DOCUMENTS ─────────────────────────────────────────────
  async function uploadDocument() {
    if (!docForm.file || !docForm.title) {
      toast.error('Titre et fichier PDF requis')
      return
    }
    setUploading(true)
    try {
      const fileName = `${Date.now()}_${docForm.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const folder = folders.find(f => f.id === docForm.folder_id)
      const yearPath = folder ? folder.year : 'divers'
      const filePath = `${yearPath}/${fileName}`

      const { error: uploadErr } = await supabase.storage
        .from('pdfs')
        .upload(filePath, docForm.file, { contentType: 'application/pdf' })
      if (uploadErr) throw uploadErr

      const { error: dbErr } = await supabase.from('documents').insert({
        title: docForm.title,
        description: docForm.description,
        folder_id: docForm.folder_id || null,
        file_path: filePath,
        file_size: docForm.file.size,
      })
      if (dbErr) throw dbErr

      // Notifier tous les utilisateurs
      const { data: activeUsers } = await supabase
        .from('profiles').select('id').eq('is_active', true).eq('role', 'user')
      if (activeUsers?.length) {
        await supabase.from('notifications').insert(
          activeUsers.map(u => ({
            user_id: u.id,
            type: 'new_document',
            title: '📄 Nouveau document disponible',
            message: `"${docForm.title}" a été publié${folder ? ' dans ' + folder.name : ''}`,
          }))
        )
      }

      toast.success('Document publié !')
      setUploadModal(false)
      setDocForm({ title: '', description: '', folder_id: '', file: null })
      loadAll()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function updateDocument() {
    if (!editDoc) return
    setUploading(true)
    try {
      let filePath = editDoc.file_path
      if (docForm.file) {
        const folder = folders.find(f => f.id === (docForm.folder_id || editDoc.folder_id))
        const yearPath = folder ? folder.year : 'divers'
        const fileName = `${Date.now()}_${docForm.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        filePath = `${yearPath}/${fileName}`
        await supabase.storage.from('pdfs').upload(filePath, docForm.file, { contentType: 'application/pdf' })
        await supabase.storage.from('pdfs').remove([editDoc.file_path])
      }

      await supabase.from('documents').update({
        title: docForm.title || editDoc.title,
        description: docForm.description,
        folder_id: docForm.folder_id || null,
        file_path: filePath,
        version: editDoc.version + (docForm.file ? 1 : 0),
      }).eq('id', editDoc.id)

      if (docForm.file) {
        const { data: viewers } = await supabase
          .from('document_views').select('user_id').eq('document_id', editDoc.id)
        const uniqueViewers = [...new Set(viewers?.map(v => v.user_id))]
        if (uniqueViewers.length) {
          await supabase.from('notifications').insert(
            uniqueViewers.map(uid => ({
              user_id: uid,
              document_id: editDoc.id,
              type: 'updated_document',
              title: '🔄 Document mis à jour',
              message: `"${docForm.title || editDoc.title}" a été mis à jour`,
            }))
          )
        }
      }

      toast.success('Document mis à jour')
      setEditDoc(null)
      setDocForm({ title: '', description: '', folder_id: '', file: null })
      loadAll()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function deleteDocument(doc) {
    if (!confirm(`Supprimer "${doc.title}" ?`)) return
    try {
      await supabase.storage.from('pdfs').remove([doc.file_path])
      await supabase.from('documents').update({ is_active: false }).eq('id', doc.id)
      toast.success('Document supprimé')
      loadDocuments()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
  }

  async function toggleUserActive(user) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    toast.success(user.is_active ? 'Utilisateur désactivé' : 'Utilisateur activé')
    loadUsers()
  }

  const tabIcons = {
    documents: '📄', dossiers: '📁', utilisateurs: '👥', statistiques: '📊', connexions: '🕐'
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>← Tableau de bord</button>
          <h1 className="font-display admin-title">Administration</h1>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-secondary" onClick={() => { setEditFolder(null); setFolderForm({ name: '', year: new Date().getFullYear() }); setFolderModal(true) }}>
            + Nouveau dossier
          </button>
          <button className="btn btn-secondary" onClick={() => setUserModal(true)}>
            + Créer utilisateur
          </button>
          <button className="btn btn-primary" onClick={() => { setEditDoc(null); setDocForm({ title: '', description: '', folder_id: '', file: null }); setUploadModal(true) }}>
            + Ajouter PDF
          </button>
        </div>
      </header>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {tabIcons[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="admin-content">

        {/* ── DOCUMENTS ── */}
        {tab === 'documents' && (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Titre</th><th>Dossier</th><th>Version</th><th>Taille</th><th>Publié le</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td className="td-title">{doc.title}</td>
                    <td><span className="tag">{doc.folders?.name || <em style={{color:'var(--text-muted)'}}>Sans dossier</em>}</span></td>
                    <td><span className="tag blue">v{doc.version}</span></td>
                    <td>{doc.file_size ? `${(doc.file_size/1024/1024).toFixed(1)} Mo` : '—'}</td>
                    <td>{format(new Date(doc.published_at), 'dd/MM/yyyy', { locale: fr })}</td>
                    <td><span className={`status-dot ${doc.is_active ? 'active' : 'inactive'}`}>{doc.is_active ? 'Actif' : 'Archivé'}</span></td>
                    <td className="td-actions">
                      <button className="btn btn-ghost" onClick={() => {
                        setEditDoc(doc)
                        setDocForm({ title: doc.title, description: doc.description || '', folder_id: doc.folder_id || '', file: null })
                        setUploadModal(true)
                      }}>Modifier</button>
                      <button className="btn btn-danger" onClick={() => deleteDocument(doc)}>Supprimer</button>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr><td colSpan={7} style={{textAlign:'center',padding:32,color:'var(--text-muted)'}}>Aucun document</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── DOSSIERS ── */}
        {tab === 'dossiers' && (
          <div>
            <div className="folders-grid">
              {folders.map(folder => {
                const docCount = documents.filter(d => d.folder_id === folder.id).length
                return (
                  <div key={folder.id} className="folder-card">
                    <div className="folder-card-icon">📁</div>
                    <div className="folder-card-body">
                      <div className="folder-card-name">{folder.name}</div>
                      <div className="folder-card-meta">{folder.year} · {docCount} document{docCount !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="folder-card-actions">
                      <button className="btn btn-ghost" onClick={() => {
                        setEditFolder(folder)
                        setFolderForm({ name: folder.name, year: folder.year })
                        setFolderModal(true)
                      }}>Modifier</button>
                      <button className="btn btn-danger" onClick={() => deleteFolder(folder)}>Supprimer</button>
                    </div>
                  </div>
                )
              })}
              {folders.length === 0 && (
                <div className="empty-state">
                  <div style={{fontSize:48}}>📁</div>
                  <h3>Aucun dossier</h3>
                  <p>Créez des dossiers pour organiser vos documents par année</p>
                  <button className="btn btn-primary" onClick={() => { setEditFolder(null); setFolderForm({ name: '', year: new Date().getFullYear() }); setFolderModal(true) }}>
                    + Créer un dossier
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── UTILISATEURS ── */}
        {tab === 'utilisateurs' && (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Créé le</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="td-title">{u.full_name || '—'}</td>
                    <td>{u.email}</td>
                    <td><span className={`tag ${u.role === 'admin' ? 'blue' : ''}`}>{u.role}</span></td>
                    <td>{format(new Date(u.created_at), 'dd/MM/yyyy', { locale: fr })}</td>
                    <td><span className={`status-dot ${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'Actif' : 'Inactif'}</span></td>
                    <td className="td-actions">
                      <button className="btn btn-ghost" onClick={() => toggleUserActive(u)}>
                        {u.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── STATISTIQUES ── */}
        {tab === 'statistiques' && (
          <div>
            <div className="stats-summary">
              <div className="stat-card"><div className="stat-value">{documents.filter(d=>d.is_active).length}</div><div className="stat-label">Documents actifs</div></div>
              <div className="stat-card"><div className="stat-value">{folders.length}</div><div className="stat-label">Dossiers</div></div>
              <div className="stat-card"><div className="stat-value">{users.filter(u=>u.is_active).length}</div><div className="stat-label">Utilisateurs actifs</div></div>
              <div className="stat-card"><div className="stat-value">{stats.reduce((a,s)=>a+s.total_views,0)}</div><div className="stat-label">Consultations totales</div></div>
            </div>
            <h3 className="section-title font-display">Documents les plus consultés</h3>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead><tr><th>Rang</th><th>Document</th><th>Consultations</th><th>Lecteurs uniques</th><th>Dernière vue</th></tr></thead>
                <tbody>
                  {stats.map((s,i) => (
                    <tr key={s.id}>
                      <td><span className={`rank ${i<3?'top':''}`}>#{i+1}</span></td>
                      <td className="td-title">{s.title}</td>
                      <td><strong>{s.total_views}</strong></td>
                      <td>{s.unique_viewers}</td>
                      <td>{s.last_viewed_at ? format(new Date(s.last_viewed_at),'dd/MM/yyyy HH:mm',{locale:fr}) : '—'}</td>
                    </tr>
                  ))}
                  {stats.length === 0 && <tr><td colSpan={5} style={{textAlign:'center',padding:32,color:'var(--text-muted)'}}>Aucune consultation enregistrée</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CONNEXIONS ── */}
        {tab === 'connexions' && (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead><tr><th>Utilisateur</th><th>Date</th><th>IP</th><th>Appareil</th></tr></thead>
              <tbody>
                {loginHistory.map(log => (
                  <tr key={log.id}>
                    <td>{log.profiles?.email || '—'}<br/><small style={{color:'var(--text-muted)'}}>{log.profiles?.full_name}</small></td>
                    <td>{format(new Date(log.logged_in_at),'dd/MM/yyyy HH:mm',{locale:fr})}</td>
                    <td><code>{log.ip_address || '—'}</code></td>
                    <td><span className="tag">{log.device_type || '—'}</span></td>
                  </tr>
                ))}
                {loginHistory.length === 0 && <tr><td colSpan={4} style={{textAlign:'center',padding:32,color:'var(--text-muted)'}}>Aucune connexion enregistrée</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: Upload/Modifier PDF ── */}
      {(uploadModal) && (
        <div className="modal-overlay" onClick={() => { setUploadModal(false); setEditDoc(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">{editDoc ? 'Modifier le document' : 'Ajouter un PDF'}</h3>
              <button className="btn btn-ghost" onClick={() => { setUploadModal(false); setEditDoc(null) }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Titre *</label>
                <input className="input" placeholder="Titre du document" value={docForm.title} onChange={e => setDocForm(p=>({...p,title:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="input" rows={3} placeholder="Description optionnelle" value={docForm.description} onChange={e => setDocForm(p=>({...p,description:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Dossier <span style={{color:'var(--text-muted)',fontWeight:400}}>(optionnel)</span></label>
                <select className="input" value={docForm.folder_id} onChange={e => setDocForm(p=>({...p,folder_id:e.target.value}))}>
                  <option value="">— Sans dossier —</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name} ({f.year})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fichier PDF {editDoc ? <span style={{color:'var(--text-muted)',fontWeight:400}}>(laisser vide pour ne pas modifier)</span> : '*'}</label>
                <input type="file" accept="application/pdf" className="input" onChange={e => setDocForm(p=>({...p,file:e.target.files[0]}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setUploadModal(false); setEditDoc(null) }}>Annuler</button>
              <button className="btn btn-primary" onClick={editDoc ? updateDocument : uploadDocument} disabled={uploading}>
                {uploading ? 'Envoi...' : editDoc ? 'Mettre à jour' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Dossier ── */}
      {folderModal && (
        <div className="modal-overlay" onClick={() => { setFolderModal(false); setEditFolder(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">{editFolder ? 'Modifier le dossier' : 'Nouveau dossier'}</h3>
              <button className="btn btn-ghost" onClick={() => { setFolderModal(false); setEditFolder(null) }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nom du dossier *</label>
                <input className="input" placeholder="ex: Documents 2025" value={folderForm.name} onChange={e => setFolderForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Année *</label>
                <input className="input" type="number" min="2000" max="2100" placeholder="2025" value={folderForm.year} onChange={e => setFolderForm(p=>({...p,year:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setFolderModal(false); setEditFolder(null) }}>Annuler</button>
              <button className="btn btn-primary" onClick={saveFolder}>
                {editFolder ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Utilisateur ── */}
      {userModal && (
        <div className="modal-overlay" onClick={() => setUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">Créer un utilisateur</h3>
              <button className="btn btn-ghost" onClick={() => setUserModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-info">
                Pour créer un utilisateur, allez dans <strong>Supabase Dashboard → Authentication → Users → Invite user</strong>. L'utilisateur recevra un email pour définir son mot de passe.
              </div>
              <div style={{marginTop:8,fontSize:13,color:'var(--text-secondary)'}}>
                Pour lui attribuer le rôle admin, exécutez ensuite dans SQL Editor :
                <pre style={{background:'var(--bg-primary)',padding:12,borderRadius:8,marginTop:8,fontSize:12,color:'var(--accent)',overflow:'auto'}}>
{`UPDATE public.profiles SET role = 'admin'
WHERE email = 'email@exemple.com';`}
                </pre>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setUserModal(false)}>Fermer</button>
              <a className="btn btn-primary" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                Ouvrir Supabase
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-page { min-height:100vh; background:var(--bg-primary); display:flex; flex-direction:column; }
        .admin-header { display:flex; align-items:center; justify-content:space-between; padding:16px 28px; background:var(--bg-secondary); border-bottom:1px solid var(--border); gap:16px; flex-wrap:wrap; }
        .admin-header-left { display:flex; align-items:center; gap:16px; }
        .admin-title { font-size:20px; font-weight:800; color:var(--text-primary); }
        .admin-header-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .admin-tabs { display:flex; gap:2px; padding:0 24px; background:var(--bg-secondary); border-bottom:1px solid var(--border); overflow-x:auto; }
        .admin-tab { display:flex; align-items:center; gap:8px; padding:14px 18px; border:none; background:transparent; color:var(--text-secondary); font-size:13px; font-weight:500; cursor:pointer; border-bottom:2px solid transparent; transition:all var(--transition); white-space:nowrap; font-family:var(--font-body); }
        .admin-tab:hover { color:var(--text-primary); }
        .admin-tab.active { color:var(--accent); border-bottom-color:var(--accent); }
        .admin-content { padding:24px 28px; flex:1; }
        .data-table-wrapper { overflow-x:auto; border-radius:var(--radius-lg); border:1px solid var(--border); }
        .data-table { width:100%; border-collapse:collapse; }
        .data-table th { background:var(--bg-secondary); padding:12px 16px; text-align:left; font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-muted); border-bottom:1px solid var(--border); white-space:nowrap; }
        .data-table td { padding:14px 16px; font-size:13px; color:var(--text-secondary); border-bottom:1px solid var(--border); vertical-align:middle; }
        .data-table tr:last-child td { border-bottom:none; }
        .data-table tr:hover td { background:var(--bg-elevated); }
        .td-title { font-weight:500; color:var(--text-primary) !important; max-width:280px; }
        .td-actions { display:flex; gap:6px; align-items:center; }
        .tag { display:inline-block; padding:3px 8px; background:var(--bg-elevated); border-radius:99px; font-size:11px; color:var(--text-secondary); }
        .tag.blue { background:var(--blue-dim); color:var(--blue-light); }
        .status-dot { display:inline-flex; align-items:center; gap:5px; font-size:12px; }
        .status-dot::before { content:''; width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .status-dot.active { color:var(--success); }
        .status-dot.active::before { background:var(--success); }
        .status-dot.inactive { color:var(--text-muted); }
        .status-dot.inactive::before { background:var(--text-muted); }
        .folders-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
        .folder-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:20px; display:flex; align-items:center; gap:16px; transition:all var(--transition); }
        .folder-card:hover { border-color:var(--border-strong); }
        .folder-card-icon { font-size:32px; flex-shrink:0; }
        .folder-card-body { flex:1; min-width:0; }
        .folder-card-name { font-size:15px; font-weight:600; color:var(--text-primary); margin-bottom:4px; }
        .folder-card-meta { font-size:12px; color:var(--text-muted); }
        .folder-card-actions { display:flex; gap:6px; flex-shrink:0; }
        .stats-summary { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:16px; margin-bottom:28px; }
        .stat-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:20px; }
        .stat-value { font-size:32px; font-weight:800; font-family:var(--font-display); color:var(--accent); line-height:1; margin-bottom:6px; }
        .stat-label { font-size:13px; color:var(--text-secondary); }
        .section-title { font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:16px; }
        .rank { font-weight:700; color:var(--text-muted); }
        .rank.top { color:var(--accent); }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:24px; animation:fadeIn 0.15s ease; }
        .modal { background:var(--bg-card); border:1px solid var(--border-strong); border-radius:var(--radius-xl); width:100%; max-width:500px; box-shadow:var(--shadow-lg); overflow:hidden; }
        .modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid var(--border); font-size:16px; font-weight:700; color:var(--text-primary); }
        .modal-body { padding:24px; display:flex; flex-direction:column; gap:16px; }
        .modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:16px 24px; border-top:1px solid var(--border); }
        .form-group { display:flex; flex-direction:column; gap:8px; }
        .form-label { font-size:13px; font-weight:500; color:var(--text-secondary); }
        .modal-info { display:flex; flex-direction:column; gap:6px; padding:12px 14px; background:var(--blue-dim); border:1px solid rgba(59,130,246,0.2); border-radius:var(--radius); font-size:13px; color:var(--blue-light); line-height:1.5; }
        .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 24px; gap:12px; color:var(--text-muted); text-align:center; grid-column:1/-1; }
        .empty-state h3 { font-size:18px; color:var(--text-secondary); font-family:var(--font-display); }
        .empty-state p { font-size:13px; }
        textarea.input { resize:vertical; min-height:80px; }
        select.input { cursor:pointer; }
        code { font-family:monospace; font-size:12px; }
        pre { font-family:monospace; }
      `}</style>
    </div>
  )
}
