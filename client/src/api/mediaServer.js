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

export default {
  getMediaServerConfig() {
    return getDataRequest('/media-server')
  },

  getArrConfigStatus() {
    return getDataRequest('/settings/arr-config-status')
  },

  getSetupStatus() {
    return getDataRequest('/setup/status')
  },

  getSetupWizardStatus() {
    return getDataRequest('/settings/setup-status')
  },

  getHeartbeatSettings() {
    return getDataRequest('/settings/heartbeat')
  },

  updateHeartbeatSettings(data) {
    return apiClient.put('/settings/heartbeat', data)
  },

  getSystemHeartbeat() {
    return getDataRequest('/system/heartbeat')
  },

  updateMediaServerConfig(config) {
    return apiClient.post('/media-server', config)
  },

  testMediaServerConnection(config) {
    return apiClient.post('/media-server/test', config)
  },

  syncMediaServer() {
    return apiClient.post('/media-server/sync')
  },

  triggerIngestion() {
    return apiClient.post('/media-server/ingest')
  },

  async getMediaServers() {
    const response = await getDataRequest('/media-server')
    return response ? [response] : []
  },

  createPlexPin() {
    return apiClient.post('/plex/pin')
  },

  checkPlexPin(pinId) {
    return apiClient.get(`/plex/pin/${pinId}`)
  },

  getPlexServers(authToken) {
    return apiClient.post('/plex/servers', { authToken })
  },

  getPlexUser(authToken) {
    return apiClient.post('/plex/user', { authToken })
  },

  testPlexConnection(url, token) {
    return apiClient.post('/plex/test-connection', { url, token })
  },

  findPlexConnection(server) {
    return apiClient.post('/plex/find-connection', { server })
  },

  savePlexServer(name, url, token, clientIdentifier) {
    return apiClient.post('/plex/save-server', { name, url, token, clientIdentifier })
  },

  testJellyfinConnection(serverUrl) {
    return apiClient.post('/jellyfin/test', { serverUrl })
  },

  isJellyfinQuickConnectEnabled(serverUrl) {
    return apiClient.post('/jellyfin/quick-connect/enabled', { serverUrl })
  },

  initiateJellyfinQuickConnect(serverUrl) {
    return apiClient.post('/jellyfin/quick-connect/initiate', { serverUrl })
  },

  checkJellyfinQuickConnect(serverUrl, secret) {
    return apiClient.post('/jellyfin/quick-connect/check', { serverUrl, secret })
  },

  authenticateJellyfinQuickConnect(serverUrl, secret) {
    return apiClient.post('/jellyfin/quick-connect/authenticate', { serverUrl, secret })
  },

  authenticateJellyfin(serverUrl, username, password) {
    return apiClient.post('/jellyfin/authenticate', { serverUrl, username, password })
  },

  saveJellyfinServer(serverUrl, token, serverName) {
    return apiClient.post('/jellyfin/save', { serverUrl, token, serverName })
  },

  testEmbyConnection(serverUrl) {
    return apiClient.post('/emby/test', { serverUrl })
  },

  authenticateEmby(serverUrl, username, password) {
    return apiClient.post('/emby/authenticate', { serverUrl, username, password })
  },

  saveEmbyServer(serverUrl, token, serverName) {
    return apiClient.post('/emby/save', { serverUrl, token, serverName })
  },
}
