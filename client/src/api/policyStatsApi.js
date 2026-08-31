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

import { getDataRequest } from './core'

export function getPolicyStatsOverview() {
  return getDataRequest('/stats/overview')
}

export function getPolicyStatsList() {
  return getDataRequest('/stats/policies')
}

export function getPolicyStatsLiveFeed(limit = 20) {
  return getDataRequest('/stats/live-feed', { params: { limit } })
}

export function getPolicyStatsAlerts() {
  return getDataRequest('/stats/alerts')
}

export function getPolicyStatsDetail(policyId) {
  return getDataRequest(`/stats/policies/${policyId}`)
}

export function getPolicyStatsComparison(policyId) {
  return getDataRequest(`/stats/policies/${policyId}/compare`)
}

export function getDetailedStats() {
  return getDataRequest('/stats/detailed')
}

export function getCandidateBoundVerificationMetrics(days = 7) {
  return getDataRequest('/stats/candidate-bound-verification', { params: { days } })
}

export function getCurrentLibraryCandidateRetrievalMetrics(days = 7) {
  return getDataRequest('/stats/current-library-candidate-retrieval', { params: { days } })
}

export function getPolicyCandidateContrastiveOutcomeMetrics(days = 7) {
  return getDataRequest('/stats/policy-candidate-contrastive-outcomes', { params: { days } })
}

export function getPolicyCandidateCorrectionAnalyticsMetrics(days = 7) {
  return getDataRequest('/stats/policy-candidate-correction-analytics', { params: { days } })
}

export function getOllamaVerificationRuntimeMismatchSummary() {
  return getDataRequest('/stats/ollama-verification-runtime-mismatch-summary')
}

export function getOllamaVerificationCapabilityOutcomeHistory() {
  return getDataRequest('/stats/ollama-verification-capability-outcomes')
}

export function getRouteSafetyReadiness() {
  return getDataRequest('/stats/route-safety-readiness')
}

export function getRouteSafetyMaintenanceHandoff() {
  return getDataRequest('/stats/route-safety-maintenance-handoff')
}

const policyStatsApi = {
  getPolicyStatsOverview,
  getPolicyStatsList,
  getPolicyStatsLiveFeed,
  getPolicyStatsAlerts,
  getPolicyStatsDetail,
  getPolicyStatsComparison,
  getDetailedStats,
  getCandidateBoundVerificationMetrics,
  getCurrentLibraryCandidateRetrievalMetrics,
  getPolicyCandidateContrastiveOutcomeMetrics,
  getPolicyCandidateCorrectionAnalyticsMetrics,
  getOllamaVerificationRuntimeMismatchSummary,
  getOllamaVerificationCapabilityOutcomeHistory,
  getRouteSafetyReadiness,
  getRouteSafetyMaintenanceHandoff,
}

export default policyStatsApi
