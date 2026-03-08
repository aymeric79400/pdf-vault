import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

const TABS = ['documents', 'dossiers', 'utilisateurs', 'statistiques', 'connexions']

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="filter-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input className="filter-input" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
      {value && <button className="filter-clear" onClick={() => onChange('')}>✕</button>}
    </div>
  )
}

function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field
  return (
    <th className={`sortable ${active ? 'sort-active' : ''}`} onClick={() => onSort(field)}>
      {label}<span className="sort-icon">{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
    </th>
  )
}

const EMPTY_USER = { email: '', password: '', full_name: '', username: '', phone: '', role: 'user' }

export default function AdminPage() {
  const { isAdmin, profile: currentProfile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('documents')
  const [documents, setDocuments] = useState([])
  const [folders, setFolders] = useState([])
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState([])
  const [loginHistory, setLoginHistory] = useState([])

  // Modals
  const [uploadModal, setUploadModal] = useState(false)
  const [folderModal, setFolderModal] = useState(false)
  const [userModal, setUserModal] = useState(false)
  const [editUserModal, setEditUserModal] = useState(false)
  const [passwordModal, setPasswordModal] = useState(false)
  const [editDoc, setEditDoc] = useState(null)
  const [editFolder, setEditFolder] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)

  // Forms
  const [docForm, setDocForm] = useState({ title: '', description: '', folder_id: '', file: null })
  const [folderForm, setFolderForm] = useState({ name: '', year: new Date().getFullYear() })
  const [userForm, setUserForm] = useState(EMPTY_USER)
  const [editUserForm, setEditUserForm] = useState({})
  const [newPassword, setNewPassword] = useState('')
  const [uploading, setUploading] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Filtres documents
  const [docSearch, setDocSearch] = useState('')
  const [docFolderFilter, setDocFolderFilter] = useState('')
  const [docStatusFilter, setDocStatusFilter] = useState('')
  const [docSort, setDocSort] = useState({ field: 'published_at', dir: 'desc' })

  // Filtres dossiers
  const [folderSearch, setFolderSearch] = useState('')
  const [folderSort, setFolderSort] = useState({ field: 'year', dir: 'desc' })

  // Filtres utilisateurs
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('')
  const [userSort, setUserSort] = useState({ field: 'created_at', dir: 'desc' })

  // Filtres stats
  const [statsSearch, setStatsSearch] = useState('')
  const [statsSort, setStatsSort] = useState({ field: 'total_views', dir: 'desc' })

  // Filtres connexions
  const [connSearch, setConnSearch] = useState('')
  const [connDeviceFilter, setConnDeviceFilter] = useState('')
  const [connSort, setConnSort] = useState({ field: 'logged_in_at', dir: 'desc' })

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return }
    loadAll()
  }, [isAdmin])

  async function loadAll() {
    await Promise.all([loadDocuments(), loadFolders(), loadUsers(), loadStats(), loadLoginHistory()])
  }

  async function loadDocuments() {
    const { data } = await supabase.from('documents').select('*, folders(name)').order('published_at', { ascending: false })
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
    const { data } = await supabase.from('login_history').select('*, profiles(email, full_name)').order('logged_in_at', { ascending: false }).limit(500)
    if (data) setLoginHistory(data)
  }

  function applySort(arr, { field, dir }) {
    return [...arr].sort((a, b) => {
      let va = a[field] ?? '', vb = b[field] ?? ''
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    })
  }

  function toggleSort(current, field, setter) {
    setter(prev => ({ field, dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc' }))
  }

  // Filtered data
  const filteredDocs = useMemo(() => {
    let d = documents
    if (docSearch) d = d.filter(x => x.title.toLowerCase().includes(docSearch.toLowerCase()) || (x.description||'').toLowerCase().includes(docSearch.toLowerCase()))
    if (docFolderFilter === '__none__') d = d.filter(x => !x.folder_id)
    else if (docFolderFilter) d = d.filter(x => x.folder_id === docFolderFilter)
    if (docStatusFilter) d = d.filter(x => docStatusFilter === 'actif' ? x.is_active : !x.is_active)
    return applySort(d, docSort)
  }, [documents, docSearch, docFolderFilter, docStatusFilter, docSort])

  const filteredFolders = useMemo(() => {
    let d = folders
    if (folderSearch) d = d.filter(x => x.name.toLowerCase().includes(folderSearch.toLowerCase()) || String(x.year).includes(folderSearch))
    return applySort(d, folderSort)
  }, [folders, folderSearch, folderSort])

  const filteredUsers = useMemo(() => {
    let d = users
    if (userSearch) d = d.filter(x => (x.email||'').toLowerCase().includes(userSearch.toLowerCase()) || (x.full_name||'').toLowerCase().includes(userSearch.toLowerCase()) || (x.username||'').toLowerCase().includes(userSearch.toLowerCase()) || (x.phone||'').includes(userSearch))
    if (userRoleFilter) d = d.filter(x => x.role === userRoleFilter)
    if (userStatusFilter) d = d.filter(x => userStatusFilter === 'actif' ? x.is_active : !x.is_active)
    return applySort(d, userSort)
  }, [users, userSearch, userRoleFilter, userStatusFilter, userSort])

  const filteredStats = useMemo(() => {
    let d = stats
    if (statsSearch) d = d.filter(x => x.title.toLowerCase().includes(statsSearch.toLowerCase()))
    return applySort(d, statsSort)
  }, [stats, statsSearch, statsSort])

  const filteredConn = useMemo(() => {
    let d = loginHistory
    if (connSearch) d = d.filter(x => (x.profiles?.email||'').toLowerCase().includes(connSearch.toLowerCase()) || (x.profiles?.full_name||'').toLowerCase().includes(connSearch.toLowerCase()) || (x.ip_address||'').includes(connSearch))
    if (connDeviceFilter) d = d.filter(x => x.device_type === connDeviceFilter)
    return applySort(d, connSort)
  }, [loginHistory, connSearch, connDeviceFilter, connSort])

  // ── CRÉER UTILISATEUR ──
  async function createUser() {
    if (!userForm.email || !userForm.password || !userForm.username) {
      toast.error('Email, identifiant et mot de passe sont requis')
      return
    }
    if (userForm.password.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères')
      return
    }
    setSavingUser(true)
    try {
      const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
      const { data: { session } } = await supabase.auth.getSession()
      
      const res = await fetch(`${functionsUrl}/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: userForm.email,
          password: userForm.password,
          full_name: userForm.full_name,
          username: userForm.username,
          phone: userForm.phone,
          role: userForm.role
        })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erreur création')

      toast.success(`Utilisateur "${userForm.username}" créé avec succès !`)
      setUserModal(false)
      setUserForm(EMPTY_USER)
      loadUsers()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingUser(false)
    }
  }

  // ── MODIFIER UTILISATEUR ──
  async function updateUser() {
    if (!selectedUser) return
    if (editUserForm.username) {
      const conflict = users.find(u => u.username === editUserForm.username && u.id !== selectedUser.id)
      if (conflict) { toast.error('Cet identifiant est déjà utilisé'); return }
    }
    setSavingUser(true)
    try {
      await supabase.from('profiles').update({
        full_name: editUserForm.full_name,
        username: editUserForm.username,
        phone: editUserForm.phone || null,
        role: editUserForm.role,
        is_active: editUserForm.is_active,
      }).eq('id', selectedUser.id)

      toast.success('Utilisateur mis à jour')
      setEditUserModal(false)
      setSelectedUser(null)
      loadUsers()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    } finally {
      setSavingUser(false)
    }
  }

  // ── CHANGER MOT DE PASSE ──
  async function changePassword() {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères')
      return
    }
    setSavingUser(true)
    try {
      const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${functionsUrl}/create-user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ user_id: selectedUser.id, password: newPassword })
      })

      if (!res.ok) {
        // Fallback: utiliser l'API admin directement
        const { error } = await supabase.auth.admin?.updateUserById(selectedUser.id, { password: newPassword })
        if (error) throw error
      }

      toast.success('Mot de passe modifié')
      setPasswordModal(false)
      setNewPassword('')
      setSelectedUser(null)
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    } finally {
      setSavingUser(false)
    }
  }

  async function toggleUserActive(user) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    toast.success(user.is_active ? 'Utilisateur désactivé' : 'Utilisateur activé')
    loadUsers()
  }

  async function deleteUser(user) {
    if (user.id === currentProfile?.id) { toast.error('Vous ne pouvez pas supprimer votre propre compte'); return }
    if (!confirm(`Supprimer définitivement l'utilisateur "${user.email}" ?`)) return
    try {
      await supabase.from('profiles').delete().eq('id', user.id)
      toast.success('Utilisateur supprimé')
      loadUsers()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
  }

  // ── DOSSIERS ──
  async function saveFolder() {
    if (!folderForm.name || !folderForm.year) { toast.error('Nom et année requis'); return }
    try {
      if (editFolder) {
        await supabase.from('folders').update({ name: folderForm.name, year: parseInt(folderForm.year) }).eq('id', editFolder.id)
        toast.success('Dossier modifié')
      } else {
        await supabase.from('folders').insert({ name: folderForm.name, year: parseInt(folderForm.year) })
        toast.success('Dossier créé')
      }
      setFolderModal(false); setEditFolder(null)
      setFolderForm({ name: '', year: new Date().getFullYear() })
      loadFolders()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  async function deleteFolder(folder) {
    const count = documents.filter(d => d.folder_id === folder.id).length
    const msg = count > 0
      ? `Ce dossier contient ${count} document(s) qui seront déplacés hors dossier. Continuer ?`
      : `Supprimer le dossier "${folder.name}" ?`
    if (!confirm(msg)) return
    if (count > 0) await supabase.from('documents').update({ folder_id: null }).eq('folder_id', folder.id)
    await supabase.from('folders').delete().eq('id', folder.id)
    toast.success('Dossier supprimé')
    loadAll()
  }

  // ── DOCUMENTS ──
  async function uploadDocument() {
    if (!docForm.file || !docForm.title) { toast.error('Titre et fichier PDF requis'); return }
    setUploading(true)
    try {
      const fileName = `${Date.now()}_${docForm.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const folder = folders.find(f => f.id === docForm.folder_id)
      const filePath = `${folder ? folder.year : 'divers'}/${fileName}`
      const { error: uploadErr } = await supabase.storage.from('pdfs').upload(filePath, docForm.file, { contentType: 'application/pdf' })
      if (uploadErr) throw uploadErr
      const { error: dbErr } = await supabase.from('documents').insert({
        title: docForm.title, description: docForm.description,
        folder_id: docForm.folder_id || null, file_path: filePath, file_size: docForm.file.size,
      })
      if (dbErr) throw dbErr
      const { data: activeUsers } = await supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'user')
      if (activeUsers?.length) {
        await supabase.from('notifications').insert(activeUsers.map(u => ({
          user_id: u.id, type: 'new_document',
          title: '📄 Nouveau document disponible',
          message: `"${docForm.title}" a été publié${folder ? ' dans ' + folder.name : ''}`,
        })))
      }
      toast.success('Document publié !')
      setUploadModal(false); setDocForm({ title: '', description: '', folder_id: '', file: null })
      loadAll()
    } catch (err) { toast.error('Erreur: ' + err.message) }
    finally { setUploading(false) }
  }

  async function updateDocument() {
    if (!editDoc) return
    setUploading(true)
    try {
      let filePath = editDoc.file_path
      if (docForm.file) {
        const folder = folders.find(f => f.id === (docForm.folder_id || editDoc.folder_id))
        const fileName = `${Date.now()}_${docForm.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        filePath = `${folder ? folder.year : 'divers'}/${fileName}`
        await supabase.storage.from('pdfs').upload(filePath, docForm.file, { contentType: 'application/pdf' })
        await supabase.storage.from('pdfs').remove([editDoc.file_path])
      }
      await supabase.from('documents').update({
        title: docForm.title || editDoc.title, description: docForm.description,
        folder_id: docForm.folder_id || null, file_path: filePath,
        version: editDoc.version + (docForm.file ? 1 : 0),
      }).eq('id', editDoc.id)
      if (docForm.file) {
        const { data: viewers } = await supabase.from('document_views').select('user_id').eq('document_id', editDoc.id)
        const uniq = [...new Set(viewers?.map(v => v.user_id))]
        if (uniq.length) await supabase.from('notifications').insert(uniq.map(uid => ({
          user_id: uid, document_id: editDoc.id, type: 'updated_document',
          title: '🔄 Document mis à jour', message: `"${docForm.title || editDoc.title}" a été mis à jour`,
        })))
      }
      toast.success('Document mis à jour')
      setEditDoc(null); setDocForm({ title: '', description: '', folder_id: '', file: null })
      setUploadModal(false); loadAll()
    } catch (err) { toast.error('Erreur: ' + err.message) }
    finally { setUploading(false) }
  }

  async function deleteDocument(doc) {
    if (!confirm(`Supprimer "${doc.title}" ?`)) return
    try {
      await supabase.storage.from('pdfs').remove([doc.file_path])
      await supabase.from('documents').update({ is_active: false }).eq('id', doc.id)
      toast.success('Document supprimé'); loadDocuments()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  const tabIcons = { documents: '📄', dossiers: '📁', utilisateurs: '👥', statistiques: '📊', connexions: '🕐' }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>← Tableau de bord</button>
          <h1 className="font-display admin-title">Administration</h1>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-secondary" onClick={() => { setEditFolder(null); setFolderForm({ name: '', year: new Date().getFullYear() }); setFolderModal(true) }}>+ Nouveau dossier</button>
          <button className="btn btn-secondary" onClick={() => { setUserForm(EMPTY_USER); setUserModal(true) }}>+ Créer utilisateur</button>
          <button className="btn btn-primary" onClick={() => { setEditDoc(null); setDocForm({ title: '', description: '', folder_id: '', file: null }); setUploadModal(true) }}>+ Ajouter PDF</button>
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
          <div>
            <div className="filters-bar">
              <SearchBar value={docSearch} onChange={setDocSearch} placeholder="Rechercher un document..." />
              <select className="filter-select" value={docFolderFilter} onChange={e => setDocFolderFilter(e.target.value)}>
                <option value="">Tous les dossiers</option>
                <option value="__none__">Sans dossier</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <select className="filter-select" value={docStatusFilter} onChange={e => setDocStatusFilter(e.target.value)}>
                <option value="">Tous les statuts</option>
                <option value="actif">Actif</option>
                <option value="archive">Archivé</option>
              </select>
              <span className="filter-count">{filteredDocs.length} résultat{filteredDocs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortHeader label="Titre" field="title" sortField={docSort.field} sortDir={docSort.dir} onSort={f => toggleSort(docSort, f, setDocSort)} />
                    <th>Dossier</th>
                    <SortHeader label="Version" field="version" sortField={docSort.field} sortDir={docSort.dir} onSort={f => toggleSort(docSort, f, setDocSort)} />
                    <SortHeader label="Taille" field="file_size" sortField={docSort.field} sortDir={docSort.dir} onSort={f => toggleSort(docSort, f, setDocSort)} />
                    <SortHeader label="Publié le" field="published_at" sortField={docSort.field} sortDir={docSort.dir} onSort={f => toggleSort(docSort, f, setDocSort)} />
                    <th>Statut</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map(doc => (
                    <tr key={doc.id}>
                      <td className="td-title">{doc.title}</td>
                      <td><span className="tag">{doc.folders?.name || <em style={{color:'var(--text-muted)'}}>Sans dossier</em>}</span></td>
                      <td><span className="tag blue">v{doc.version}</span></td>
                      <td>{doc.file_size ? `${(doc.file_size/1024/1024).toFixed(1)} Mo` : '—'}</td>
                      <td>{format(new Date(doc.published_at), 'dd/MM/yyyy', { locale: fr })}</td>
                      <td><span className={`status-dot ${doc.is_active ? 'active' : 'inactive'}`}>{doc.is_active ? 'Actif' : 'Archivé'}</span></td>
                      <td className="td-actions">
                        <button className="btn btn-ghost" onClick={() => { setEditDoc(doc); setDocForm({ title: doc.title, description: doc.description || '', folder_id: doc.folder_id || '', file: null }); setUploadModal(true) }}>Modifier</button>
                        <button className="btn btn-danger" onClick={() => deleteDocument(doc)}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                  {filteredDocs.length === 0 && <tr><td colSpan={7} className="td-empty">Aucun résultat</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DOSSIERS ── */}
        {tab === 'dossiers' && (
          <div>
            <div className="filters-bar">
              <SearchBar value={folderSearch} onChange={setFolderSearch} placeholder="Rechercher un dossier..." />
              <button className={`filter-sort-btn ${folderSort.field === 'year' ? 'active' : ''}`} onClick={() => toggleSort(folderSort, 'year', setFolderSort)}>Année {folderSort.field === 'year' ? (folderSort.dir === 'asc' ? '↑' : '↓') : '↕'}</button>
              <button className={`filter-sort-btn ${folderSort.field === 'name' ? 'active' : ''}`} onClick={() => toggleSort(folderSort, 'name', setFolderSort)}>Nom {folderSort.field === 'name' ? (folderSort.dir === 'asc' ? '↑' : '↓') : '↕'}</button>
              <span className="filter-count">{filteredFolders.length} dossier{filteredFolders.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="folders-grid">
              {filteredFolders.map(folder => {
                const docCount = documents.filter(d => d.folder_id === folder.id).length
                return (
                  <div key={folder.id} className="folder-card">
                    <div className="folder-card-icon">📁</div>
                    <div className="folder-card-body">
                      <div className="folder-card-name">{folder.name}</div>
                      <div className="folder-card-meta">{folder.year} · {docCount} document{docCount !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="folder-card-actions">
                      <button className="btn btn-ghost" onClick={() => { setEditFolder(folder); setFolderForm({ name: folder.name, year: folder.year }); setFolderModal(true) }}>Modifier</button>
                      <button className="btn btn-danger" onClick={() => deleteFolder(folder)}>Supprimer</button>
                    </div>
                  </div>
                )
              })}
              {filteredFolders.length === 0 && (
                <div className="empty-state" style={{gridColumn:'1/-1'}}>
                  <div style={{fontSize:48}}>📁</div>
                  <h3>{folderSearch ? 'Aucun résultat' : 'Aucun dossier'}</h3>
                  {!folderSearch && <button className="btn btn-primary" onClick={() => { setEditFolder(null); setFolderForm({ name: '', year: new Date().getFullYear() }); setFolderModal(true) }}>+ Créer un dossier</button>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── UTILISATEURS ── */}
        {tab === 'utilisateurs' && (
          <div>
            <div className="filters-bar">
              <SearchBar value={userSearch} onChange={setUserSearch} placeholder="Nom, email, identifiant, téléphone..." />
              <select className="filter-select" value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}>
                <option value="">Tous les rôles</option>
                <option value="admin">Administrateur</option>
                <option value="user">Utilisateur</option>
              </select>
              <select className="filter-select" value={userStatusFilter} onChange={e => setUserStatusFilter(e.target.value)}>
                <option value="">Tous les statuts</option>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
              <span className="filter-count">{filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortHeader label="Identifiant" field="username" sortField={userSort.field} sortDir={userSort.dir} onSort={f => toggleSort(userSort, f, setUserSort)} />
                    <SortHeader label="Nom" field="full_name" sortField={userSort.field} sortDir={userSort.dir} onSort={f => toggleSort(userSort, f, setUserSort)} />
                    <SortHeader label="Email" field="email" sortField={userSort.field} sortDir={userSort.dir} onSort={f => toggleSort(userSort, f, setUserSort)} />
                    <th>Téléphone</th>
                    <th>Rôle</th>
                    <SortHeader label="Créé le" field="created_at" sortField={userSort.field} sortDir={userSort.dir} onSort={f => toggleSort(userSort, f, setUserSort)} />
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td><code className="username-code">{u.username || '—'}</code></td>
                      <td className="td-title">{u.full_name || '—'}</td>
                      <td style={{fontSize:12}}>{u.email}</td>
                      <td style={{fontSize:12}}>{u.phone || '—'}</td>
                      <td><span className={`tag ${u.role === 'admin' ? 'blue' : ''}`}>{u.role}</span></td>
                      <td>{format(new Date(u.created_at), 'dd/MM/yyyy', { locale: fr })}</td>
                      <td><span className={`status-dot ${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'Actif' : 'Inactif'}</span></td>
                      <td className="td-actions">
                        <button className="btn btn-ghost" onClick={() => {
                          setSelectedUser(u)
                          setEditUserForm({ full_name: u.full_name || '', username: u.username || '', phone: u.phone || '', role: u.role, is_active: u.is_active })
                          setEditUserModal(true)
                        }}>Modifier</button>
                        <button className="btn btn-ghost" onClick={() => { setSelectedUser(u); setNewPassword(''); setPasswordModal(true) }}>
                          🔑 MDP
                        </button>
                        <button className="btn btn-danger" onClick={() => deleteUser(u)}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && <tr><td colSpan={8} className="td-empty">Aucun résultat</td></tr>}
                </tbody>
              </table>
            </div>
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
            <div className="filters-bar">
              <SearchBar value={statsSearch} onChange={setStatsSearch} placeholder="Rechercher un document..." />
              <span className="filter-count">{filteredStats.length} document{filteredStats.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rang</th>
                    <SortHeader label="Document" field="title" sortField={statsSort.field} sortDir={statsSort.dir} onSort={f => toggleSort(statsSort, f, setStatsSort)} />
                    <SortHeader label="Consultations" field="total_views" sortField={statsSort.field} sortDir={statsSort.dir} onSort={f => toggleSort(statsSort, f, setStatsSort)} />
                    <SortHeader label="Lecteurs uniques" field="unique_viewers" sortField={statsSort.field} sortDir={statsSort.dir} onSort={f => toggleSort(statsSort, f, setStatsSort)} />
                    <SortHeader label="Dernière vue" field="last_viewed_at" sortField={statsSort.field} sortDir={statsSort.dir} onSort={f => toggleSort(statsSort, f, setStatsSort)} />
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map((s,i) => (
                    <tr key={s.id}>
                      <td><span className={`rank ${i<3?'top':''}`}>#{i+1}</span></td>
                      <td className="td-title">{s.title}</td>
                      <td><strong>{s.total_views}</strong></td>
                      <td>{s.unique_viewers}</td>
                      <td>{s.last_viewed_at ? format(new Date(s.last_viewed_at),'dd/MM/yyyy HH:mm',{locale:fr}) : '—'}</td>
                    </tr>
                  ))}
                  {filteredStats.length === 0 && <tr><td colSpan={5} className="td-empty">Aucune consultation enregistrée</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CONNEXIONS ── */}
        {tab === 'connexions' && (
          <div>
            <div className="filters-bar">
              <SearchBar value={connSearch} onChange={setConnSearch} placeholder="Email, nom ou IP..." />
              <select className="filter-select" value={connDeviceFilter} onChange={e => setConnDeviceFilter(e.target.value)}>
                <option value="">Tous les appareils</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablette</option>
              </select>
              <span className="filter-count">{filteredConn.length} connexion{filteredConn.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortHeader label="Utilisateur" field="logged_in_at" sortField={connSort.field} sortDir={connSort.dir} onSort={f => toggleSort(connSort, f, setConnSort)} />
                    <SortHeader label="Date" field="logged_in_at" sortField={connSort.field} sortDir={connSort.dir} onSort={f => toggleSort(connSort, f, setConnSort)} />
                    <th>IP</th><th>Appareil</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConn.map(log => (
                    <tr key={log.id}>
                      <td>{log.profiles?.email || '—'}<br/><small style={{color:'var(--text-muted)'}}>{log.profiles?.full_name}</small></td>
                      <td>{format(new Date(log.logged_in_at),'dd/MM/yyyy HH:mm',{locale:fr})}</td>
                      <td><code>{log.ip_address || '—'}</code></td>
                      <td><span className="tag">{log.device_type || '—'}</span></td>
                    </tr>
                  ))}
                  {filteredConn.length === 0 && <tr><td colSpan={4} className="td-empty">Aucune connexion enregistrée</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: Créer utilisateur ── */}
      {userModal && (
        <div className="modal-overlay" onClick={() => setUserModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">Créer un utilisateur</h3>
              <button className="btn btn-ghost" onClick={() => setUserModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Identifiant unique *</label>
                  <input className="input" placeholder="ex: jdupont" value={userForm.username} onChange={e => setUserForm(p=>({...p,username:e.target.value.toLowerCase().replace(/\s/g,'')}))} />
                  <span className="form-hint">Utilisé pour la connexion, sans espaces</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Nom complet</label>
                  <input className="input" placeholder="Jean Dupont" value={userForm.full_name} onChange={e => setUserForm(p=>({...p,full_name:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="input" type="email" placeholder="jean@exemple.com" value={userForm.email} onChange={e => setUserForm(p=>({...p,email:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input className="input" type="tel" placeholder="+33 6 00 00 00 00" value={userForm.phone} onChange={e => setUserForm(p=>({...p,phone:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Mot de passe * (min. 8 caractères)</label>
                  <div className="input-with-icon">
                    <input className="input" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={userForm.password} onChange={e => setUserForm(p=>({...p,password:e.target.value}))} />
                    <button className="input-icon-btn" onClick={() => setShowPassword(p => !p)} type="button">{showPassword ? '🙈' : '👁️'}</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Rôle</label>
                  <select className="input" value={userForm.role} onChange={e => setUserForm(p=>({...p,role:e.target.value}))}>
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setUserModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={createUser} disabled={savingUser}>
                {savingUser ? 'Création...' : 'Créer l\'utilisateur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Modifier utilisateur ── */}
      {editUserModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setEditUserModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">Modifier {selectedUser.full_name || selectedUser.email}</h3>
              <button className="btn btn-ghost" onClick={() => setEditUserModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="user-info-readonly">
                <span className="info-label">Email (non modifiable)</span>
                <span className="info-value">{selectedUser.email}</span>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Identifiant unique</label>
                  <input className="input" placeholder="identifiant" value={editUserForm.username} onChange={e => setEditUserForm(p=>({...p,username:e.target.value.toLowerCase().replace(/\s/g,'')}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom complet</label>
                  <input className="input" placeholder="Nom Prénom" value={editUserForm.full_name} onChange={e => setEditUserForm(p=>({...p,full_name:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input className="input" type="tel" placeholder="+33 6 00 00 00 00" value={editUserForm.phone} onChange={e => setEditUserForm(p=>({...p,phone:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Rôle</label>
                  <select className="input" value={editUserForm.role} onChange={e => setEditUserForm(p=>({...p,role:e.target.value}))}>
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Statut</label>
                  <select className="input" value={editUserForm.is_active ? 'actif' : 'inactif'} onChange={e => setEditUserForm(p=>({...p,is_active:e.target.value==='actif'}))}>
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditUserModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={updateUser} disabled={savingUser}>
                {savingUser ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Changer mot de passe ── */}
      {passwordModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">Changer le mot de passe</h3>
              <button className="btn btn-ghost" onClick={() => setPasswordModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="user-info-readonly">
                <span className="info-label">Utilisateur</span>
                <span className="info-value">{selectedUser.full_name || selectedUser.email}</span>
              </div>
              <div className="form-group">
                <label className="form-label">Nouveau mot de passe * (min. 8 caractères)</label>
                <div className="input-with-icon">
                  <input className="input" type={showPassword ? 'text' : 'password'} placeholder="Nouveau mot de passe" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  <button className="input-icon-btn" onClick={() => setShowPassword(p=>!p)} type="button">{showPassword ? '🙈' : '👁️'}</button>
                </div>
              </div>
              <div className="modal-info">
                Le mot de passe sera changé immédiatement. Communiquez-le à l'utilisateur de manière sécurisée.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPasswordModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={changePassword} disabled={savingUser}>
                {savingUser ? 'Modification...' : 'Changer le mot de passe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PDF ── */}
      {uploadModal && (
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
                <label className="form-label">Fichier PDF {editDoc && <span style={{color:'var(--text-muted)',fontWeight:400}}>(laisser vide pour ne pas modifier)</span>}</label>
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
                <label className="form-label">Nom *</label>
                <input className="input" placeholder="ex: Documents 2025" value={folderForm.name} onChange={e => setFolderForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Année *</label>
                <input className="input" type="number" min="2000" max="2100" value={folderForm.year} onChange={e => setFolderForm(p=>({...p,year:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setFolderModal(false); setEditFolder(null) }}>Annuler</button>
              <button className="btn btn-primary" onClick={saveFolder}>{editFolder ? 'Modifier' : 'Créer'}</button>
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
        .filters-bar { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
        .filter-search { display:flex; align-items:center; gap:8px; background:var(--bg-input); border:1px solid var(--border-strong); border-radius:var(--radius); padding:8px 14px; min-width:220px; flex:1; max-width:320px; }
        .filter-search svg { color:var(--text-muted); flex-shrink:0; }
        .filter-input { background:transparent; border:none; outline:none; color:var(--text-primary); font-size:13px; font-family:var(--font-body); flex:1; min-width:0; }
        .filter-input::placeholder { color:var(--text-muted); }
        .filter-clear { background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:12px; }
        .filter-select { background:var(--bg-input); border:1px solid var(--border-strong); border-radius:var(--radius); padding:8px 12px; color:var(--text-secondary); font-size:13px; font-family:var(--font-body); cursor:pointer; outline:none; }
        .filter-sort-btn { background:var(--bg-elevated); border:1px solid var(--border-strong); border-radius:var(--radius); padding:8px 14px; color:var(--text-secondary); font-size:13px; cursor:pointer; font-family:var(--font-body); transition:all var(--transition); }
        .filter-sort-btn.active { background:var(--accent-dim); border-color:var(--accent-border); color:var(--accent); }
        .filter-count { font-size:12px; color:var(--text-muted); margin-left:auto; white-space:nowrap; }
        .data-table-wrapper { overflow-x:auto; border-radius:var(--radius-lg); border:1px solid var(--border); }
        .data-table { width:100%; border-collapse:collapse; }
        .data-table th { background:var(--bg-secondary); padding:12px 16px; text-align:left; font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-muted); border-bottom:1px solid var(--border); white-space:nowrap; }
        .data-table th.sortable { cursor:pointer; user-select:none; }
        .data-table th.sortable:hover { color:var(--text-secondary); }
        .data-table th.sort-active { color:var(--accent); }
        .sort-icon { font-size:10px; opacity:0.6; }
        .data-table td { padding:12px 16px; font-size:13px; color:var(--text-secondary); border-bottom:1px solid var(--border); vertical-align:middle; }
        .data-table tr:last-child td { border-bottom:none; }
        .data-table tr:hover td { background:var(--bg-elevated); }
        .td-title { font-weight:500; color:var(--text-primary) !important; max-width:220px; }
        .td-actions { display:flex; gap:4px; align-items:center; white-space:nowrap; }
        .td-empty { text-align:center; padding:32px !important; color:var(--text-muted); font-style:italic; }
        .tag { display:inline-block; padding:3px 8px; background:var(--bg-elevated); border-radius:99px; font-size:11px; color:var(--text-secondary); }
        .tag.blue { background:var(--blue-dim); color:var(--blue-light); }
        .status-dot { display:inline-flex; align-items:center; gap:5px; font-size:12px; }
        .status-dot::before { content:''; width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .status-dot.active { color:var(--success); }
        .status-dot.active::before { background:var(--success); }
        .status-dot.inactive { color:var(--text-muted); }
        .status-dot.inactive::before { background:var(--text-muted); }
        .username-code { font-family:monospace; font-size:12px; background:var(--bg-elevated); padding:2px 7px; border-radius:4px; color:var(--accent); }
        .folders-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
        .folder-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:20px; display:flex; align-items:center; gap:16px; }
        .folder-card-icon { font-size:32px; flex-shrink:0; }
        .folder-card-body { flex:1; min-width:0; }
        .folder-card-name { font-size:15px; font-weight:600; color:var(--text-primary); margin-bottom:4px; }
        .folder-card-meta { font-size:12px; color:var(--text-muted); }
        .folder-card-actions { display:flex; gap:6px; flex-shrink:0; }
        .stats-summary { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:16px; margin-bottom:24px; }
        .stat-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:20px; }
        .stat-value { font-size:32px; font-weight:800; font-family:var(--font-display); color:var(--accent); line-height:1; margin-bottom:6px; }
        .stat-label { font-size:13px; color:var(--text-secondary); }
        .rank { font-weight:700; color:var(--text-muted); }
        .rank.top { color:var(--accent); }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:24px; animation:fadeIn 0.15s ease; }
        .modal { background:var(--bg-card); border:1px solid var(--border-strong); border-radius:var(--radius-xl); width:100%; max-width:500px; box-shadow:var(--shadow-lg); overflow:hidden; max-height:90vh; display:flex; flex-direction:column; }
        .modal-lg { max-width:680px; }
        .modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid var(--border); font-size:16px; font-weight:700; color:var(--text-primary); flex-shrink:0; }
        .modal-body { padding:24px; display:flex; flex-direction:column; gap:16px; overflow-y:auto; }
        .modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:16px 24px; border-top:1px solid var(--border); flex-shrink:0; }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media (max-width:600px) { .form-grid { grid-template-columns:1fr; } }
        .form-group { display:flex; flex-direction:column; gap:8px; }
        .form-label { font-size:13px; font-weight:500; color:var(--text-secondary); }
        .form-hint { font-size:11px; color:var(--text-muted); }
        .input-with-icon { position:relative; }
        .input-with-icon .input { padding-right:44px; }
        .input-icon-btn { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:transparent; border:none; cursor:pointer; font-size:16px; }
        .user-info-readonly { display:flex; flex-direction:column; gap:4px; padding:12px 14px; background:var(--bg-elevated); border-radius:var(--radius); margin-bottom:4px; }
        .info-label { font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; }
        .info-value { font-size:14px; color:var(--text-primary); font-weight:500; }
        .modal-info { padding:12px 14px; background:var(--blue-dim); border:1px solid rgba(59,130,246,0.2); border-radius:var(--radius); font-size:13px; color:var(--blue-light); line-height:1.6; }
        .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 24px; gap:12px; color:var(--text-muted); text-align:center; }
        .empty-state h3 { font-size:18px; color:var(--text-secondary); font-family:var(--font-display); }
        textarea.input { resize:vertical; min-height:80px; }
        select.input { cursor:pointer; }
        code { font-family:monospace; font-size:12px; }
      `}</style>
    </div>
  )
}
