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

/** Raw readiness/status fields plus per-service freshness/effectiveStatus and freshnessPolicy.
 * Receiving this response does not mean its cached provider observations are fresh.
 */
export function getSystemHealth() {
  return getDataRequest('/system/health')
}

/** Detailed observations with active, inactive and unknown summary counts.
 * Unlike /system/health's database readiness status, overall summarizes returned services.
 */
export function getSystemServicesHealth() {
  return getDataRequest('/system/health/services')
}

/** Unwrapped status; pgvector.selection carries validated, scoped startup evidence. */
export function getSystemStatus() {
  return getDataRequest('/system/status')
}

export function getImageIndexProgress() {
  return getDataRequest('/stats/image-index-progress')
}

export function refreshSystemHealth() {
  return apiClient.post('/system/health/refresh')
}

export function resetOmdbCircuitBreaker() {
  return apiClient.post('/settings/omdb/circuit-breaker/reset')
}

export function browseFolders(path) {
  return getDataRequest(`/system/browse-folders?path=${encodeURIComponent(path)}`)
}

const systemHealthApi = {
  getSystemServicesHealth,
  getSystemHealth,
  getSystemStatus,
  getImageIndexProgress,
  refreshSystemHealth,
  resetOmdbCircuitBreaker,
  browseFolders,
}

export default systemHealthApi
