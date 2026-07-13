import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const clientRoot = import.meta.dirname

const settingsChunkRoots = [
  '/src/views/Settings.vue',
  '/src/views/settings/',
]

const ragSettingsChunkRoots = [
  '/src/views/RAGSettings.vue',
  '/src/views/rag/',
]

const policyChunkRoots = [
  '/src/views/PolicyList.vue',
  '/src/views/PresetsManager.vue',
  '/src/views/PolicyStatsDashboard.vue',
  '/src/views/TuningSuggestionsDashboard.vue',
  '/src/views/Evidence.vue',
]

const VUEUSE_INVALID_ANNOTATION_LOCATIONS = new Set([
  3362,
  5780,
])

function isChunkMatch(id, roots) {
  return roots.some((root) => id.includes(root))
}

function isKnownVueUseInvalidAnnotation(log) {
  const normalizedId = log?.id?.replaceAll('\\', '/')

  return log?.code === 'INVALID_ANNOTATION'
    && normalizedId?.endsWith('/node_modules/@vueuse/core/dist/index.js')
    && VUEUSE_INVALID_ANNOTATION_LOCATIONS.has(log?.loc?.line)
}

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
      onLog(level, log, defaultHandler) {
        // VueUse 14.3.0 ships two invalid PURE annotations. Keep the allowance
        // exact until its published package includes the upstream fix.
        if (isKnownVueUseInvalidAnnotation(log)) {
          return
        }
        defaultHandler(level, log)
      },
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

          if (isChunkMatch(id, ragSettingsChunkRoots)) {
            return 'rag-settings'
          }

          if (isChunkMatch(id, settingsChunkRoots)) {
            return 'settings-route'
          }

          if (isChunkMatch(id, policyChunkRoots)) {
            return 'policy-tools'
          }
        },
      },
    },
  },
})
