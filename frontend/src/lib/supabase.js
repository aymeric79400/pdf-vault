import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('⚠️ Variables Supabase manquantes. Vérifiez votre fichier .env')
}

// Storage custom qui essaie localStorage puis sessionStorage
const customStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key)
    } catch {
      try { return sessionStorage.getItem(key) } catch { return null }
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      try { sessionStorage.setItem(key, value) } catch {}
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key)
    } catch {}
    try { sessionStorage.removeItem(key) } catch {}
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: customStorage,
    storageKey: 'planning-viewer-auth',
    flowType: 'pkce'
  }
})

export const getDeviceInfo = () => {
  const ua = navigator.userAgent
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua)
  let deviceType = 'desktop'
  if (isTablet) deviceType = 'tablet'
  else if (isMobile) deviceType = 'mobile'
  return { deviceType, deviceInfo: ua.substring(0, 200) }
}
