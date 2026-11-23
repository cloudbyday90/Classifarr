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

export function getSuggestions(status = 'pending', policyId = null) {
  const params = {}

  if (status) params.status = status
  if (policyId) params.policyId = policyId

  return getDataRequest('/suggestions', { params })
}

export function getSuggestion(id) {
  return getDataRequest(`/suggestions/${id}`)
}

const invalidSuggestionId = 'Invalid suggestion ID. Use a whole number from 1 to 2147483647 in decimal form.'

function suggestionReviewId(id) {
  const text = typeof id === 'number' ? String(id) : id
  return typeof text === 'string' && /^[1-9][0-9]{0,9}$/.test(text) && Number(text) <= 2147483647 ? text : null
}

/** Applies a suggestion with a canonical positive INTEGER ID and an administrator session. */
export function applySuggestion(id) {
  const text = suggestionReviewId(id)
  if (!text) return Promise.reject(new TypeError(invalidSuggestionId))
  return apiClient.post(`/suggestions/${text}/apply`)
}

/** Rejects a suggestion with a canonical positive INTEGER ID and an administrator session. */
export function rejectSuggestion(id, reason) {
  const text = suggestionReviewId(id)
  if (!text) return Promise.reject(new TypeError(invalidSuggestionId))
  return apiClient.post(`/suggestions/${text}/reject`, { reason })
}

const adminSuggestionsApi = {
  getSuggestions,
  getSuggestion,
  applySuggestion,
  rejectSuggestion,
}

export default adminSuggestionsApi
