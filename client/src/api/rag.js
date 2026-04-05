/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { apiClient } from './core'

export default {
  getRagStatus() {
    return apiClient.get('/rag/status')
  },

  getRagDetailed(params = {}) {
    return apiClient.get('/rag/detailed', { params })
  },

  getRagTextModels(data = {}) {
    return apiClient.post('/rag/text-models', data)
  },

  getBackfillStatus() {
    return apiClient.get('/rag/backfill/status')
  },

  getBackfillConfig() {
    return apiClient.get('/rag/backfill/config')
  },

  updateBackfillConfig(data) {
    return apiClient.put('/rag/backfill/config', data)
  },

  startManualBackfill(data = {}) {
    return apiClient.post('/rag/backfill/manual/start', data)
  },

  pauseManualBackfill() {
    return apiClient.post('/rag/backfill/manual/pause')
  },

  resumeManualBackfill() {
    return apiClient.post('/rag/backfill/manual/resume')
  },

  clearManualBackfill() {
    return apiClient.post('/rag/backfill/manual/clear')
  },

  testRagConnection(data) {
    return apiClient.post('/rag/test-connection', data)
  },

  resetRagCircuitBreaker() {
    return apiClient.post('/rag/circuit-breaker/reset')
  },

  warmupRagModel() {
    return apiClient.post('/rag/warmup')
  },

  exportRagConfig() {
    return apiClient.post('/rag/export/config')
  },

  exportRagLogs() {
    return apiClient.post('/rag/export/logs')
  },

  exportRagMetrics() {
    return apiClient.post('/rag/export/metrics')
  },

  getLatestRagFallbackIncident() {
    return apiClient.get('/rag/loop/latest-fallback-incident')
  },

  getRagPromotionReadiness() {
    return apiClient.get('/rag/loop/promotion-readiness')
  },

  getRagAdvancedConfig() {
    return apiClient.get('/rag/advanced')
  },

  updateRagAdvancedConfig(data) {
    return apiClient.put('/rag/advanced', data)
  },

  clearRagEmbeddings() {
    return apiClient.post('/rag/clear-embeddings')
  },

  resetRagConfig() {
    return apiClient.post('/rag/reset-config')
  },

  testImageEmbeddingConnection(data) {
    return apiClient.post('/rag/image-test-connection', data)
  },

  getImageModelMetadata(data = {}) {
    return apiClient.post('/rag/image-models-metadata', data)
  },

  getRagGraphFillRate() {
    return apiClient.get('/rag/graph/fill-rate')
  },

  reembedImages() {
    return apiClient.post('/rag/reembed-images')
  },
}
