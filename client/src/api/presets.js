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

import api from './index'

/**
 * Presets API - handles all preset-related API calls
 */
export default {
  /**
   * Get attachable presets for policy builder flows.
   * This includes builtin and custom presets that can be attached to policies.
   * @param {Object} params - Query parameters (category, search)
   * @returns {Promise}
   */
  getAttachablePresets(params = {}) {
    return api.getData('/policies/presets/all', { params })
  },

  /**
   * Get all system presets
   * @param {Object} params - Query parameters (category, search)
   * @returns {Promise}
   */
  getSystemPresets(params = {}) {
    return api.getData('/policies/presets/all', {
      params: {
        ...params,
        include_custom: false
      }
    })
  },

  /**
   * Get all custom presets
   * @returns {Promise}
   */
  getCustomPresets() {
    return api.getData('/presets/custom')
  },

  /**
   * Get a single custom preset by ID
   * @param {number|string} id - Preset ID
   * @returns {Promise}
   */
  getCustomPreset(id) {
    return api.getData(`/presets/custom/${id}`)
  },

  /**
   * Create a new custom preset
   * @param {Object} data - Preset data
   * @returns {Promise}
   */
  createCustomPreset(data) {
    return api.post('/presets/custom', data)
  },

  /**
   * Update an existing custom preset
   * @param {number|string} id - Preset ID
   * @param {Object} data - Updated preset data
   * @returns {Promise}
   */
  updateCustomPreset(id, data) {
    return api.put(`/presets/custom/${id}`, data)
  },

  /**
   * Delete a custom preset
   * @param {number|string} id - Preset ID
   * @returns {Promise}
   */
  deleteCustomPreset(id) {
    return api.delete(`/presets/custom/${id}`)
  },

  /**
   * Get all presets (system + custom)
   * @param {Object} params - Query parameters (category, search)
   * @returns {Promise}
   */
  async getAllPresets(params = {}) {
    return api.getData('/presets/all', { params })
  },

  /**
   * Get usage count for a preset (how many policies use it)
   * @param {number|string} id - Preset ID
   * @returns {Promise}
   */
  getPresetUsageCount(id) {
    return api.getData(`/policies/presets/${id}/usage`)
  }
}
