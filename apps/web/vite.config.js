import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    // API calls go to the Pages Functions that `npm run dev:pages` runs with wrangler on :8788.
    // With `npm run dev` alone they fail with a proxy error instead of returning index.html.
    proxy: {
      '/api': 'http://127.0.0.1:8788',
    },
  }
})
