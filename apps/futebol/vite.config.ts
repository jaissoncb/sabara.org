import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/futebol/',
  plugins: [
    react(),
    VitePWA({
      base: '/futebol/',
      scope: '/futebol/',
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/app-icon.svg', 'icons/app-icon-512.png'],
      manifest: {
        id: '/futebol/',
        name: 'Futebol - Times equilibrados',
        short_name: 'Futebol',
        description: 'Organize partidas entre amigos e sorteie times equilibrados.',
        lang: 'pt-BR',
        start_url: '/futebol/#/',
        scope: '/futebol/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#f4f8f6',
        theme_color: '#075b45',
        icons: [
          {
            src: 'icons/app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'icons/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{css,html,ico,js,png,svg,webmanifest}'],
        navigateFallback: '/futebol/index.html',
        navigateFallbackAllowlist: [/^\/futebol\//],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    css: true,
  },
})
