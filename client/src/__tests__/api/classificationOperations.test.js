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
  classify,
  getHistory,
  submitCorrection,
  getStats,
  getClassificationProfile,
  getClassificationProgress,
  getSecondPassEvaluation,
  getLiveFeed,
  getPendingClassifications,
  getPendingQuestionCleanupInventory,
  getHistoricRouteSafetyRefreshInventory,
  executeHistoricRouteSafetyRefresh,
  rememberResolvedExactItem,
  resolvePendingClassification,
  retryClassifications,
} from '../../api/classificationOperations'

describe('classificationOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('classify calls POST /classification/classify with data', async () => {
    const data = { libraryId: 1, mediaIds: [10, 20] }
    mockPost.mockResolvedValueOnce({ data: { results: [] } })
    const result = await classify(data)
    expect(mockPost).toHaveBeenCalledWith('/classification/classify', data)
    expect(result).toEqual({ data: { results: [] } })
  })

  it('getHistory calls getDataRequest with params', async () => {
    const params = { page: 1, limit: 50 }
    mockGetDataRequest.mockResolvedValueOnce({ items: [], total: 0 })
    const result = await getHistory(params)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/classification/history', { params })
    expect(result).toEqual({ items: [], total: 0 })
  })

  it('submitCorrection calls POST /classification/corrections with data', async () => {
    const data = { classificationId: 'c1', correctedLabel: 'Movie' }
    mockPost.mockResolvedValueOnce({ data: { ok: true } })
    const result = await submitCorrection(data)
    expect(mockPost).toHaveBeenCalledWith('/classification/corrections', data)
    expect(result).toEqual({ data: { ok: true } })
  })

  it('getStats calls getDataRequest with /classification/stats', async () => {
    const stats = { total: 100, correct: 85 }
    mockGetDataRequest.mockResolvedValueOnce(stats)
    const result = await getStats()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/classification/stats')
    expect(result).toEqual(stats)
  })

  it('getClassificationProfile calls getDataRequest with id in URL', async () => {
    const profile = { id: 'c5', confidence: 0.92 }
    mockGetDataRequest.mockResolvedValueOnce(profile)
    const result = await getClassificationProfile('c5')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/classification/history/c5/profile')
    expect(result).toEqual(profile)
  })

  it('getClassificationProgress calls getDataRequest with /classification/progress', async () => {
    const progress = { processed: 50, total: 100 }
    mockGetDataRequest.mockResolvedValueOnce(progress)
    const result = await getClassificationProgress()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/classification/progress')
    expect(result).toEqual(progress)
  })

  it('getSecondPassEvaluation calls getDataRequest with default days=30', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ evaluations: [] })
    await getSecondPassEvaluation()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/classification/second-pass-evaluation', {
      params: { days: 30 },
    })
  })

  it('getSecondPassEvaluation passes custom days', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ evaluations: [] })
    await getSecondPassEvaluation(7)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/classification/second-pass-evaluation', {
      params: { days: 7 },
    })
  })

  it('getLiveFeed calls getDataRequest with default limit=50', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getLiveFeed()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/classification/live-feed', { params: { limit: 50 } })
  })

  it('getLiveFeed passes custom limit', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getLiveFeed(25)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/classification/live-feed', { params: { limit: 25 } })
  })

  it('getPendingClassifications calls getDataRequest with /classification/pending', async () => {
    const pending = [{ id: 'p1', status: 'pending' }]
    mockGetDataRequest.mockResolvedValueOnce(pending)
    const result = await getPendingClassifications()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/classification/pending')
    expect(result).toEqual(pending)
  })

  it('getPendingQuestionCleanupInventory requests the server-owned dry-run report', async () => {
    const inventory = { mode: 'dry_run', records: [] }
    mockGetDataRequest.mockResolvedValueOnce(inventory)
    const result = await getPendingQuestionCleanupInventory()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/classification/pending-cleanup/inventory')
    expect(result).toEqual(inventory)
  })

  it('getHistoricRouteSafetyRefreshInventory requests the bounded read-only report', async () => {
    const inventory = { mode: 'read_only', records: [] }
    mockGetDataRequest.mockResolvedValueOnce(inventory)
    const result = await getHistoricRouteSafetyRefreshInventory({ cursor: 41, limit: 25 })
    expect(mockGetDataRequest).toHaveBeenCalledWith(
      '/classification/pending/route-safety-refresh-inventory',
      { params: { cursor: 41, limit: 25 } },
    )
    expect(result).toEqual(inventory)
  })

  it('executeHistoricRouteSafetyRefresh sends only operator-selected IDs to the bounded command', async () => {
    mockPost.mockResolvedValueOnce({ data: { retryReceipt: 'receipt', records: [] } })
    const result = await executeHistoricRouteSafetyRefresh([41, 42])
    expect(mockPost).toHaveBeenCalledWith('/classification/pending/route-safety-refresh/retry', {
      classificationIds: [41, 42],
    })
    expect(result).toEqual({ data: { retryReceipt: 'receipt', records: [] } })
  })

  it('resolvePendingClassification calls POST with id in URL and payload', async () => {
    const payload = { label: 'TV Show', confidence: 0.95 }
    mockPost.mockResolvedValueOnce({ data: { resolved: true } })
    const result = await resolvePendingClassification('p1', payload)
    expect(mockPost).toHaveBeenCalledWith('/classification/pending/p1/resolve', payload)
    expect(result).toEqual({ data: { resolved: true } })
  })

  it('rememberResolvedExactItem calls the empty-body exact-item command', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'applied' } })
    const result = await rememberResolvedExactItem('p1')
    expect(mockPost).toHaveBeenCalledWith('/classification/history/p1/exact-item-memory')
    expect(result).toEqual({ data: { status: 'applied' } })
  })

  it('retryClassifications calls POST with ids and empty default options', async () => {
    mockPost.mockResolvedValueOnce({ data: { retried: 3 } })
    const result = await retryClassifications(['c1', 'c2', 'c3'])
    expect(mockPost).toHaveBeenCalledWith('/classification/retry', {
      classificationIds: ['c1', 'c2', 'c3'],
      options: {},
    })
    expect(result).toEqual({ data: { retried: 3 } })
  })

  it('retryClassifications passes custom options', async () => {
    mockPost.mockResolvedValueOnce({ data: { retried: 1 } })
    await retryClassifications(['c1'], { force: true })
    expect(mockPost).toHaveBeenCalledWith('/classification/retry', {
      classificationIds: ['c1'],
      options: { force: true },
    })
  })
})
