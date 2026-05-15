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

import { apiClient, getDataRequest } from './core'

export function resetRagCircuitBreaker() {
  return apiClient.post('/rag/circuit-breaker/reset')
}

export function warmupRagModel() {
  return apiClient.post('/rag/warmup')
}

export function exportRagConfig() {
  return apiClient.post('/rag/export/config')
}

export function exportRagLogs() {
  return apiClient.post('/rag/export/logs')
}

export function exportRagMetrics() {
  return apiClient.post('/rag/export/metrics')
}

export function getRagAdvancedConfig() {
  return getDataRequest('/rag/advanced')
}

export function updateRagAdvancedConfig(data) {
  return apiClient.put('/rag/advanced', data)
}

export function clearRagEmbeddings() {
  return apiClient.post('/rag/clear-embeddings')
}

export function resetRagConfig() {
  return apiClient.post('/rag/reset-config')
}

export function updateRetryConfig(data) {
  return apiClient.put('/settings/embedding/retry', data)
}

export function getRetryConfig() {
  return getDataRequest('/settings/embedding/retry')
}

const ragAdvancedApi = {
  resetRagCircuitBreaker,
  warmupRagModel,
  exportRagConfig,
  exportRagLogs,
  exportRagMetrics,
  getRagAdvancedConfig,
  updateRagAdvancedConfig,
  clearRagEmbeddings,
  resetRagConfig,
  updateRetryConfig,
  getRetryConfig,
}

export default ragAdvancedApi
