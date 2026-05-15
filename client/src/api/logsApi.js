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

export function getLogStats() {
  return getDataRequest('/logs/stats')
}

export function getLogs(params) {
  const query = params.toString()
  return getDataRequest(`/logs?${query}`)
}

export function getLogError(errorId) {
  return getDataRequest(`/logs/error/${errorId}`)
}

export function getBugReport(errorId) {
  return getDataRequest(`/logs/error/${errorId}/report`)
}

export function resolveLogError(errorId) {
  return apiClient.post(`/logs/error/${errorId}/resolve`, {})
}

export function exportLogs(params) {
  const query = params.toString()
  return getDataRequest(`/logs/export?${query}`)
}

export function clearAllLogs() {
  return apiClient.delete('/logs')
}

export function cleanupLogs() {
  return apiClient.post('/logs/cleanup', {})
}

const logsApi = {
  getLogStats,
  getLogs,
  getLogError,
  getBugReport,
  resolveLogError,
  exportLogs,
  clearAllLogs,
  cleanupLogs,
}

export default logsApi
