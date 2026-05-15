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

import { getDataRequest } from './core'

export function getAttachablePresets(params = {}) {
  return getDataRequest('/policies/presets/all', { params })
}

export function getSystemPresets(params = {}) {
  return getDataRequest('/policies/presets/all', {
    params: {
      ...params,
      include_custom: false,
    },
  })
}

export function getPresetUsageCount(id) {
  return getDataRequest(`/policies/presets/${id}/usage`)
}

export function getAllPresets() {
  return getDataRequest('/presets/all?include_custom=true')
}

const presetCatalogApi = {
  getAttachablePresets,
  getSystemPresets,
  getPresetUsageCount,
  getAllPresets,
}

export default presetCatalogApi
