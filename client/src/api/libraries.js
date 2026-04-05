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
  getLibraries() {
    return getDataRequest('/libraries')
  },

  getLibrary(id) {
    return getDataRequest(`/libraries/${id}`)
  },

  updateLibrary(id, data) {
    return apiClient.put(`/libraries/${id}`, data)
  },

  syncLibrary(id, options = {}) {
    return apiClient.post(`/libraries/${id}/sync`, options)
  },

  getLibraryMigrationRules(libraryId) {
    return getDataRequest(`/migration/libraries/${libraryId}/rules`)
  },

  getMigrationStatus() {
    return getDataRequest('/migration/status')
  },

  getMigrationLibraries() {
    return getDataRequest('/migration/libraries')
  },

  migrateAllLibraryRules(libraryId, data) {
    return apiClient.post(`/migration/libraries/${libraryId}/migrate-all`, data)
  },

  analyzeMigrationRule(ruleId) {
    return getDataRequest(`/migration/rules/${ruleId}/analyze`)
  },

  migrateRule(ruleId, data) {
    return apiClient.post(`/migration/rules/${ruleId}/migrate`, data)
  },

  getLibraryRules(id) {
    return getDataRequest(`/libraries/${id}/rules`)
  },

  addLibraryRule(id, data) {
    return apiClient.post(`/libraries/${id}/rules`, data)
  },

  deleteLibraryRule(id, ruleId) {
    return apiClient.delete(`/libraries/${id}/rules/${ruleId}`)
  },

  getRuleSuggestions(id) {
    return getDataRequest(`/libraries/${id}/rules/suggest`)
  },

  getLibraryArrOptions(id) {
    return getDataRequest(`/libraries/${id}/arr-options`)
  },

  updateLibraryArrSettings(id, settings) {
    return apiClient.put(`/libraries/${id}/arr-settings`, { settings })
  },

  getLibraryProfile(libraryId) {
    return getDataRequest(`/libraries/${libraryId}/profile`)
  },

  refreshLibraryProfile(libraryId) {
    return apiClient.post(`/libraries/${libraryId}/profile/refresh`)
  },
}
