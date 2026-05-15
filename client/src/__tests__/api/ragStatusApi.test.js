import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
}))

import {
  getRagStatus,
  getRagDetailed,
  getLatestRagFallbackIncident,
  getRagPromotionReadiness,
} from '../../api/ragStatusApi'

describe('ragStatusApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getRagStatus calls getDataRequest with /rag/status', async () => {
    const status = { healthy: true, uptime: 3600 }
    mockGetDataRequest.mockResolvedValueOnce(status)
    const result = await getRagStatus()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/rag/status')
    expect(result).toEqual(status)
  })

  it('getRagDetailed calls getDataRequest with empty default params', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    const result = await getRagDetailed()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/rag/detailed', { params: {} })
    expect(result).toEqual([])
  })

  it('getRagDetailed passes provided params', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 1 }])
    await getRagDetailed({ category: 'embedding', limit: 10 })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/rag/detailed', { params: { category: 'embedding', limit: 10 } })
  })

  it('getLatestRagFallbackIncident calls getDataRequest with correct URL', async () => {
    const incident = { id: 'inc1', reason: 'timeout' }
    mockGetDataRequest.mockResolvedValueOnce(incident)
    const result = await getLatestRagFallbackIncident()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/rag/loop/latest-fallback-incident')
    expect(result).toEqual(incident)
  })

  it('getRagPromotionReadiness calls getDataRequest with correct URL', async () => {
    const readiness = { ready: true, metrics: {} }
    mockGetDataRequest.mockResolvedValueOnce(readiness)
    const result = await getRagPromotionReadiness()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/rag/loop/promotion-readiness')
    expect(result).toEqual(readiness)
  })
})
