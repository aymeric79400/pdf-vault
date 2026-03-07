import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Enregistrer le Service Worker PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Une mise à jour est disponible. Recharger ?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('Application prête en mode hors-ligne')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
