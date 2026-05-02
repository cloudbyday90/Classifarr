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

export function getApiKeys() {
  return getDataRequest('/keys')
}

export function createApiKey(data) {
  return apiClient.post('/keys', data)
}

export function updateApiKey(id, data) {
  return apiClient.patch(`/keys/${id}`, data)
}

export function deleteApiKey(id) {
  return apiClient.delete(`/keys/${id}`)
}

export function revealApiKey(id) {
  return getDataRequest(`/keys/${id}`)
}

const adminApiKeysApi = {
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  revealApiKey,
}

export default adminApiKeysApi
