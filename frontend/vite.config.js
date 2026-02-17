import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/listas/',
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/api/listas': {
        target: 'http://localhost:8011',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
