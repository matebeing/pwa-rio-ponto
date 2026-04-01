import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api/sppo': {
        target: 'https://dados.mobilidade.rio',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sppo/, '/gps/sppo'),
      },
    },
  },
})
