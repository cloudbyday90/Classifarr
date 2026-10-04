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

export function getCustomPresets() {
  return getDataRequest('/presets/custom')
}

export function createCustomPreset(data) {
  return apiClient.post('/presets/custom', data, { skipAutomaticRetry: true, timeout: 30_000 })
}

export function updateCustomPreset(id, data) {
  return apiClient.put(`/presets/custom/${id}`, data, { skipAutomaticRetry: true, timeout: 30_000 })
}

export function getPendingCustomPresetSave() {
  return getDataRequest('/presets/custom/save-requests', { skipAutomaticRetry: true, timeout: 30_000 })
}

export function beginCustomPresetSave() {
  return apiClient.post('/presets/custom/save-requests', {}, { skipAutomaticRetry: true, timeout: 30_000 })
}

export function completeCustomPresetSave(requestId, data) {
  return apiClient.post(`/presets/custom/save-requests/${encodeURIComponent(requestId)}/complete`, data,
    { skipAutomaticRetry: true, timeout: 30_000 })
}

export function resolveCustomPresetSave(requestId) {
  return apiClient.post(`/presets/custom/save-requests/${encodeURIComponent(requestId)}/resolve`, {},
    { skipAutomaticRetry: true, timeout: 30_000 })
}

export function deleteCustomPreset(id) {
  return apiClient.delete(`/presets/custom/${id}`)
}

const customPresetsApi = {
  getCustomPresets,
  createCustomPreset,
  getPendingCustomPresetSave,
  beginCustomPresetSave,
  completeCustomPresetSave,
  resolveCustomPresetSave,
  updateCustomPreset,
  deleteCustomPreset,
}

export default customPresetsApi
