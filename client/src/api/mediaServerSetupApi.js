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

export function getMediaServerConfig() {
  return getDataRequest('/media-server')
}

export function getArrConfigStatus() {
  return getDataRequest('/settings/arr-config-status')
}

export function getSetupStatus() {
  return getDataRequest('/setup/status')
}

export function getSetupWizardStatus() {
  return getDataRequest('/settings/setup-status')
}

export function getHeartbeatSettings() {
  return getDataRequest('/settings/heartbeat')
}

export function updateHeartbeatSettings(data) {
  return apiClient.put('/settings/heartbeat', data)
}

export function getSystemHeartbeat() {
  return getDataRequest('/system/heartbeat')
}

export function updateMediaServerConfig(config) {
  return apiClient.post('/media-server', config)
}

export function testMediaServerConnection(config) {
  return apiClient.post('/media-server/test', config)
}

export function syncMediaServer() {
  return apiClient.post('/media-server/sync')
}

export function triggerIngestion() {
  return apiClient.post('/media-server/ingest')
}

export async function getMediaServers() {
  const response = await getDataRequest('/media-server')
  return response ? [response] : []
}

const mediaServerSetupApi = {
  getMediaServerConfig,
  getArrConfigStatus,
  getSetupStatus,
  getSetupWizardStatus,
  getHeartbeatSettings,
  updateHeartbeatSettings,
  getSystemHeartbeat,
  updateMediaServerConfig,
  testMediaServerConnection,
  syncMediaServer,
  triggerIngestion,
  getMediaServers,
}

export default mediaServerSetupApi
