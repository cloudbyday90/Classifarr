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

export function getLibraries() {
  return getDataRequest('/libraries')
}

export function getLibraryOverlap() {
  return getDataRequest('/libraries/overlap')
}

export function getLibraryObservationHealth() {
  return getDataRequest('/libraries/observation-health')
}

export function getLibraryProfileRefreshStatus() {
  return getDataRequest('/libraries/profile-refresh-status')
}

export function getLibraryUpgradeReadiness() {
  return getDataRequest('/libraries/upgrade-readiness')
}

export function getLibraryEvidenceCoverage(id) {
  return getDataRequest(`/libraries/${encodeURIComponent(id)}/evidence-coverage`)
}

export function getLibrarySourceObservations() {
  return getDataRequest('/libraries/source-observations')
}

export function getLibrarySourceIdentityIssues(offset = 0) {
  return getDataRequest('/libraries/source-identity-issues', { params: { offset } })
}

export function getLibrarySourceRepairWorklist() {
  return getDataRequest('/libraries/source-repair-worklist')
}

/** Reads complete/partial scans, retained diagnostics and legacy coverage without starting acquisition. */
export function getLibraryObservationHistory() {
  return getDataRequest('/libraries/observation-history')
}

/** Includes ingestion_status.preflight and sourceRecovery (shared wait or null); reads never start ingestion. */
export function getLibrary(id) {
  return getDataRequest(`/libraries/${id}`)
}

export function updateLibrary(id, data) {
  return apiClient.put(`/libraries/${id}`, data)
}

export function syncLibrary(id, options = {}) {
  return apiClient.post(`/libraries/${id}/sync`, options)
}

export function getSyncStatus() {
  return getDataRequest('/sync/status')
}

const libraryCatalogApi = {
  getLibraries,
  getLibraryOverlap,
  getLibraryObservationHealth,
  getLibraryProfileRefreshStatus,
  getLibraryUpgradeReadiness,
  getLibraryEvidenceCoverage,
  getLibrarySourceObservations,
  getLibrarySourceIdentityIssues,
  getLibrarySourceRepairWorklist,
  getLibraryObservationHistory,
  getLibrary,
  updateLibrary,
  syncLibrary,
  getSyncStatus,
}

export default libraryCatalogApi
