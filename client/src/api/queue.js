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

import { apiClient, cancelQueueTaskRequest, getDataRequest, retryQueueTaskRequest } from './core'

export default {
  getQueueStats() {
    return apiClient.get('/queue/stats')
  },

  getQueueSettings() {
    return apiClient.get('/settings/category/queue')
  },

  updateQueueSettings(settings) {
    return apiClient.put('/settings/category/queue', settings)
  },

  getQueuePending(limit = 20) {
    return getDataRequest('/queue/pending', { params: { limit } })
  },

  getQueueFailed(limit = 20) {
    return getDataRequest('/queue/failed', { params: { limit } })
  },

  retryQueueTask(taskId) {
    return retryQueueTaskRequest(taskId)
  },

  dismissQueueTask(taskId) {
    return apiClient.post(`/queue/task/${taskId}/dismiss`)
  },

  cancelQueueTask(taskId) {
    return cancelQueueTaskRequest(taskId)
  },

  clearCompletedTasks() {
    return apiClient.post('/queue/clear-completed')
  },

  clearFailedTasks() {
    return apiClient.post('/queue/clear-failed')
  },

  retryAllFailedTasks() {
    return apiClient.post('/queue/retry-all-failed')
  },

  cancelAllPendingTasks() {
    return apiClient.post('/queue/cancel-all-pending')
  },

  reprocessCompleted() {
    return apiClient.post('/queue/reprocess-completed')
  },

  clearAndResync() {
    return apiClient.post('/queue/clear-and-resync')
  },

  getLiveStats() {
    return getDataRequest('/queue/live-stats')
  },

  getAiGenerationStatus() {
    return getDataRequest('/queue/ollama-status')
  },

  processEnrichmentRetries(options = {}) {
    return apiClient.post('/queue/retry-process', options)
  },
}
