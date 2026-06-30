import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        // Separar las dependencias 3D pesadas en chunks propios para mejorar
        // el cacheo y evitar un único bundle enorme.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/three/') || id.includes('three-stdlib') || id.includes('/3d-')) return 'vendor-three'
            if (id.includes('@react-three')) return 'vendor-r3f'
            if (id.includes('/react') || id.includes('/scheduler/')) return 'vendor-react'
          }
        },
      },
    },
  },
})
