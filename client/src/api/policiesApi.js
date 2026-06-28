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

export function getPolicy(id) {
  return getDataRequest(`/policies/${id}`)
}

export function getPolicies() {
  return getDataRequest('/policies')
}

export function createPolicy(data) {
  return apiClient.post('/policies', data)
}

export function updatePolicy(id, data) {
  return apiClient.put(`/policies/${id}`, data)
}

export function previewPolicyIntentImpact(data) {
  return apiClient.post('/policies/intent/impact-preview', data)
}

export function deletePolicy(id) {
  return apiClient.delete(`/policies/${id}`)
}

export function getPresetSuggestions(libraryId) {
  return getDataRequest(`/policies/presets/suggest/${libraryId}`)
}

const policiesApi = {
  getPolicy,
  getPolicies,
  createPolicy,
  updatePolicy,
  previewPolicyIntentImpact,
  deletePolicy,
  getPresetSuggestions,
}

export default policiesApi
