import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      manifest: {
        name: 'Planning Viewer',
        short_name: 'Planning',
        theme_color: '#2c5c26',
        background_color: '#faf6ef',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      injectManifest: {
        swSrc: 'public/sw.js',
        swDest: 'dist/sw.js'
      }
    })
  ],
  server: { port: 3000 }
})
