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

export function testJellyfinConnection(serverUrl) {
  return apiClient.post('/jellyfin/test', { serverUrl })
}

export function isJellyfinQuickConnectEnabled(serverUrl) {
  return apiClient.post('/jellyfin/quick-connect/enabled', { serverUrl })
}

export function initiateJellyfinQuickConnect(serverUrl) {
  return apiClient.post('/jellyfin/quick-connect/initiate', { serverUrl })
}

export function checkJellyfinQuickConnect(serverUrl, secret) {
  return apiClient.post('/jellyfin/quick-connect/check', { serverUrl, secret })
}

export function authenticateJellyfinQuickConnect(serverUrl, secret) {
  return apiClient.post('/jellyfin/quick-connect/authenticate', { serverUrl, secret })
}

export function authenticateJellyfin(serverUrl, username, password) {
  return apiClient.post('/jellyfin/authenticate', { serverUrl, username, password })
}

export function saveJellyfinServer(serverUrl, token, serverName) {
  return apiClient.post('/jellyfin/save', { serverUrl, token, serverName })
}

const jellyfinApi = {
  testJellyfinConnection,
  isJellyfinQuickConnectEnabled,
  initiateJellyfinQuickConnect,
  checkJellyfinQuickConnect,
  authenticateJellyfinQuickConnect,
  authenticateJellyfin,
  saveJellyfinServer,
}

export default jellyfinApi
