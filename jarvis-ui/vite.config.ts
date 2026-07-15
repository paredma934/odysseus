import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/static/mission-control/',
  plugins: [react()],
  build: {
    outDir: '../static/mission-control',
    emptyOutDir: true,
  },
})
