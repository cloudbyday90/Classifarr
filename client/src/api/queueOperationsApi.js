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

export function clearCompletedTasks() {
  return apiClient.post('/queue/clear-completed')
}

export function clearFailedTasks() {
  return apiClient.post('/queue/clear-failed')
}

export function retryAllFailedTasks() {
  return apiClient.post('/queue/retry-all-failed')
}

export function cancelAllPendingTasks() {
  return apiClient.post('/queue/cancel-all-pending')
}

export function reprocessCompleted() {
  return apiClient.post('/queue/reprocess-completed')
}

export function clearAndResync() {
  return apiClient.post('/queue/clear-and-resync')
}

export function getLiveStats() {
  return getDataRequest('/queue/live-stats')
}

export function getAiGenerationStatus() {
  return getDataRequest('/queue/ollama-status')
}

export function processEnrichmentRetries(options = {}) {
  return apiClient.post('/queue/retry-process', options)
}

export function getGapAnalysisStats() {
  return getDataRequest('/queue/gap-analysis-stats')
}

const queueOperationsApi = {
  clearCompletedTasks,
  clearFailedTasks,
  retryAllFailedTasks,
  cancelAllPendingTasks,
  reprocessCompleted,
  clearAndResync,
  getLiveStats,
  getAiGenerationStatus,
  processEnrichmentRetries,
  getGapAnalysisStats,
}

export default queueOperationsApi
