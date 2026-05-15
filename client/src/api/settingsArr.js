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

function createArrConfigApi(type) {
  const base = `/settings/${type}`
  return {
    getConfig: () => getDataRequest(base),
    addConfig: (data) => apiClient.post(base, data),
    updateConfig: (id, data) => apiClient.put(`${base}/${id}`, data),
    deleteConfig: (id) => apiClient.delete(`${base}/${id}`),
    testConnection: (config) => apiClient.post(`${base}/test`, config),
    getQualityProfiles: (id) => getDataRequest(`${base}/${id}/quality-profiles`),
  }
}

const radarr = createArrConfigApi('radarr')
const sonarr = createArrConfigApi('sonarr')

export const getRadarrConfig = radarr.getConfig
export const addRadarrConfig = radarr.addConfig
export const updateRadarrConfig = radarr.updateConfig
export const deleteRadarrConfig = radarr.deleteConfig
export const testRadarrConnection = radarr.testConnection
export const getRadarrQualityProfiles = radarr.getQualityProfiles

export const getSonarrConfig = sonarr.getConfig
export const addSonarrConfig = sonarr.addConfig
export const updateSonarrConfig = sonarr.updateConfig
export const deleteSonarrConfig = sonarr.deleteConfig
export const testSonarrConnection = sonarr.testConnection
export const getSonarrQualityProfiles = sonarr.getQualityProfiles

export default {
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
