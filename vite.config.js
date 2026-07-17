import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom domain (draft.fastlineracingacademy.pl) -> base '/'
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
})
