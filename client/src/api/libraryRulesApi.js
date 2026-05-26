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

export function getLibraryRules(id) {
  return getDataRequest(`/libraries/${id}/rules`)
}

export function addLibraryRule(id, data) {
  return apiClient.post(`/libraries/${id}/rules`, data)
}

export function deleteLibraryRule(id, ruleId) {
  return apiClient.delete(`/libraries/${id}/rules/${ruleId}`)
}

export function getLibraryArrOptions(id) {
  return getDataRequest(`/libraries/${id}/arr-options`)
}

export function updateLibraryArrSettings(id, settings) {
  return apiClient.put(`/libraries/${id}/arr-settings`, { settings })
}

export function getLibraryProfile(libraryId) {
  return getDataRequest(`/libraries/${libraryId}/profile`)
}

export function refreshLibraryProfile(libraryId) {
  return apiClient.post(`/libraries/${libraryId}/profile/refresh`)
}

const libraryRulesApi = {
  getLibraryRules,
  addLibraryRule,
  deleteLibraryRule,
  getLibraryArrOptions,
  updateLibraryArrSettings,
  getLibraryProfile,
  refreshLibraryProfile,
}

export default libraryRulesApi
