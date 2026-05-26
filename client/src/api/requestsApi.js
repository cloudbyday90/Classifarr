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

/** @public */
export function searchTMDB(query, type = 'multi') {
  return getDataRequest('/requests/search', { params: { q: query, type } })
}

/** @public */
export function submitManualRequest(data) {
  return apiClient.post('/requests/submit', data)
}

/** @public */
export function getRecentManualRequests(limit = 10) {
  return getDataRequest('/requests/recent', { params: { limit } })
}

const requestsApi = {
  searchTMDB,
  submitManualRequest,
  getRecentManualRequests,
}

export default requestsApi
