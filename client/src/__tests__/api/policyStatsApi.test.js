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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
}))

import {
  getPolicyStatsOverview,
  getPolicyStatsList,
  getPolicyStatsLiveFeed,
  getPolicyStatsAlerts,
  getPolicyStatsDetail,
  getPolicyStatsComparison,
  getDetailedStats,
  getCandidateBoundVerificationMetrics,
  getCurrentLibraryCandidateRetrievalMetrics,
  getPolicyCandidateContrastiveOutcomeMetrics,
  getOllamaVerificationRuntimeMismatchSummary,
  getOllamaVerificationCapabilityOutcomeHistory,
} from '../../api/policyStatsApi'

describe('policyStatsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPolicyStatsOverview calls getDataRequest with /stats/overview', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ total: 100 })
    await getPolicyStatsOverview()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/overview')
  })

  it('getPolicyStatsList calls getDataRequest with /stats/policies', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getPolicyStatsList()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/policies')
  })

  it('getPolicyStatsLiveFeed passes limit as param', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getPolicyStatsLiveFeed(50)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/live-feed', { params: { limit: 50 } })
  })

  it('getPolicyStatsLiveFeed defaults limit to 20', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getPolicyStatsLiveFeed()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/live-feed', { params: { limit: 20 } })
  })

  it('getPolicyStatsAlerts calls getDataRequest with /stats/alerts', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getPolicyStatsAlerts()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/alerts')
  })

  it('getPolicyStatsDetail calls getDataRequest with policy id', async () => {
    mockGetDataRequest.mockResolvedValueOnce({})
    await getPolicyStatsDetail(5)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/policies/5')
  })

  it('getPolicyStatsComparison calls getDataRequest with policy id', async () => {
    mockGetDataRequest.mockResolvedValueOnce({})
    await getPolicyStatsComparison(5)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/policies/5/compare')
  })

  it('getDetailedStats calls getDataRequest with /stats/detailed', async () => {
    mockGetDataRequest.mockResolvedValueOnce({})
    await getDetailedStats()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/detailed')
  })

  it('getCandidateBoundVerificationMetrics uses the bounded metrics endpoint', async () => {
    mockGetDataRequest.mockResolvedValueOnce({})
    await getCandidateBoundVerificationMetrics(14)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/candidate-bound-verification', { params: { days: 14 } })
  })

  it('getCurrentLibraryCandidateRetrievalMetrics uses the bounded aggregate endpoint', async () => {
    mockGetDataRequest.mockResolvedValueOnce({})
    await getCurrentLibraryCandidateRetrievalMetrics(14)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/current-library-candidate-retrieval', { params: { days: 14 } })
  })

  it('getPolicyCandidateContrastiveOutcomeMetrics uses the bounded aggregate endpoint', async () => {
    mockGetDataRequest.mockResolvedValueOnce({})
    await getPolicyCandidateContrastiveOutcomeMetrics(14)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/policy-candidate-contrastive-outcomes', { params: { days: 14 } })
  })

  it('getOllamaVerificationRuntimeMismatchSummary uses the protected aggregate endpoint without dimensions', async () => {
    mockGetDataRequest.mockResolvedValueOnce({})
    await getOllamaVerificationRuntimeMismatchSummary()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/ollama-verification-runtime-mismatch-summary')
  })

  it('getOllamaVerificationCapabilityOutcomeHistory uses the protected fixed-window endpoint without dimensions', async () => {
    mockGetDataRequest.mockResolvedValueOnce({})

    await getOllamaVerificationCapabilityOutcomeHistory()

    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/ollama-verification-capability-outcomes')
  })
})
