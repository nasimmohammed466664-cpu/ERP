import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'نقطة البيع', short_name: 'نقطة البيع', lang: 'ar', dir: 'rtl', start_url: '/', scope: '/', display: 'standalone',
        orientation: 'portrait', background_color: '#f3f6f2', theme_color: '#176343',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // the app shell is precached; API calls are never cached or answered by the worker (data comes from IndexedDB / the server)
        navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: ['.e2b.app'], proxy: { '/api': 'http://127.0.0.1:3000' } },
});
