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

export function classify(data) {
  return apiClient.post('/classification/classify', data)
}

export function getHistory(params) {
  return getDataRequest('/classification/history', { params })
}

export function submitCorrection(data) {
  return apiClient.post('/classification/corrections', data)
}

export function getStats() {
  return getDataRequest('/classification/stats')
}

export function getClassificationProfile(classificationId) {
  return getDataRequest(`/classification/history/${classificationId}/profile`)
}

export function getClassificationProgress() {
  return getDataRequest('/classification/progress')
}

export function getSecondPassEvaluation(days = 30) {
  return getDataRequest('/classification/second-pass-evaluation', {
    params: { days },
  })
}

export function getLiveFeed(limit = 50) {
  return getDataRequest('/classification/live-feed', { params: { limit } })
}

export function getPendingClassifications() {
  return getDataRequest('/classification/pending')
}

export function getPendingClassificationCount() {
  return getDataRequest('/classification/pending/count')
}

export function getPendingQuestionCleanupInventory() {
  return getDataRequest('/classification/pending-cleanup/inventory')
}

export function getHistoricRouteSafetyRefreshInventory(params = {}) {
  return getDataRequest('/classification/pending/route-safety-refresh-inventory', { params })
}

export function executeHistoricRouteSafetyRefresh(classificationIds) {
  return apiClient.post('/classification/pending/route-safety-refresh/retry', { classificationIds })
}

export function getHistoricRouteSafetyRefreshReceipt(retryReceipt) {
  return getDataRequest(
    `/classification/pending/route-safety-refresh/receipts/${encodeURIComponent(retryReceipt)}`,
  )
}

export function getHistoricRouteSafetyRefreshRecentReceipt() {
  return getDataRequest('/classification/pending/route-safety-refresh/receipts/recent')
}

export function resolvePendingClassification(classificationId, payload) {
  return apiClient.post(`/classification/pending/${classificationId}/resolve`, payload)
}

export function rememberResolvedExactItem(classificationId) {
  return apiClient.post(`/classification/history/${classificationId}/exact-item-memory`)
}

export function retryClassifications(classificationIds, options = {}) {
  return apiClient.post('/classification/retry', { classificationIds, options })
}

const classificationOperationsApi = {
  classify,
  getHistory,
  submitCorrection,
  getStats,
  getClassificationProfile,
  getClassificationProgress,
  getSecondPassEvaluation,
  getLiveFeed,
  getPendingClassifications,
  getPendingClassificationCount,
  getPendingQuestionCleanupInventory,
  getHistoricRouteSafetyRefreshInventory,
  executeHistoricRouteSafetyRefresh,
  getHistoricRouteSafetyRefreshReceipt,
  getHistoricRouteSafetyRefreshRecentReceipt,
  resolvePendingClassification,
  rememberResolvedExactItem,
  retryClassifications,
}

export default classificationOperationsApi
