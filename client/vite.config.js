import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { createClientCodeSplitting } from './build/clientCodeSplitting.mjs'

const clientRoot = import.meta.dirname

const VUEUSE_INVALID_ANNOTATION_LOCATIONS = new Set([
  3362,
  5780,
])

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
        codeSplitting: createClientCodeSplitting(),
      },
    },
  },
})
