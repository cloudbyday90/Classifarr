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

export default {
  classify(data) {
    return apiClient.post('/classification/classify', data)
  },

  getHistory(params) {
    return apiClient.get('/classification/history', { params })
  },

  submitCorrection(data) {
    return apiClient.post('/classification/corrections', data)
  },

  getStats() {
    return apiClient.get('/classification/stats')
  },

  getClassificationProfile(classificationId) {
    return apiClient.get(`/classification/history/${classificationId}/profile`)
  },

  getClassificationProgress() {
    return getDataRequest('/classification/progress')
  },

  getSecondPassEvaluation(days = 30) {
    return apiClient.get('/classification/second-pass-evaluation', {
      params: { days },
    })
  },

  getLiveFeed(limit = 50) {
    return getDataRequest('/classification/live-feed', { params: { limit } })
  },

  getPendingClassifications() {
    return getDataRequest('/classification/pending')
  },

  resolvePendingClassification(classificationId, payload) {
    return apiClient.post(`/classification/pending/${classificationId}/resolve`, payload)
  },

  retryClassifications(classificationIds, options = {}) {
    return apiClient.post('/classification/retry', { classificationIds, options })
  },

  createReclassificationBatch(items, pauseOnError = true) {
    return apiClient.post('/reclassification/batch', { items, pauseOnError })
  },

  validateReclassificationBatch(batchId) {
    return apiClient.post(`/reclassification/batch/${batchId}/validate`)
  },

  executeReclassificationBatch(batchId) {
    return apiClient.post(`/reclassification/batch/${batchId}/execute`)
  },

  pauseReclassificationBatch(batchId) {
    return apiClient.post(`/reclassification/batch/${batchId}/pause`)
  },

  resumeReclassificationBatch(batchId) {
    return apiClient.post(`/reclassification/batch/${batchId}/resume`)
  },

  cancelReclassificationBatch(batchId) {
    return apiClient.post(`/reclassification/batch/${batchId}/cancel`)
  },

  getReclassificationBatchStatus(batchId) {
    return apiClient.get(`/reclassification/batch/${batchId}`)
  },

  skipReclassificationItem(batchId, itemId) {
    return apiClient.post(`/reclassification/batch/${batchId}/item/${itemId}/skip`)
  },

  retryReclassificationItem(batchId, itemId) {
    return apiClient.post(`/reclassification/batch/${batchId}/item/${itemId}/retry`)
  },
}
