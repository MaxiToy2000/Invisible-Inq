import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
  },
  optimizeDeps: {
    include: ['three', '3d-force-graph', 'three-spritetext'],
  },
})
