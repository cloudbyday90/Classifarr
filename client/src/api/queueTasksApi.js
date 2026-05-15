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

export function getQueuePending(limit = 20) {
  return getDataRequest('/queue/pending', { params: { limit } })
}

export function getQueueFailed(limit = 20) {
  return getDataRequest('/queue/failed', { params: { limit } })
}

export function retryQueueTask(taskId) {
  return apiClient.post(`/queue/task/${taskId}/retry`)
}

export function dismissQueueTask(taskId) {
  return apiClient.post(`/queue/task/${taskId}/dismiss`)
}

export function cancelQueueTask(taskId) {
  return apiClient.post(`/queue/task/${taskId}/cancel`)
}

export function classifyQueueTask(taskId, data) {
  return apiClient.post(`/queue/tasks/${taskId}/classify`, data)
}

const queueTasksApi = {
  getQueuePending,
  getQueueFailed,
  retryQueueTask,
  dismissQueueTask,
  cancelQueueTask,
  classifyQueueTask,
}

export default queueTasksApi
