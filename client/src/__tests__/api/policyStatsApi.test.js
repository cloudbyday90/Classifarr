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
})
