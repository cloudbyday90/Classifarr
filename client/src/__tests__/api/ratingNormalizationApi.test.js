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
