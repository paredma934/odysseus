import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const odysseusProxy = {
  '/odysseus-api': {
    target: process.env.ODYSSEUS_TARGET || 'http://127.0.0.1:7860',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/odysseus-api/, ''),
  },
  '/ollama-api': {
    target: process.env.OLLAMA_TARGET || 'http://127.0.0.1:11434',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/ollama-api/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/static/mission-control/' : '/',
  plugins: [react()],
  build: {
    outDir: '../static/mission-control',
    emptyOutDir: true,
  },
  server: {
    proxy: odysseusProxy,
  },
  preview: {
    proxy: odysseusProxy,
  },
}))
