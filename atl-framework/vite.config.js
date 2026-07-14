import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'delirious-capped-cinnamon.ngrok-free.dev' // Izinkan domain ngrok frontend Anda di sini [1]
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  }
})
