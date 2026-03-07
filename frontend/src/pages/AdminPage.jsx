import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

const TABS = ['documents', 'utilisateurs', 'statistiques', 'connexions', 'notifications']

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
  const [uploadModal, setUploadModal] = useState(false)
  const [userModal, setUserModal] = useState(false)
  const [notifModal, setNotifModal] = useState(false)
  const [editDoc, setEditDoc] = useState(null)
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'user' })
  const [notifForm, setNotifForm] = useState({ title: '', message: '', target: 'all' })
  const [docForm, setDocForm] = useState({ title: '', description: '', folder_id: '', file: null })
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
      .select('*, folders(name), profiles(full_name)')
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
    const { data } = await supabase
      .from('document_stats')
      .select('*')
      .order('total_views', { ascending: false })
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

  async function uploadDocument() {
    if (!docForm.file || !docForm.title || !docForm.folder_id) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    setUploading(true)
    try {
      const fileName = `${Date.now()}_${docForm.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const folder = folders.find(f => f.id === docForm.folder_id)
      const filePath = `${folder?.year || 'divers'}/${fileName}`

      // Upload fichier
      const { error: uploadErr } = await supabase.storage
        .from('pdfs')
        .upload(filePath, docForm.file, { contentType: 'application/pdf' })

      if (uploadErr) throw uploadErr

      // Créer entrée en BDD
      const { error: dbErr } = await supabase.from('documents').insert({
        title: docForm.title,
        description: docForm.description,
        folder_id: docForm.folder_id,
        file_path: filePath,
        file_size: docForm.file.size,
      })

      if (dbErr) throw dbErr

      // Notifier tous les utilisateurs
      const { data: activeUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_active', true)
        .eq('role', 'user')

      if (activeUsers?.length) {
        await supabase.from('notifications').insert(
          activeUsers.map(u => ({
            user_id: u.id,
            type: 'new_document',
            title: '📄 Nouveau document disponible',
            message: `"${docForm.title}" a été ajouté à ${folder?.name}`,
          }))
        )
      }

      toast.success('Document ajouté avec succès !')
      setUploadModal(false)
      setDocForm({ title: '', description: '', folder_id: '', file: null })
      loadAll()
    } catch (err) {
      toast.error('Erreur lors de l\'upload: ' + err.message)
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
        const folder = folders.find(f => f.id === editDoc.folder_id)
        const fileName = `${Date.now()}_${docForm.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        filePath = `${folder?.year || 'divers'}/${fileName}`
        await supabase.storage.from('pdfs').upload(filePath, docForm.file, { contentType: 'application/pdf' })
        await supabase.storage.from('pdfs').remove([editDoc.file_path])
      }

      await supabase.from('documents').update({
        title: docForm.title || editDoc.title,
        description: docForm.description || editDoc.description,
        file_path: filePath,
        version: editDoc.version + (docForm.file ? 1 : 0),
      }).eq('id', editDoc.id)

      // Notifier si nouveau fichier
      if (docForm.file) {
        const { data: viewers } = await supabase
          .from('document_views')
          .select('user_id')
          .eq('document_id', editDoc.id)
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

  async function createUser() {
    if (!newUser.email || !newUser.password) {
      toast.error('Email et mot de passe requis')
      return
    }
    try {
      // Créer utilisateur via Supabase Admin API (nécessite service role dans une Edge Function)
      // Pour la démo, on utilise signUp avec metadata
      const { error } = await supabase.auth.admin?.createUser({
        email: newUser.email,
        password: newUser.password,
        user_metadata: { full_name: newUser.full_name, role: newUser.role },
        email_confirm: true
      })
      if (error) throw error
      toast.success('Utilisateur créé')
      setUserModal(false)
      setNewUser({ email: '', full_name: '', password: '', role: 'user' })
      loadUsers()
    } catch (err) {
      // Fallback si pas d'admin API
      toast.error('Utilisez Supabase Dashboard pour créer les utilisateurs. Erreur: ' + err.message)
    }
  }

  async function toggleUserActive(user) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    toast.success(user.is_active ? 'Utilisateur désactivé' : 'Utilisateur activé')
    loadUsers()
  }

  async function sendNotification() {
    if (!notifForm.title) { toast.error('Titre requis'); return }
    try {
      let targetUsers = []
      if (notifForm.target === 'all') {
        const { data } = await supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'user')
        targetUsers = data || []
      }
      await supabase.from('notifications').insert(
        targetUsers.map(u => ({
          user_id: u.id,
          type: 'admin_message',
          title: notifForm.title,
          message: notifForm.message
        }))
      )
      toast.success(`Notification envoyée à ${targetUsers.length} utilisateur(s)`)
      setNotifModal(false)
      setNotifForm({ title: '', message: '', target: 'all' })
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
  }

  const tabIcons = {
    documents: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    utilisateurs: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    statistiques: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    connexions: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    notifications: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Tableau de bord
          </button>
          <h1 className="font-display admin-title">Administration</h1>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-secondary" onClick={() => setNotifModal(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            </svg>
            Notifier
          </button>
          <button className="btn btn-secondary" onClick={() => setUserModal(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Créer utilisateur
          </button>
          <button className="btn btn-primary" onClick={() => setUploadModal(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Ajouter PDF
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`admin-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {tabIcons[t]}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {/* Documents */}
        {tab === 'documents' && (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Dossier</th>
                  <th>Version</th>
                  <th>Taille</th>
                  <th>Publié le</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td className="td-title">{doc.title}</td>
                    <td><span className="tag">{doc.folders?.name || '—'}</span></td>
                    <td><span className="tag blue">v{doc.version}</span></td>
                    <td>{doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)} Mo` : '—'}</td>
                    <td>{format(new Date(doc.published_at), 'dd/MM/yyyy', { locale: fr })}</td>
                    <td>
                      <span className={`status-dot ${doc.is_active ? 'active' : 'inactive'}`}>
                        {doc.is_active ? 'Actif' : 'Archivé'}
                      </span>
                    </td>
                    <td className="td-actions">
                      <button className="btn btn-ghost" onClick={() => {
                        setEditDoc(doc)
                        setDocForm({ title: doc.title, description: doc.description || '', folder_id: doc.folder_id, file: null })
                      }}>
                        Modifier
                      </button>
                      <button className="btn btn-danger" onClick={() => deleteDocument(doc)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Utilisateurs */}
        {tab === 'utilisateurs' && (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Créé le</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="td-title">{u.full_name || '—'}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`tag ${u.role === 'admin' ? 'blue' : ''}`}>{u.role}</span>
                    </td>
                    <td>{format(new Date(u.created_at), 'dd/MM/yyyy', { locale: fr })}</td>
                    <td>
                      <span className={`status-dot ${u.is_active ? 'active' : 'inactive'}`}>
                        {u.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
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

        {/* Statistiques */}
        {tab === 'statistiques' && (
          <div>
            <div className="stats-summary">
              <div className="stat-card">
                <div className="stat-value">{documents.filter(d => d.is_active).length}</div>
                <div className="stat-label">Documents actifs</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{users.filter(u => u.is_active).length}</div>
                <div className="stat-label">Utilisateurs actifs</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.reduce((acc, s) => acc + s.total_views, 0)}</div>
                <div className="stat-label">Consultations totales</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{loginHistory.length}</div>
                <div className="stat-label">Connexions (historique)</div>
              </div>
            </div>

            <h3 className="section-title font-display">Documents les plus consultés</h3>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Rang</th><th>Document</th><th>Consultations</th><th>Lecteurs uniques</th><th>Dernière vue</th></tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={s.id}>
                      <td><span className={`rank ${i < 3 ? 'top' : ''}`}>#{i + 1}</span></td>
                      <td className="td-title">{s.title}</td>
                      <td><strong>{s.total_views}</strong></td>
                      <td>{s.unique_viewers}</td>
                      <td>{s.last_viewed_at ? format(new Date(s.last_viewed_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Connexions */}
        {tab === 'connexions' && (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Utilisateur</th><th>Date</th><th>IP</th><th>Appareil</th><th>Succès</th></tr>
              </thead>
              <tbody>
                {loginHistory.map(log => (
                  <tr key={log.id}>
                    <td>{log.profiles?.email || '—'}<br/><small style={{color:'var(--text-muted)'}}>{log.profiles?.full_name}</small></td>
                    <td>{format(new Date(log.logged_in_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                    <td><code>{log.ip_address || '—'}</code></td>
                    <td><span className="tag">{log.device_type || '—'}</span></td>
                    <td><span className={`status-dot ${log.success ? 'active' : 'inactive'}`}>{log.success ? 'Oui' : 'Non'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notifications tab */}
        {tab === 'notifications' && (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            </svg>
            <h3>Envoyer des notifications</h3>
            <p>Utilisez le bouton "Notifier" en haut pour envoyer des notifications à vos utilisateurs</p>
            <button className="btn btn-primary" onClick={() => setNotifModal(true)}>Envoyer une notification</button>
          </div>
        )}
      </div>

      {/* Modal: Upload PDF */}
      {(uploadModal || editDoc) && (
        <div className="modal-overlay" onClick={() => { setUploadModal(false); setEditDoc(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">{editDoc ? 'Modifier le document' : 'Ajouter un PDF'}</h3>
              <button className="btn btn-ghost icon-btn" onClick={() => { setUploadModal(false); setEditDoc(null) }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Titre *</label>
                <input className="input" placeholder="Titre du document" value={docForm.title} onChange={e => setDocForm(p => ({...p, title: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="input" rows={3} placeholder="Description optionnelle" value={docForm.description} onChange={e => setDocForm(p => ({...p, description: e.target.value}))} />
              </div>
              {!editDoc && (
                <div className="form-group">
                  <label className="form-label">Dossier (année) *</label>
                  <select className="input" value={docForm.folder_id} onChange={e => setDocForm(p => ({...p, folder_id: e.target.value}))}>
                    <option value="">Sélectionner un dossier</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Fichier PDF {editDoc ? '(laisser vide pour ne pas modifier)' : '*'}</label>
                <input type="file" accept="application/pdf" className="input" onChange={e => setDocForm(p => ({...p, file: e.target.files[0]}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setUploadModal(false); setEditDoc(null) }}>Annuler</button>
              <button className="btn btn-primary" onClick={editDoc ? updateDocument : uploadDocument} disabled={uploading}>
                {uploading ? <><span className="spinner" /> Envoi...</> : editDoc ? 'Mettre à jour' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Créer utilisateur */}
      {userModal && (
        <div className="modal-overlay" onClick={() => setUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">Créer un utilisateur</h3>
              <button className="btn btn-ghost icon-btn" onClick={() => setUserModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Pour des raisons de sécurité, il est recommandé de créer les utilisateurs via le tableau de bord Supabase (Authentication → Users → Invite user).
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="input" type="email" placeholder="email@exemple.com" value={newUser.email} onChange={e => setNewUser(p => ({...p, email: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Nom complet</label>
                <input className="input" placeholder="Prénom Nom" value={newUser.full_name} onChange={e => setNewUser(p => ({...p, full_name: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Mot de passe *</label>
                <input className="input" type="password" placeholder="Min. 8 caractères" value={newUser.password} onChange={e => setNewUser(p => ({...p, password: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Rôle</label>
                <select className="input" value={newUser.role} onChange={e => setNewUser(p => ({...p, role: e.target.value}))}>
                  <option value="user">Utilisateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setUserModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={createUser}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Notification */}
      {notifModal && (
        <div className="modal-overlay" onClick={() => setNotifModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">Envoyer une notification</h3>
              <button className="btn btn-ghost icon-btn" onClick={() => setNotifModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Titre *</label>
                <input className="input" placeholder="Titre de la notification" value={notifForm.title} onChange={e => setNotifForm(p => ({...p, title: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea className="input" rows={4} placeholder="Contenu du message..." value={notifForm.message} onChange={e => setNotifForm(p => ({...p, message: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Destinataires</label>
                <select className="input" value={notifForm.target} onChange={e => setNotifForm(p => ({...p, target: e.target.value}))}>
                  <option value="all">Tous les utilisateurs</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNotifModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={sendNotification}>Envoyer</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-page { min-height: 100vh; background: var(--bg-primary); display: flex; flex-direction: column; }
        .admin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 28px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          gap: 16px;
          flex-wrap: wrap;
        }
        .admin-header-left { display: flex; align-items: center; gap: 16px; }
        .admin-title { font-size: 20px; font-weight: 800; color: var(--text-primary); }
        .admin-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .admin-tabs {
          display: flex;
          gap: 2px;
          padding: 0 24px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          overflow-x: auto;
        }
        .admin-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 18px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all var(--transition);
          white-space: nowrap;
          font-family: var(--font-body);
        }
        .admin-tab:hover { color: var(--text-primary); }
        .admin-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
        .admin-content { padding: 24px 28px; flex: 1; }
        .data-table-wrapper { overflow-x: auto; border-radius: var(--radius-lg); border: 1px solid var(--border); }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th {
          background: var(--bg-secondary);
          padding: 12px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .data-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover td { background: var(--bg-elevated); }
        .td-title { font-weight: 500; color: var(--text-primary) !important; max-width: 280px; }
        .td-actions { display: flex; gap: 6px; align-items: center; }
        .tag {
          display: inline-block;
          padding: 3px 8px;
          background: var(--bg-elevated);
          border-radius: 99px;
          font-size: 11px;
          color: var(--text-secondary);
        }
        .tag.blue { background: var(--blue-dim); color: var(--blue-light); }
        .status-dot {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
        }
        .status-dot::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .status-dot.active { color: var(--success); }
        .status-dot.active::before { background: var(--success); }
        .status-dot.inactive { color: var(--text-muted); }
        .status-dot.inactive::before { background: var(--text-muted); }
        .stats-summary {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 28px;
        }
        .stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px;
        }
        .stat-value {
          font-size: 32px;
          font-weight: 800;
          font-family: var(--font-display);
          color: var(--accent);
          line-height: 1;
          margin-bottom: 6px;
        }
        .stat-label { font-size: 13px; color: var(--text-secondary); }
        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 16px;
        }
        .rank { font-weight: 700; color: var(--text-muted); }
        .rank.top { color: var(--accent); }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fadeIn 0.15s ease;
        }
        .modal {
          background: var(--bg-card);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 500px;
          box-shadow: var(--shadow-lg);
          animation: fadeIn 0.2s ease;
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px 24px;
          border-top: 1px solid var(--border);
        }
        .form-group { display: flex; flex-direction: column; gap: 8px; }
        .form-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
        .modal-info {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          background: var(--blue-dim);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: var(--radius);
          font-size: 12px;
          color: var(--blue-light);
          line-height: 1.5;
        }
        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(0,0,0,0.2);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 24px;
          gap: 16px;
          color: var(--text-muted);
          text-align: center;
        }
        .empty-state h3 { font-size: 18px; color: var(--text-secondary); font-family: var(--font-display); }
        .empty-state p { font-size: 14px; }
        textarea.input { resize: vertical; min-height: 90px; }
        select.input { cursor: pointer; }
        code { font-family: monospace; font-size: 12px; }
      `}</style>
    </div>
  )
}
