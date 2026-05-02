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

export function createReclassificationBatch(items, pauseOnError = true) {
  return apiClient.post('/reclassification/batch', { items, pauseOnError })
}

export function validateReclassificationBatch(batchId) {
  return apiClient.post(`/reclassification/batch/${batchId}/validate`)
}

export function executeReclassificationBatch(batchId) {
  return apiClient.post(`/reclassification/batch/${batchId}/execute`)
}

export function pauseReclassificationBatch(batchId) {
  return apiClient.post(`/reclassification/batch/${batchId}/pause`)
}

export function resumeReclassificationBatch(batchId) {
  return apiClient.post(`/reclassification/batch/${batchId}/resume`)
}

export function cancelReclassificationBatch(batchId) {
  return apiClient.post(`/reclassification/batch/${batchId}/cancel`)
}

export function getReclassificationBatchStatus(batchId) {
  return apiClient.get(`/reclassification/batch/${batchId}`)
}

export function skipReclassificationItem(batchId, itemId) {
  return apiClient.post(`/reclassification/batch/${batchId}/item/${itemId}/skip`)
}

export function retryReclassificationItem(batchId, itemId) {
  return apiClient.post(`/reclassification/batch/${batchId}/item/${itemId}/retry`)
}

const reclassificationBatchesApi = {
  createReclassificationBatch,
  validateReclassificationBatch,
  executeReclassificationBatch,
  pauseReclassificationBatch,
  resumeReclassificationBatch,
  cancelReclassificationBatch,
  getReclassificationBatchStatus,
  skipReclassificationItem,
  retryReclassificationItem,
}

export default reclassificationBatchesApi
