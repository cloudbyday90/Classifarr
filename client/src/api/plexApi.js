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

export function createPlexPin() {
  return apiClient.post('/plex/pin')
}

export function checkPlexPin(pinId) {
  return getDataRequest(`/plex/pin/${pinId}`)
}

export function getPlexServers(authToken) {
  return apiClient.post('/plex/servers', { authToken })
}

export function getPlexUser(authToken) {
  return apiClient.post('/plex/user', { authToken })
}

export function testPlexConnection(url, token) {
  return apiClient.post('/plex/test-connection', { url, token })
}

export function savePlexServer(name, url, token, clientIdentifier) {
  return apiClient.post('/plex/save-server', { name, url, token, clientIdentifier })
}

const plexApi = {
  createPlexPin,
  checkPlexPin,
  getPlexServers,
  getPlexUser,
  testPlexConnection,
  savePlexServer,
}

export default plexApi
