import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

import {
  getRatingNormalizationStats,
  startRatingBackfill,
  finalizeRatingNormalization,
} from '../../api/ratingNormalizationApi'

describe('ratingNormalizationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getRatingNormalizationStats calls getDataRequest with correct URL', async () => {
    const stats = { needsNormalization: 50, alreadyNormalized: 100 }
    mockGetDataRequest.mockResolvedValueOnce(stats)
    const result = await getRatingNormalizationStats()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/rating-normalization/stats')
    expect(result).toEqual(stats)
  })

  it('startRatingBackfill calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true, queued: 50 } })
    await startRatingBackfill()
    expect(mockPost).toHaveBeenCalledWith('/rating-normalization/backfill')
  })

  it('finalizeRatingNormalization calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await finalizeRatingNormalization()
    expect(mockPost).toHaveBeenCalledWith('/rating-normalization/finalize')
  })
})
