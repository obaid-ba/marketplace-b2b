import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    // Les pages complètes (formulaires, routeur) dépassent parfois 5 s quand toute la suite tourne en parallèle.
    testTimeout: 15000,
    setupFiles: ['./src/test/setup.js'],
  },
})
