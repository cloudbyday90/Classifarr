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

export function getSystemHealth() {
  return getDataRequest('/system/health')
}

export function getSystemStatus() {
  return getDataRequest('/system/status')
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
  getSystemHealth,
  getSystemStatus,
  refreshSystemHealth,
  resetOmdbCircuitBreaker,
  browseFolders,
}

export default systemHealthApi
