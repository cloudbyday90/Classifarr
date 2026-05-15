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

export function getPathMappings() {
  return getDataRequest('/settings/path-mappings')
}

export function createPathMapping(data) {
  return apiClient.post('/settings/path-mappings', data)
}

export function deletePathMapping(mappingId) {
  return apiClient.delete(`/settings/path-mappings/${mappingId}`)
}

export function verifyPathMapping(mappingId) {
  return apiClient.post(`/settings/path-mappings/${mappingId}/verify`)
}

export function verifyAllPathMappings() {
  return apiClient.post('/settings/path-mappings/verify-all')
}

export function getPathTestHealth() {
  return getDataRequest('/settings/path-test/health')
}

export function testPath(path) {
  return apiClient.post('/settings/path-test', { path })
}

const settingsPathMappingApi = {
  getPathMappings,
  createPathMapping,
  deletePathMapping,
  verifyPathMapping,
  verifyAllPathMappings,
  getPathTestHealth,
  testPath,
}

export default settingsPathMappingApi
