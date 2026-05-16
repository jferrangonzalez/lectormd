import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, el backend PHP debe correr en local.
// Opciones:
//   - php -S localhost:8080 -t api/   (desde la raíz del proyecto)
//   - XAMPP / Laragon apuntando a api/
//   - VITE_API_URL=http://localhost:8080 en .env.local para cambiar el target
const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
