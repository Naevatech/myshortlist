/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Shortlist',
        short_name: 'Shortlist',
        description: 'UK jobs that match your CV. Nothing is sent until you approve it.',
        start_url: '/today',
        display: 'standalone',
        background_color: '#FFFFFF',
        theme_color: '#1F3A5F',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell and static assets only. API calls go to another origin and are never cached.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
    // Typing with simulated key presses is slow in jsdom on Windows when the whole suite runs at once.
    testTimeout: 20_000,
    // Each jsdom worker uses a lot of memory; two keep the suite reliable on smaller machines.
    maxWorkers: 2,
    minWorkers: 1,
  },
});
