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
  /**
   * GET /api/evidence/summary
   * Returns aggregate counts by scope, provenance, and status.
   */
  getSummary() {
    return getDataRequest('/evidence/summary')
  },

  /**
   * GET /api/evidence
   * Paginated, filtered evidence list.
   *
   * @param {object} [params]
   * @param {string}  [params.scope]
   * @param {string}  [params.provenance]
   * @param {string}  [params.status]
   * @param {number}  [params.libraryId]
   * @param {string}  [params.mediaType]
   * @param {number}  [params.limit]
   * @param {number}  [params.offset]
   */
  list(params = {}) {
    return getDataRequest('/evidence', { params })
  },

  /**
   * GET /api/evidence/:id
   * Fetch a single evidence row by ID.
   */
  getById(id) {
    return getDataRequest(`/evidence/${id}`)
  },

  /**
   * GET /api/evidence/:id/diagnose
   * Operator diagnostic view for one evidence row.
   */
  diagnose(id) {
    return getDataRequest(`/evidence/${id}/diagnose`)
  },

  /**
   * POST /api/evidence/:id/decay
   * Set a row's status to candidate.
   */
  decay(id) {
    return apiClient.post(`/evidence/${id}/decay`)
  },

  /**
   * POST /api/evidence/:id/promote
   * Set a row's status to active.
   */
  promote(id) {
    return apiClient.post(`/evidence/${id}/promote`)
  },

  /**
   * POST /api/evidence/purge
   * Bulk purge evidence rows matching the supplied filters.
   * At least one filter is required.
   *
   * @param {object} filter
   * @param {string}  [filter.scope]
   * @param {string}  [filter.provenance]
   * @param {string}  [filter.status]
   * @param {number}  [filter.libraryId]
   * @param {string}  [filter.mediaType]
   */
  purge(filter) {
    return apiClient.post('/evidence/purge', filter)
  }
}
