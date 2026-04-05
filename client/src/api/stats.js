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
  getPolicyStatsOverview() {
    return getDataRequest('/stats/overview')
  },

  getPolicyStatsList() {
    return getDataRequest('/stats/policies')
  },

  getPolicyStatsLiveFeed(limit = 20) {
    return getDataRequest('/stats/live-feed', { params: { limit } })
  },

  getPolicyStatsAlerts() {
    return getDataRequest('/stats/alerts')
  },

  getPolicyStatsDetail(policyId) {
    return getDataRequest(`/stats/policies/${policyId}`)
  },

  getPolicyStatsComparison(policyId) {
    return getDataRequest(`/stats/policies/${policyId}/compare`)
  },

  getPatternConfig() {
    return getDataRequest('/patterns/config')
  },

  updatePatternConfig(config) {
    return apiClient.put('/patterns/config', config)
  },

  getCostSummary() {
    return getDataRequest('/patterns/cost-summary')
  },

  getDetailedStats() {
    return getDataRequest('/stats/detailed')
  },
}
