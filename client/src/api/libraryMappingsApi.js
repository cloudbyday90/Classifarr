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

export function getMappings(mediaServerId) {
  return getDataRequest(`/mappings/${mediaServerId}`)
}

export function getUnmappedLibraries(mediaServerId) {
  return getDataRequest(`/mappings/${mediaServerId}/unmapped`)
}

export function getArrInstances(mediaServerId) {
  return getDataRequest(`/mappings/${mediaServerId}/arr-instances`)
}

export function autoDetectMappings(mediaServerId) {
  return apiClient.post(`/mappings/${mediaServerId}/auto-detect`)
}

export function getRootFolders(arrType, arrConfigId) {
  return getDataRequest(`/mappings/root-folders/${arrType}/${arrConfigId}`)
}

export function saveMapping(data) {
  return apiClient.post('/mappings', data)
}

export function deleteMapping(libraryId) {
  return apiClient.delete(`/mappings/library/${libraryId}`)
}

const libraryMappingsApi = {
  getMappings,
  getUnmappedLibraries,
  getArrInstances,
  autoDetectMappings,
  getRootFolders,
  saveMapping,
  deleteMapping,
}

export default libraryMappingsApi
