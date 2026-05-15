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
import { createMediaServerAuthApi } from './mediaServerAuthFactory'

const jellyfin = createMediaServerAuthApi('jellyfin')

export const testJellyfinConnection = jellyfin.testConnection
export const authenticateJellyfin = jellyfin.authenticate
export const saveJellyfinServer = jellyfin.saveServer

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

export default {
  testJellyfinConnection,
  isJellyfinQuickConnectEnabled,
  initiateJellyfinQuickConnect,
  checkJellyfinQuickConnect,
  authenticateJellyfinQuickConnect,
  authenticateJellyfin,
  saveJellyfinServer,
}
