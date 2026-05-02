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

export function getRadarrConfig() {
  return apiClient.get('/settings/radarr')
}

export function addRadarrConfig(data) {
  return apiClient.post('/settings/radarr', data)
}

export function updateRadarrConfig(id, data) {
  return apiClient.put(`/settings/radarr/${id}`, data)
}

export function deleteRadarrConfig(id) {
  return apiClient.delete(`/settings/radarr/${id}`)
}

export function testRadarrConnection(config) {
  return apiClient.post('/settings/radarr/test', config)
}

export function getRadarrQualityProfiles(id) {
  return apiClient.get(`/settings/radarr/${id}/quality-profiles`)
}

export function getSonarrConfig() {
  return apiClient.get('/settings/sonarr')
}

export function addSonarrConfig(data) {
  return apiClient.post('/settings/sonarr', data)
}

export function updateSonarrConfig(id, data) {
  return apiClient.put(`/settings/sonarr/${id}`, data)
}

export function deleteSonarrConfig(id) {
  return apiClient.delete(`/settings/sonarr/${id}`)
}

export function testSonarrConnection(config) {
  return apiClient.post('/settings/sonarr/test', config)
}

export function getSonarrQualityProfiles(id) {
  return apiClient.get(`/settings/sonarr/${id}/quality-profiles`)
}

const settingsArrApi = {
  getRadarrConfig,
  addRadarrConfig,
  updateRadarrConfig,
  deleteRadarrConfig,
  testRadarrConnection,
  getRadarrQualityProfiles,
  getSonarrConfig,
  addSonarrConfig,
  updateSonarrConfig,
  deleteSonarrConfig,
  testSonarrConnection,
  getSonarrQualityProfiles,
}

export default settingsArrApi
