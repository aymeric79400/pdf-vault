import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

const TABS = ['documents', 'dossiers', 'services', 'utilisateurs', 'statistiques', 'connexions']

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="filter-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input className="filter-input" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
        name="search-field" type="search" />
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

const EMPTY_USER = { email: '', password: '', full_name: '', username: '', phone: '', role: 'user', services: [] }
const INTERNAL_DOMAIN = 'planning-viewer.internal'

export default function AdminPage() {
  const { isAdmin, profile: currentProfile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('documents')
  const [documents, setDocuments] = useState([])
  const [folders, setFolders] = useState([])
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState([])
  const [loginHistory, setLoginHistory] = useState([])
  const [services, setServices] = useState([])
  const [userServicesMap, setUserServicesMap] = useState({}) // { user_id: [service_id] }
  const [documentFoldersMap, setDocumentFoldersMap] = useState({}) // { document_id: [folder_id] }
  const [folderServicesMap, setFolderServicesMap] = useState({}) // { folder_id: [service_id] }

  // Modals
  const [uploadModal, setUploadModal] = useState(false)
  const [folderModal, setFolderModal] = useState(false)
  const [userModal, setUserModal] = useState(false)
  const [editUserModal, setEditUserModal] = useState(false)
  const [passwordModal, setPasswordModal] = useState(false)
  const [editDoc, setEditDoc] = useState(null)
  const [serviceModal, setServiceModal] = useState(false)
  const [editService, setEditService] = useState(null)
  const [serviceForm, setServiceForm] = useState({ name: '' })
  const [userServiceModal, setUserServiceModal] = useState(false)
  const [selectedUserForService, setSelectedUserForService] = useState(null)
  const [editFolder, setEditFolder] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)

  // Forms
  const [docForm, setDocForm] = useState({ title: '', description: '', folder_ids: [], service_ids: [], file: null })
  const [docFormService, setDocFormService] = useState('')
  const [folderForm, setFolderForm] = useState({ name: '', year: new Date().getFullYear(), service_ids: [] })
  const [userForm, setUserForm] = useState(EMPTY_USER)
  const [editUserForm, setEditUserForm] = useState({})


  // Formate le téléphone : 10 chiffres max, espace tous les 2 (06 12 34 56 78)
  function formatPhone(str) {
    const digits = str.replace(/\D/g, '').slice(0, 10)
    return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  }

  // Formate "nom prénom" → "Nom Prénom" (chaque mot capitalisé, tirets gérés)
  function formatFullName(str) {
    if (!str) return str
    return str
      .split(' ')
      .map(word => word.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('-'))
      .join(' ')
  }

  const [newPassword, setNewPassword] = useState('')
  const [uploading, setUploading] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Filtres documents
  const [docSearch, setDocSearch] = useState('')
  const [docFolderFilter, setDocFolderFilter] = useState('')
  const [docStatusFilter, setDocStatusFilter] = useState('')
  const [docServiceFilter, setDocServiceFilter] = useState('')
  const [docSort, setDocSort] = useState({ field: 'published_at', dir: 'desc' })

  // Filtres dossiers
  const [folderSearch, setFolderSearch] = useState('')
  const [folderStatusFilter, setFolderStatusFilter] = useState('')
  const [folderServiceFilter, setFolderServiceFilter] = useState('')
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
    await Promise.all([loadDocuments(), loadFolders(), loadUsers(), loadStats(), loadLoginHistory(), loadServices()])
  }

  async function loadDocuments() {
    const { data } = await supabase.from('documents').select('*').order('published_at', { ascending: false })
    if (data) setDocuments(data)
    // Charger les relations document→dossiers
    const { data: df } = await supabase.from('document_folders').select('document_id, folder_id')
    if (df) {
      const map = {}
      df.forEach(r => { if (!map[r.document_id]) map[r.document_id] = []; map[r.document_id].push(r.folder_id) })
      setDocumentFoldersMap(map)
    }
  }
  async function loadFolders() {
    const { data } = await supabase.from('folders').select('*').order('name')
    if (data) setFolders(data)
    // Charger les relations dossier→services
    const { data: fs } = await supabase.from('folder_services').select('folder_id, service_id')
    if (fs) {
      const map = {}
      fs.forEach(r => { if (!map[r.folder_id]) map[r.folder_id] = []; map[r.folder_id].push(r.service_id) })
      setFolderServicesMap(map)
    }
  }
  async function loadServices() {
    const { data } = await supabase.from('services').select('*').order('name')
    if (data) setServices(data)
    const { data: us } = await supabase.from('user_services').select('user_id, service_id')
    if (us) {
      const map = {}
      us.forEach(r => { if (!map[r.user_id]) map[r.user_id] = []; map[r.user_id].push(r.service_id) })
      setUserServicesMap(map)
    }
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
    const { data } = await supabase.from('login_history').select('*, profiles(email, full_name, username)').order('logged_in_at', { ascending: false }).limit(500)
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
    if (docFolderFilter === '__none__') d = d.filter(x => !x.document_folders?.length)
    else if (docFolderFilter) d = d.filter(x => (documentFoldersMap[x.id] || []).includes(docFolderFilter))
    if (docStatusFilter) d = d.filter(x => docStatusFilter === 'visible' ? x.is_active : !x.is_active)
    if (docServiceFilter === '__none__') d = d.filter(x =>
      !(x.document_folders || []).some(df => (df.folders?.folder_services || []).length > 0)
    )
    else if (docServiceFilter) d = d.filter(x =>
      (x.document_folders || []).some(df =>
        (df.folders?.folder_services || []).some(fs => fs.service_id === docServiceFilter)
      )
    )
    return applySort(d, docSort)
  }, [documents, folders, docSearch, docFolderFilter, docStatusFilter, docServiceFilter, docSort])

  const filteredFolders = useMemo(() => {
    let d = folders
    if (folderSearch) d = d.filter(x => x.name.toLowerCase().includes(folderSearch.toLowerCase()) || String(x.year).includes(folderSearch))
    if (folderStatusFilter) d = d.filter(x => folderStatusFilter === 'visible' ? x.is_active : !x.is_active)
    if (folderServiceFilter === '__none__') d = d.filter(x => !(x.folder_services || []).length)
    else if (folderServiceFilter) d = d.filter(x => (x.folder_services || []).some(fs => fs.service_id === folderServiceFilter))
    return applySort(d, folderSort)
  }, [folders, folderSearch, folderStatusFilter, folderServiceFilter, folderSort])

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
    if (connSearch) d = d.filter(x => (x.profiles?.username||'').toLowerCase().includes(connSearch.toLowerCase()) || (x.profiles?.full_name||'').toLowerCase().includes(connSearch.toLowerCase()) || (x.ip_address||'').includes(connSearch))
    if (connDeviceFilter) d = d.filter(x => x.device_type === connDeviceFilter)
    return applySort(d, connSort)
  }, [loginHistory, connSearch, connDeviceFilter, connSort])


  // ── SERVICES ──
  async function createService() {
    if (!serviceForm.name.trim()) { toast.error('Nom du service requis'); return }
    const { error } = await supabase.from('services').insert({ name: serviceForm.name.trim() })
    if (error) { toast.error('Erreur: ' + error.message); return }
    toast.success('Service créé !')
    setServiceModal(false); setServiceForm({ name: '' }); loadServices()
  }

  async function updateService() {
    if (!editService || !serviceForm.name.trim()) return
    await supabase.from('services').update({ name: serviceForm.name.trim() }).eq('id', editService.id)
    toast.success('Service mis à jour')
    setServiceModal(false); setEditService(null); setServiceForm({ name: '' }); loadServices()
  }

  async function toggleServiceActive(service) {
    await supabase.from('services').update({ is_active: !service.is_active }).eq('id', service.id)
    // Le trigger SQL cascade aux dossiers
    toast.success(service.is_active ? 'Service désactivé (dossiers masqués)' : 'Service activé')
    loadServices(); loadFolders()
  }

  async function deleteService(service) {
    if (!confirm(`Supprimer le service "${service.name}" ? Les dossiers associés seront détachés.`)) return
    await supabase.from('services').delete().eq('id', service.id)
    toast.success('Service supprimé'); loadServices(); loadFolders()
  }

  async function saveUserServices(userId, selectedServiceIds) {
    // Supprimer toutes les affectations existantes
    await supabase.from('user_services').delete().eq('user_id', userId)
    // Réinsérer les nouvelles
    if (selectedServiceIds.length > 0) {
      await supabase.from('user_services').insert(selectedServiceIds.map(sid => ({ user_id: userId, service_id: sid })))
    }
    toast.success('Services mis à jour')
    setUserServiceModal(false); setSelectedUserForService(null); loadServices()
  }

  // ── CRÉER UTILISATEUR ──
  async function createUser() {
    if (!userForm.password || !userForm.username) {
      toast.error('Identifiant et mot de passe sont requis')
      return
    }
    if (userForm.password.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères')
      return
    }
    // Vérifier unicité username
    const conflict = users.find(u => u.username === userForm.username.toLowerCase().trim())
    if (conflict) { toast.error('Cet identifiant est déjà utilisé'); return }

    setSavingUser(true)
    try {
      const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      // Email fictif interne si pas d'email réel fourni
      const authEmail = userForm.email?.trim() || `${userForm.username.toLowerCase().trim()}@${INTERNAL_DOMAIN}`

      const res = await fetch(`${functionsUrl}/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          email: authEmail,
          password: userForm.password,
          full_name: userForm.full_name,
          username: userForm.username.toLowerCase().trim(),
          phone: userForm.phone,
          role: userForm.role,
          contact_email: userForm.email?.trim() || null // email réel pour notifications
        })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erreur création')

      // Affecter les services si sélectionnés
      if (userForm.services?.length > 0) {
        await supabase.from('user_services').insert(
          userForm.services.map(sid => ({ user_id: result.user_id, service_id: sid }))
        )
      }
      toast.success(`Utilisateur "${userForm.username}" créé avec succès !`)
      setUserModal(false)
      setUserForm(EMPTY_USER)
      loadUsers(); loadServices()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingUser(false)
    }
  }

  async function updateUser() {
    if (!selectedUser) return
    if (editUserForm.username) {
      const conflict = users.find(u => u.username === editUserForm.username && u.id !== selectedUser.id)
      if (conflict) { toast.error('Cet identifiant est déjà utilisé'); return }
    }
    // Vérifier doublon email uniquement si c'est un vrai email (pas fictif)
    if (editUserForm.email && !editUserForm.email.includes(INTERNAL_DOMAIN)) {
      const conflict = users.find(u => u.email === editUserForm.email && u.id !== selectedUser.id)
      if (conflict) { toast.error('Cet email est déjà utilisé'); return }
    }
    setSavingUser(true)
    try {
      const currentAuthEmail = selectedUser.email || ''
      const newContactEmail = editUserForm.email?.trim() || null
      const isCurrentFictif = currentAuthEmail.includes(INTERNAL_DOMAIN)
      const newAuthEmail = newContactEmail || (isCurrentFictif ? currentAuthEmail : null)

      // Changer l'email auth uniquement si :
      // - Un vrai email est fourni ET c'était un email fictif avant
      // - OU l'email réel a changé
      const shouldUpdateAuthEmail =
        (newContactEmail && isCurrentFictif) ||
        (newContactEmail && newContactEmail !== currentAuthEmail && !isCurrentFictif)

      if (shouldUpdateAuthEmail && newAuthEmail) {
        const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const res = await fetch(`${functionsUrl}/create-user`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` },
          body: JSON.stringify({ user_id: selectedUser.id, email: newAuthEmail })
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Erreur changement email')
      }

      await supabase.from('profiles').update({
        full_name: editUserForm.full_name,
        username: editUserForm.username,
        email: newContactEmail, // email de contact (peut être null)
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
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const res = await fetch(`${functionsUrl}/create-user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
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

  async function toggleDocActive(doc) {
    await supabase.from('documents').update({ is_active: !doc.is_active }).eq('id', doc.id)
    toast.success(doc.is_active ? 'Document masqué' : 'Document visible')
    loadDocuments()
  }

  async function toggleFolderActive(folder) {
    await supabase.from('folders').update({ is_active: !folder.is_active }).eq('id', folder.id)
    toast.success(folder.is_active ? 'Dossier masqué (et ses documents)' : 'Dossier visible')
    loadFolders()
  }

  async function toggleUserActive(user) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    toast.success(user.is_active ? 'Utilisateur désactivé' : 'Utilisateur activé')
    loadUsers()
  }

  async function deleteUser(user) {
    if (user.id === currentProfile?.id) { toast.error('Vous ne pouvez pas supprimer votre propre compte'); return }
    if (!confirm(`Supprimer définitivement l'utilisateur "${user.username || user.full_name}" ?`)) return
    // Retrait immédiat de l'UI
    setUsers(prev => prev.filter(u => u.id !== user.id))
    try {
      const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || anonKey
      const res = await fetch(`${functionsUrl}/create-user`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: user.id })
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('Edge function error:', err)
      }
      await supabase.from('profiles').delete().eq('id', user.id)
      toast.success('Utilisateur supprimé')
    } catch (err) {
      console.error('deleteUser error:', err)
      toast.error('Erreur lors de la suppression: ' + err.message)
      // En cas d'erreur, recharger la vraie liste
      loadUsers()
    }
  }

  // ── DOSSIERS ──
  async function saveFolder() {
    if (!folderForm.name) { toast.error('Nom requis'); return }
    try {
      let folderId
      if (editFolder) {
        await supabase.from('folders').update({ name: folderForm.name }).eq('id', editFolder.id)
        folderId = editFolder.id
        // Mettre à jour les services
        await supabase.from('folder_services').delete().eq('folder_id', folderId)
      } else {
        const { data } = await supabase.from('folders').insert({ name: folderForm.name, year: new Date().getFullYear() }).select().single()
        folderId = data.id
      }
      // Insérer les nouvelles relations services
      if (folderForm.service_ids?.length > 0) {
        await supabase.from('folder_services').insert(folderForm.service_ids.map(sid => ({ folder_id: folderId, service_id: sid })))
      }
      toast.success(editFolder ? 'Dossier modifié' : 'Dossier créé')
      setFolderModal(false); setEditFolder(null)
      setFolderForm({ name: '', year: new Date().getFullYear(), service_ids: [] })
      loadFolders()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  async function deleteFolder(folder) {
    const count = Object.values(documentFoldersMap).filter(fids => fids.includes(folder.id)).length
    const msg = count > 0
      ? `Ce dossier contient ${count} document(s) qui seront détachés. Continuer ?`
      : `Supprimer le dossier "${folder.name}" ?`
    if (!confirm(msg)) return
    await supabase.from('folders').delete().eq('id', folder.id)
    toast.success('Dossier supprimé')
    loadAll()
  }

  // ── DOCUMENTS ──

  // Envoie un email de notification via l'Edge Function
  async function sendDocumentEmail(type, document) {
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, document }),
      })
    } catch (err) {
      console.warn('Email notification failed (non-blocking):', err)
    }
  }

  async function sendPushNotification(type, document) {
    try {
      await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, document }),
      })
    } catch (err) {
      console.warn('Push notification failed (non-blocking):', err)
    }
  }

  async function testEmailUser(user) {
    if (!user.email) { toast.error('Cet utilisateur n\'a pas d\'email renseigné'); return }
    const lastDoc = documents.filter(d => d.is_active).sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0]
    if (!lastDoc) { toast.error('Aucun document disponible pour le test'); return }
    const folderIds = documentFoldersMap[lastDoc.id] || []
    const folder = folderIds.length > 0 ? folders.find(f => f.id === folderIds[0]) : null
    try {
      const res = await fetch('/api/send-email-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          full_name: user.full_name || '',
          type: 'new_document',
          document: { title: lastDoc.title, description: lastDoc.description || '', folder_name: folder?.name || '' }
        })
      })
      if (res.ok) toast.success(`Email de test envoyé à ${user.email}`)
      else toast.error('Erreur lors de l\'envoi')
    } catch { toast.error('Erreur lors de l\'envoi') }
  }

  async function testPushUser(user) {
    const lastDoc = documents.filter(d => d.is_active).sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0]
    if (!lastDoc) { toast.error('Aucun document disponible pour le test'); return }
    const folderIds2 = documentFoldersMap[lastDoc.id] || []
    const folder = folderIds2.length > 0 ? folders.find(f => f.id === folderIds2[0]) : null
    try {
      const res = await fetch('/api/send-push-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          type: 'new_document',
          document: { title: lastDoc.title, folder_name: folder?.name || '' }
        })
      })
      const data = await res.json()
      if (res.ok && data.sent > 0) toast.success(`Notification push envoyée à ${user.full_name || user.username}`)
      else if (data.sent === 0) toast.error('Aucun appareil enregistré pour cet utilisateur')
      else toast.error('Erreur lors de l\'envoi')
    } catch { toast.error('Erreur lors de l\'envoi') }
  }



  async function uploadDocument() {
    if (!docForm.file || !docForm.title) { toast.error('Titre et fichier PDF requis'); return }
    setUploading(true)
    try {
      const fileName = `${Date.now()}_${docForm.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const filePath = `divers/${fileName}`
      const { error: uploadErr } = await supabase.storage.from('pdfs').upload(filePath, docForm.file, { contentType: 'application/pdf' })
      if (uploadErr) throw uploadErr

      // Insérer le document sans folder_id (géré via document_folders)
      const { data: newDoc, error: dbErr } = await supabase.from('documents').insert({
        title: docForm.title, description: docForm.description,
        file_path: filePath, file_size: docForm.file.size,
      }).select().single()
      if (dbErr) throw dbErr

      // Affecter les dossiers
      if (docForm.folder_ids?.length > 0) {
        await supabase.from('document_folders').insert(
          docForm.folder_ids.map(fid => ({ document_id: newDoc.id, folder_id: fid }))
        )
      }

      // Notifications in-app
      const { data: activeUsers } = await supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'user')
      if (activeUsers?.length) {
        const folderNames = (docForm.folder_ids || []).map(fid => folders.find(f => f.id === fid)?.name).filter(Boolean).join(', ')
        await supabase.from('notifications').insert(activeUsers.map(u => ({
          user_id: u.id, type: 'new_document',
          title: '📄 Nouveau document disponible',
          message: `"${docForm.title}" a été publié${folderNames ? ' dans ' + folderNames : ''}`,
        })))
      }
      toast.success('Document publié !')
      const folderName = (docForm.folder_ids || []).map(fid => folders.find(f => f.id === fid)?.name).filter(Boolean).join(', ')
      await sendDocumentEmail('new_document', { title: docForm.title, description: docForm.description || '', folder_name: folderName })
      await sendPushNotification('new_document', { title: docForm.title, folder_name: folderName })
      setUploadModal(false); setDocForm({ title: '', description: '', folder_ids: [], file: null }); setDocFormService('')
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
        const fileName = `${Date.now()}_${docForm.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        filePath = `divers/${fileName}`
        await supabase.storage.from('pdfs').upload(filePath, docForm.file, { contentType: 'application/pdf' })
        await supabase.storage.from('pdfs').remove([editDoc.file_path])
      }
      await supabase.from('documents').update({
        title: docForm.title || editDoc.title,
        description: docForm.description,
        file_path: filePath,
        version: editDoc.version + (docForm.file ? 1 : 0),
      }).eq('id', editDoc.id)

      // Mettre à jour les dossiers (supprimer puis réinsérer)
      await supabase.from('document_folders').delete().eq('document_id', editDoc.id)
      if (docForm.folder_ids?.length > 0) {
        await supabase.from('document_folders').insert(
          docForm.folder_ids.map(fid => ({ document_id: editDoc.id, folder_id: fid }))
        )
      }

      if (docForm.file) {
        const { data: viewers } = await supabase.from('document_views').select('user_id').eq('document_id', editDoc.id)
        const uniq = [...new Set(viewers?.map(v => v.user_id))]
        if (uniq.length) await supabase.from('notifications').insert(uniq.map(uid => ({
          user_id: uid, document_id: editDoc.id, type: 'updated_document',
          title: '🔄 Document mis à jour', message: `"${docForm.title || editDoc.title}" a été mis à jour`,
        })))
        const folderName = (docForm.folder_ids || []).map(fid => folders.find(f => f.id === fid)?.name).filter(Boolean).join(', ')
        await sendDocumentEmail('updated_document', { title: docForm.title || editDoc.title, description: docForm.description || '', folder_name: folderName })
        await sendPushNotification('updated_document', { title: docForm.title || editDoc.title, folder_name: folderName })
      }
      toast.success('Document mis à jour')
      setEditDoc(null); setDocForm({ title: '', description: '', folder_ids: [], file: null }); setDocFormService('')
      setUploadModal(false); loadAll()
    } catch (err) { toast.error('Erreur: ' + err.message) }
    finally { setUploading(false) }
  }

  async function deleteDocument(doc) {
    if (!confirm(`Supprimer définitivement "${doc.title}" ? Cette action est irréversible.`)) return
    try {
      // Supprimer les relations document_folders
      await supabase.from('document_folders').delete().eq('document_id', doc.id)
      // Supprimer les notifications liées
      await supabase.from('notifications').delete().eq('document_id', doc.id)
      // Supprimer les vues
      await supabase.from('document_views').delete().eq('document_id', doc.id)
      // Supprimer le fichier PDF du storage
      if (doc.file_path) await supabase.storage.from('pdfs').remove([doc.file_path])
      // Supprimer le document en base
      await supabase.from('documents').delete().eq('id', doc.id)
      toast.success('Document supprimé définitivement')
      loadAll()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  const tabIcons = { documents: '📄', dossiers: '📁', services: '🏢', utilisateurs: '👥', statistiques: '📊', connexions: '🕐' }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="btn btn-ghost admin-back" onClick={() => navigate('/dashboard')}>← Tableau de bord</button>
          <h1 className="font-display admin-title">Administration</h1>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-secondary" onClick={() => { setEditFolder(null); setFolderForm({ name: '', year: new Date().getFullYear(), service_ids: [] }); setFolderModal(true) }}>+ Nouveau dossier</button>
          <button className="btn btn-secondary" onClick={() => { setUserForm(EMPTY_USER); setUserModal(true) }}>+ Créer utilisateur</button>
          <button className="btn btn-primary" onClick={() => { setEditDoc(null); setDocForm({ title: '', description: '', folder_ids: [], file: null }); setDocFormService(''); setUploadModal(true) }}>+ Ajouter PDF</button>
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
                <option value="visible">Visible</option>
                <option value="masque">Masqué</option>
              </select>
              <select className="filter-select" value={docServiceFilter} onChange={e => setDocServiceFilter(e.target.value)}>
                <option value="">Tous les services</option>
                <option value="__none__">Non affecté</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span className="filter-count">{filteredDocs.length} résultat{filteredDocs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortHeader label="Titre" field="title" sortField={docSort.field} sortDir={docSort.dir} onSort={f => toggleSort(docSort, f, setDocSort)} />
                    <th>Dossier</th>
                    <th>Service</th>
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
                      <td>
                        {(documentFoldersMap[doc.id] || []).length === 0
                          ? <em style={{fontSize:11,color:'var(--text-light)'}}>Sans dossier</em>
                          : (documentFoldersMap[doc.id] || []).map(fid => {
                              const f = folders.find(x => x.id === fid)
                              return f ? <span key={fid} className="tag" style={{marginRight:3}}>{f.name}</span> : null
                            })
                        }
                      </td>
                      <td>
                        {(() => {
                          const folderIds = documentFoldersMap[doc.id] || []
                          const serviceIds = [...new Set(folderIds.flatMap(fid => folderServicesMap[fid] || []))]
                          const serviceNames = serviceIds.map(sid => services.find(s => s.id === sid)?.name).filter(Boolean)
                          return serviceNames.length === 0
                            ? <span style={{fontSize:11,color:'var(--text-light)',fontStyle:'italic'}}>Non affecté</span>
                            : serviceNames.map((name, i) => (
                                <span key={i} className="tag" style={{background:'var(--green-soft)',color:'var(--green-deep)',borderColor:'var(--green-border)',marginRight:3}}>{name}</span>
                              ))
                        })()}
                      </td>
                      <td><span className="tag blue">v{doc.version}</span></td>
                      <td>{doc.file_size ? `${(doc.file_size/1024/1024).toFixed(1)} Mo` : '—'}</td>
                      <td>{format(new Date(doc.published_at), 'dd/MM/yyyy', { locale: fr })}</td>
                      <td>
                        <button className={`toggle-status ${doc.is_active ? 'active' : 'inactive'}`} onClick={() => toggleDocActive(doc)}>
                          <span className="toggle-dot" />
                          {doc.is_active ? 'Visible' : 'Masqué'}
                        </button>
                      </td>
                      <td className="td-actions">
                        <button className="btn btn-ghost" onClick={() => { setEditDoc(doc); setDocForm({ title: doc.title, description: doc.description || '', folder_ids: documentFoldersMap[doc.id] || [], file: null }); setDocFormService(''); setUploadModal(true) }}>Modifier</button>
                        <button className="btn btn-danger" onClick={() => deleteDocument(doc)}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                  {filteredDocs.length === 0 && <tr><td colSpan={8} className="td-empty">Aucun résultat</td></tr>}
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
              <select className="filter-select" value={folderStatusFilter} onChange={e => setFolderStatusFilter(e.target.value)}>
                <option value="">Tous les statuts</option>
                <option value="visible">Visible</option>
                <option value="masque">Masqué</option>
              </select>
              <select className="filter-select" value={folderServiceFilter} onChange={e => setFolderServiceFilter(e.target.value)}>
                <option value="">Tous les services</option>
                <option value="__none__">Non affecté</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span className="filter-count">{filteredFolders.length} dossier{filteredFolders.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <SortHeader label="Nom" field="name" sortField={folderSort.field} sortDir={folderSort.dir} onSort={f => toggleSort(folderSort, f, setFolderSort)} />
                    <th>Service</th>
                    <th>Documents</th>
                    <SortHeader label="Créé le" field="created_at" sortField={folderSort.field} sortDir={folderSort.dir} onSort={f => toggleSort(folderSort, f, setFolderSort)} />
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFolders.map(folder => {
                    const docCount = Object.values(documentFoldersMap).filter(fids => fids.includes(folder.id)).length
                    return (
                      <tr key={folder.id} className={!folder.is_active ? 'tr-inactive' : ''}>
                        <td style={{width:32}}>{folder.is_active ? '📁' : '🔒'}</td>
                        <td className="td-title">{folder.name}</td>
                        <td>
                          {(folderServicesMap[folder.id] || []).length === 0
                            ? <span style={{fontSize:11,color:'var(--text-light)',fontStyle:'italic'}}>Non affecté</span>
                            : (folderServicesMap[folder.id] || []).map(sid => {
                                const s = services.find(x => x.id === sid)
                                return s ? <span key={sid} className="tag" style={{background:'var(--green-soft)',color:'var(--green-deep)',borderColor:'var(--green-border)',marginRight:3}}>{s.name}</span> : null
                              })
                          }
                        </td>
                        <td>{docCount} document{docCount !== 1 ? 's' : ''}</td>
                        <td style={{fontSize:12}}>{folder.created_at ? format(new Date(folder.created_at), 'dd/MM/yyyy', { locale: fr }) : '—'}</td>
                        <td>
                          <button className={`toggle-status ${folder.is_active ? 'active' : 'inactive'}`} onClick={() => toggleFolderActive(folder)}>
                            <span className="toggle-dot" />{folder.is_active ? 'Visible' : 'Masqué'}
                          </button>
                        </td>
                        <td className="td-actions">
                          <button className="btn btn-ghost" onClick={() => { setEditFolder(folder); setFolderForm({ name: folder.name, year: folder.year, service_ids: folderServicesMap[folder.id] || [] }); setFolderModal(true) }}>Modifier</button>
                          <button className="btn btn-danger" onClick={() => deleteFolder(folder)}>Supprimer</button>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredFolders.length === 0 && (
                    <tr><td colSpan={6} className="td-empty">
                      {folderSearch || folderStatusFilter || folderServiceFilter ? 'Aucun résultat' : 'Aucun dossier — cliquez sur "+ Nouveau dossier" pour commencer'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {/* ── SERVICES ── */}
        {tab === 'services' && (
          <div>
            <div className="filters-bar">
              <button className="btn btn-primary" onClick={() => { setEditService(null); setServiceForm({ name: '' }); setServiceModal(true) }}>+ Nouveau service</button>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom du service</th>
                    <th>Dossiers associés</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(service => {
                    const folderCount = Object.entries(folderServicesMap).filter(([, sids]) => sids.includes(service.id)).length
                    return (
                      <tr key={service.id} className={!service.is_active ? 'tr-inactive' : ''}>
                        <td className="td-title">{service.name}</td>
                        <td><span className="tag">{folderCount} dossier{folderCount !== 1 ? 's' : ''}</span></td>
                        <td>
                          <button className={`toggle-status ${service.is_active ? 'active' : 'inactive'}`} onClick={() => toggleServiceActive(service)}>
                            <span className="toggle-dot" />{service.is_active ? 'Actif' : 'Inactif'}
                          </button>
                        </td>
                        <td className="td-actions">
                          <button className="btn btn-ghost" onClick={() => { setEditService(service); setServiceForm({ name: service.name }); setServiceModal(true) }}>Modifier</button>
                          <button className="btn btn-danger" onClick={() => deleteService(service)}>Supprimer</button>
                        </td>
                      </tr>
                    )
                  })}
                  {services.length === 0 && <tr><td colSpan={4} className="td-empty">Aucun service — cliquez sur "+ Nouveau service"</td></tr>}
                </tbody>
              </table>
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
                    <th>Services</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td><code className="username-code">{u.username || '—'}</code></td>
                      <td className="td-title">{u.full_name || '—'}</td>
                      <td style={{fontSize:12}}>{u.email && !u.email.includes('@planning-viewer.internal') ? u.email : '—'}</td>
                      <td style={{fontSize:12}}>{u.phone || '—'}</td>
                      <td><span className={`tag ${u.role === 'admin' ? 'blue' : ''}`}>{u.role}</span></td>
                      <td>{format(new Date(u.created_at), 'dd/MM/yyyy', { locale: fr })}</td>
                      <td>
                        {(userServicesMap[u.id] || []).length === 0
                          ? <span style={{fontSize:11,color:'var(--text-light)'}}>—</span>
                          : (userServicesMap[u.id] || []).map(sid => {
                              const s = services.find(x => x.id === sid)
                              return s ? <span key={sid} className="tag" style={{marginRight:3,fontSize:10}}>{s.name}</span> : null
                            })
                        }
                      </td>
                      <td><span className={`status-dot ${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'Actif' : 'Inactif'}</span></td>
                      <td className="td-actions">
                        <button className="btn btn-ghost" onClick={() => {
                          setSelectedUser(u)
                          setEditUserForm({ full_name: u.full_name || '', username: u.username || '', email: u.email || '', phone: u.phone || '', role: u.role, is_active: u.is_active })
                          setEditUserModal(true)
                        }}>Modifier</button>
                        <button className="btn btn-ghost" onClick={() => { setSelectedUser(u); setNewPassword(''); setPasswordModal(true); }}>
                          🔑 MDP
                        </button>
                        <button className="btn btn-ghost" style={{fontSize:11}} onClick={() => { setSelectedUserForService(u); setUserServiceModal(true) }}>🏢 Services</button>
                        <button className="btn btn-test-email" title="Tester l'envoi d'email" onClick={() => testEmailUser(u)}>✉️ Test mail</button>
                        <button className="btn btn-test-push" title="Tester la notification push" onClick={() => testPushUser(u)}>🔔 Test push</button>
                        <button className="btn btn-danger" onClick={() => deleteUser(u)}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && <tr><td colSpan={9} className="td-empty">Aucun résultat</td></tr>}
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
              <SearchBar value={connSearch} onChange={setConnSearch} placeholder="Identifiant, nom ou IP..." />
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
                      <td><strong style={{fontSize:13}}>{log.profiles?.username || '—'}</strong><br/><small style={{color:'var(--text-muted)'}}>{log.profiles?.full_name || ''}</small></td>
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
        <div className="modal-overlay">
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
                  <input className="input" placeholder="Dupont Jean" value={userForm.full_name} onChange={e => setUserForm(p=>({...p,full_name:formatFullName(e.target.value)}))} autoComplete="off" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email de contact <span style={{fontSize:11,color:'var(--text-light)',fontWeight:400}}>(optionnel — pour les notifications)</span></label>
                  <input className="input" type="email" placeholder="jean@exemple.com" value={userForm.email} onChange={e => setUserForm(p=>({...p,email:e.target.value}))} autoComplete="off" />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input className="input" type="tel" placeholder="06 12 34 56 78" value={userForm.phone} onChange={e => setUserForm(p=>({...p,phone:formatPhone(e.target.value)}))} autoComplete="off" />
                </div>
                <div className="form-group">
                  <label className="form-label">Mot de passe * (min. 8 caractères)</label>
                  <div className="input-with-icon">
                    <input className="input" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={userForm.password} onChange={e => setUserForm(p=>({...p,password:e.target.value}))} autoComplete="new-password" />
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
              {/* Section services */}
              {services.length > 0 && (
                <div className="form-group" style={{marginTop:8}}>
                  <label className="form-label">Services accessibles <span style={{fontSize:11,color:'var(--text-light)',fontWeight:400}}>(optionnel)</span></label>
                  <div style={{display:'flex',flexDirection:'column',gap:6,background:'var(--cream)',border:'1.5px solid var(--green-border)',borderRadius:'var(--r)',padding:'10px 14px'}}>
                    {services.map(s => (
                      <label key={s.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                        <input type="checkbox"
                          checked={(userForm.services || []).includes(s.id)}
                          onChange={e => {
                            const curr = userForm.services || []
                            setUserForm(p => ({...p, services: e.target.checked ? [...curr, s.id] : curr.filter(id => id !== s.id)}))
                          }}
                          style={{width:15,height:15,accentColor:'var(--green)'}}
                        />
                        <span style={{fontWeight:600}}>{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
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
        <div className="modal-overlay">
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">Modifier {selectedUser.full_name || selectedUser.email}</h3>
              <button className="btn btn-ghost" onClick={() => setEditUserModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="user-info-readonly">
                <span className="info-label">Identifiant de connexion actuel</span>
                <span className="info-value">{selectedUser.username || '—'}</span>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Identifiant unique</label>
                  <input className="input" placeholder="identifiant" value={editUserForm.username} onChange={e => setEditUserForm(p=>({...p,username:e.target.value.toLowerCase().replace(/\s/g,'')}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom complet</label>
                  <input className="input" placeholder="Dupont Jean" value={editUserForm.full_name} onChange={e => setEditUserForm(p=>({...p,full_name:formatFullName(e.target.value)}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email de contact <span style={{fontSize:11,color:'var(--text-light)',fontWeight:400}}>(optionnel — pour les notifications)</span></label>
                  <input className="input" type="email" placeholder="email@exemple.com" value={editUserForm.email} onChange={e => setEditUserForm(p=>({...p,email:e.target.value}))} />
                  {editUserForm.email !== selectedUser.email && (
                    <span className="form-hint" style={{color:'var(--warning)'}}>⚠️ L'email sera modifié immédiatement</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input className="input" type="tel" placeholder="06 12 34 56 78" value={editUserForm.phone} onChange={e => setEditUserForm(p=>({...p,phone:formatPhone(e.target.value)}))} />
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
        <div className="modal-overlay">
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
                  <input className="input" type={showPassword ? 'text' : 'password'} placeholder="Nouveau mot de passe" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
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
                <label className="form-label">Dossiers <span style={{color:'var(--text-soft)',fontWeight:400}}>(optionnel — plusieurs possibles)</span></label>
                {services.length > 0 && (
                  <select className="input" style={{marginBottom:8}} value={docFormService} onChange={e => setDocFormService(e.target.value)}>
                    <option value="">— Filtrer par service —</option>
                    <option value="__none__">Non affecté</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                <div style={{display:'flex',flexDirection:'column',gap:5,background:'var(--cream)',border:'1.5px solid var(--green-border)',borderRadius:'var(--r)',padding:'10px 14px',maxHeight:180,overflowY:'auto'}}>
                  {folders
                    .filter(f => {
                      if (!docFormService) return true
                      if (docFormService === '__none__') return !(folderServicesMap[f.id]?.length > 0)
                      return (folderServicesMap[f.id] || []).includes(docFormService)
                    })
                    .map(f => {
                      const sNames = (folderServicesMap[f.id] || []).map(sid => services.find(s => s.id === sid)?.name).filter(Boolean).join(', ')
                      return (
                        <label key={f.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                          <input type="checkbox"
                            checked={(docForm.folder_ids || []).includes(f.id)}
                            onChange={e => {
                              const curr = docForm.folder_ids || []
                              setDocForm(p => ({...p, folder_ids: e.target.checked ? [...curr, f.id] : curr.filter(id => id !== f.id)}))
                            }}
                            style={{width:15,height:15,accentColor:'var(--green)'}}
                          />
                          <span style={{fontWeight:600}}>{f.name}</span>
                          {sNames && <span style={{fontSize:10,color:'var(--text-soft)'}}>{sNames}</span>}
                        </label>
                      )
                    })
                  }
                  {folders.length === 0 && <span style={{fontSize:12,color:'var(--text-light)'}}>Aucun dossier disponible</span>}
                </div>
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
                <label className="form-label">Services <span style={{color:'var(--text-soft)',fontWeight:400}}>(optionnel — plusieurs possibles)</span></label>
                {services.length === 0
                  ? <p style={{fontSize:12,color:'var(--text-light)'}}>Aucun service créé.</p>
                  : <div style={{display:'flex',flexDirection:'column',gap:6,background:'var(--cream)',border:'1.5px solid var(--green-border)',borderRadius:'var(--r)',padding:'10px 14px'}}>
                      {services.filter(s => s.is_active).map(s => (
                        <label key={s.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                          <input type="checkbox"
                            checked={(folderForm.service_ids || []).includes(s.id)}
                            onChange={e => {
                              const curr = folderForm.service_ids || []
                              setFolderForm(p => ({...p, service_ids: e.target.checked ? [...curr, s.id] : curr.filter(id => id !== s.id)}))
                            }}
                            style={{width:15,height:15,accentColor:'var(--green)'}}
                          />
                          <span style={{fontWeight:600}}>{s.name}</span>
                        </label>
                      ))}
                    </div>
                }
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setFolderModal(false); setEditFolder(null) }}>Annuler</button>
              <button className="btn btn-primary" onClick={saveFolder}>{editFolder ? 'Modifier' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}


      {/* ── MODAL SERVICE ── */}
      {serviceModal && (
        <div className="modal-overlay" onClick={() => { setServiceModal(false); setEditService(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">{editService ? 'Modifier le service' : 'Nouveau service'}</h3>
              <button className="btn btn-ghost" onClick={() => { setServiceModal(false); setEditService(null) }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nom du service *</label>
                <input className="input" placeholder="ex: Production, Qualité, RH..." value={serviceForm.name} onChange={e => setServiceForm({ name: e.target.value })} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setServiceModal(false); setEditService(null) }}>Annuler</button>
              <button className="btn btn-primary" onClick={editService ? updateService : createService}>{editService ? 'Modifier' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AFFECTATION SERVICES UTILISATEUR ── */}
      {userServiceModal && selectedUserForService && (
        <div className="modal-overlay" onClick={() => { setUserServiceModal(false); setSelectedUserForService(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-display">Services — {selectedUserForService.full_name || selectedUserForService.username}</h3>
              <button className="btn btn-ghost" onClick={() => { setUserServiceModal(false); setSelectedUserForService(null) }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:13,color:'var(--text-soft)',marginBottom:16}}>
                Sélectionnez les services accessibles pour cet utilisateur.
              </p>
              {services.length === 0
                ? <p style={{fontSize:13,color:'var(--text-light)'}}>Aucun service créé. Créez d'abord des services dans l'onglet Services.</p>
                : services.map(s => {
                    const checked = (userServicesMap[selectedUserForService.id] || []).includes(s.id)
                    return (
                      <label key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                        <input type="checkbox" defaultChecked={checked}
                          onChange={e => {
                            const current = [...(userServicesMap[selectedUserForService.id] || [])]
                            const updated = e.target.checked ? [...current, s.id] : current.filter(id => id !== s.id)
                            setUserServicesMap(prev => ({ ...prev, [selectedUserForService.id]: updated }))
                          }}
                          style={{width:16,height:16,accentColor:'var(--green)'}}
                        />
                        <span style={{fontSize:14,fontWeight:600,color:s.is_active ? 'var(--text)' : 'var(--text-light)'}}>{s.name}</span>
                        {!s.is_active && <span style={{fontSize:10,color:'var(--text-light)'}}>(inactif)</span>}
                      </label>
                    )
                  })
              }
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setUserServiceModal(false); setSelectedUserForService(null) }}>Annuler</button>
              <button className="btn btn-primary" onClick={() => saveUserServices(selectedUserForService.id, userServicesMap[selectedUserForService.id] || [])}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-page { min-height:100vh; background:var(--cream); display:flex; flex-direction:column; }
        .admin-back { color:rgba(255,255,255,0.75) !important; } .admin-back:hover { background:rgba(255,255,255,0.1) !important; color:white !important; }
        .admin-header { display:flex; align-items:center; justify-content:space-between; padding:16px 28px; background:var(--green-deep); background-image:linear-gradient(160deg, var(--green) 0%, var(--green-deep) 100%); border-bottom:none; gap:16px; flex-wrap:wrap; }
        .admin-header-left { display:flex; align-items:center; gap:16px; }
        .admin-title { font-family:var(--font-display); font-size:20px; font-weight:700; color:white; }
        .admin-header-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .admin-tabs { display:flex; gap:0; padding:0 20px; background:var(--white); border-bottom:2px solid var(--border); overflow-x:auto; box-shadow:var(--shadow-sm); }
        .admin-tab { display:flex; align-items:center; gap:7px; padding:14px 16px; border:none; background:transparent; color:var(--text); font-size:13px; font-weight:700; cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-2px; transition:all 0.15s; white-space:nowrap; font-family:var(--font-body); opacity:0.55; }
        .admin-tab:hover { color:var(--text); background:var(--green-pale); opacity:1; }
        .admin-tab.active { color:var(--red); border-bottom-color:var(--red); opacity:1; }
        .admin-content { padding:24px 28px; flex:1; background:var(--cream); }
        .filters-bar { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
        .filter-search { display:flex; align-items:center; gap:8px; background:var(--cream); border:1px solid var(--border-strong); border-radius:var(--r); padding:8px 14px; min-width:220px; flex:1; max-width:320px; }
        .filter-search svg { color:var(--text-soft); flex-shrink:0; }
        .filter-input { background:transparent; border:none; outline:none; color:var(--text); font-size:13px; font-family:var(--font-body); flex:1; min-width:0; }
        .filter-input::placeholder { color:var(--text-muted); }
        .filter-clear { background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:12px; }
        .filter-select { background:var(--cream); border:1.5px solid var(--border-warm); border-radius:var(--radius); padding:8px 12px; color:var(--text-mid); font-size:13px; font-family:var(--font-body); cursor:pointer; outline:none; }
        .filter-sort-btn { background:var(--parchment); border:1px solid var(--border-strong); border-radius:var(--radius); padding:8px 14px; color:var(--text-secondary); font-size:13px; cursor:pointer; font-family:var(--font-body); transition:all var(--transition); }
        .filter-sort-btn.active { background:var(--accent-dim); border-color:var(--accent-border); color:var(--red); }
        .filter-count { font-size:12px; color:var(--text-soft); margin-left:auto; white-space:nowrap; }
        .data-table-wrapper { overflow-x:auto; border-radius:var(--r-lg); border:1.5px solid var(--border); }
        .data-table { width:100%; border-collapse:collapse; }
        .data-table th { background:var(--warm-light); padding:12px 16px; text-align:left; font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-muted); border-bottom:1px solid var(--border); white-space:nowrap; }
        .data-table th.sortable { cursor:pointer; user-select:none; }
        .data-table th.sortable:hover { color:var(--text-secondary); }
        .data-table th.sort-active { color:var(--accent); }
        .sort-icon { font-size:10px; opacity:0.6; }
        .data-table td { padding:12px 16px; font-size:13px; color:var(--text-mid); border-bottom:1px solid var(--border); vertical-align:middle; }
        .data-table tr:last-child td { border-bottom:none; }
        .data-table tr:hover td { background:var(--green-pale); }
        .td-title { font-weight:600; color:var(--text) !important; max-width:220px; }
        .td-actions { display:flex; gap:4px; align-items:center; white-space:nowrap; }
        .td-empty { text-align:center; padding:32px !important; color:var(--text-light); font-style:italic; }
        .tag { display:inline-block; padding:3px 8px; background:var(--parchment); border-radius:99px; font-size:11px; color:var(--text-secondary); }
        .tag.blue { background:var(--green-soft); color:var(--green-deep); }
        .status-dot { display:inline-flex; align-items:center; gap:5px; font-size:12px; }
        .status-dot::before { content:''; width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .status-dot.active { color:var(--green-deep); font-weight:700; }
        .status-dot.active::before { background:var(--green); box-shadow:0 0 0 2px rgba(61,122,53,0.2); }
        .status-dot.inactive { color:#8a8a8a; font-weight:600; }
        .status-dot.inactive::before { background:#b0b0b0; }
        .username-code { font-family:monospace; font-size:12px; background:var(--straw-pale); padding:2px 7px; border-radius:4px; color:var(--text-mid); }
        .folders-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(380px,1fr)); gap:16px; }
        .folder-card { background:var(--white); border:1px solid var(--border); border-radius:var(--r-lg); padding:16px 20px; display:flex; align-items:center; gap:14px; transition:all var(--transition); overflow:hidden; }
        .folder-card-inactive { opacity:0.55; background:var(--bg-secondary); }
        .folder-card-icon { font-size:28px; flex-shrink:0; line-height:1; }
        .folder-card-body { flex:1; min-width:0; overflow:hidden; }
        .folder-card-name { font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .folder-card-meta { font-size:12px; color:var(--text-muted); white-space:nowrap; }
        .folder-card-actions { display:flex; gap:6px; flex-shrink:0; align-items:center; }
        .data-table tr.tr-inactive td { opacity:0.45; }
        .toggle-status { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:99px; border:1px solid; font-size:12px; font-weight:500; cursor:pointer; transition:all var(--transition); font-family:var(--font-body); white-space:nowrap; }
        .toggle-status.active { background:var(--green-soft); border-color:var(--green); color:var(--green-deep); font-weight:700; }
        .toggle-status.active:hover { background:#c8e6c4; border-color:var(--green-deep); }
        .toggle-status.inactive { background:#f0f0f0; border-color:#c0c0c0; color:#707070; font-weight:600; }
        .toggle-status.inactive:hover { background:#e0e0e0; border-color:#a0a0a0; }
        .toggle-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0; }
        .stats-summary { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:16px; margin-bottom:24px; }
        .stat-card { background:var(--white); border:1.5px solid var(--border); border-radius:var(--radius-lg); padding:20px; }
        .stat-value { font-size:32px; font-weight:800; font-family:var(--font-display); color:var(--red); line-height:1; margin-bottom:6px; }
        .stat-label { font-size:13px; color:var(--text-soft); }
        .rank { font-weight:700; color:var(--text-muted); }
        .rank.top { color:var(--red); }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:24px; animation:fadeIn 0.15s ease; }
        .modal { background:var(--white); border:1px solid var(--border-strong); border-radius:var(--r-xl); width:100%; max-width:500px; box-shadow:var(--shadow-lg); overflow:hidden; max-height:90vh; display:flex; flex-direction:column; }
        .modal-lg { max-width:680px; }
        .modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid var(--border); font-size:16px; font-weight:700; color:var(--text-primary); flex-shrink:0; }
        .modal-body { padding:24px; display:flex; flex-direction:column; gap:16px; overflow-y:auto; }
        .modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:16px 24px; border-top:1px solid var(--border); flex-shrink:0; }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media (max-width:600px) { .form-grid { grid-template-columns:1fr; } }
        .form-group { display:flex; flex-direction:column; gap:8px; }
        .form-label { font-size:13px; font-weight:600; color:var(--text-mid); }
        .form-hint { font-size:11px; color:var(--text-light); }
        .input-with-icon { position:relative; }
        .input-with-icon .input { padding-right:44px; }
        .input-icon-btn { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:transparent; border:none; cursor:pointer; font-size:16px; }
        .user-info-readonly { display:flex; flex-direction:column; gap:4px; padding:12px 14px; background:var(--green-pale); border-radius:var(--radius); margin-bottom:4px; }
        .info-label { font-size:11px; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.06em; }
        .info-value { font-size:14px; color:var(--text); font-weight:500; }
        .modal-info { padding:12px 14px; background:var(--green-soft); border:1px solid var(--green-border); border-radius:var(--radius); font-size:13px; color:var(--green-deep); line-height:1.6; }
        .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 24px; gap:12px; color:var(--text-muted); text-align:center; }
        .empty-state h3 { font-size:18px; color:var(--text-mid); font-family:var(--font-display); }
        textarea.input { resize:vertical; min-height:80px; }
        select.input { cursor:pointer; }
        code { font-family:monospace; font-size:12px; }
        .app-footer { position:fixed; bottom:12px; right:16px; z-index:50; pointer-events:none; }
        .footer-logo-img { height:32px; width:auto; opacity:0.35; transition:opacity 0.2s; pointer-events:all; }
        .footer-logo-img:hover { opacity:0.7; }
      `}</style>
      <footer className="app-footer">
        <img src="/logo-aa.png" alt="Logo" className="footer-logo-img" />
      </footer>
    </div>
  )
}
