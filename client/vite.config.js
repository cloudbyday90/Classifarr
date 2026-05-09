import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const clientRoot = import.meta.dirname

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(clientRoot, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:21324',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'baseline-widely-available',
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/')) {
            if (['vue', 'vue-router', 'pinia', '@vueuse/core'].some(pkg => id.includes(`/node_modules/${pkg}/`))) {
              return 'vue-vendor'
            }
            if (id.includes('/node_modules/socket.io-client/') || id.includes('/node_modules/engine.io-client/')) {
              return 'socket'
            }
          }
        },
      },
    },
  },
})
