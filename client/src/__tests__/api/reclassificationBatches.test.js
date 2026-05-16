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
  createReclassificationBatch,
  validateReclassificationBatch,
  executeReclassificationBatch,
  pauseReclassificationBatch,
  resumeReclassificationBatch,
  cancelReclassificationBatch,
  getReclassificationBatchStatus,
  skipReclassificationItem,
  retryReclassificationItem,
} from '../../api/reclassificationBatches'

describe('reclassificationBatches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createReclassificationBatch calls POST with items and default pauseOnError', async () => {
    const items = [{ mediaId: 1, from: 'A', to: 'B' }]
    mockPost.mockResolvedValueOnce({ data: { batchId: 'b1' } })
    const result = await createReclassificationBatch(items)
    expect(mockPost).toHaveBeenCalledWith('/reclassification/batch', { items, pauseOnError: true })
    expect(result).toEqual({ data: { batchId: 'b1' } })
  })

  it('createReclassificationBatch passes pauseOnError=false when specified', async () => {
    const items = [{ mediaId: 2 }]
    mockPost.mockResolvedValueOnce({ data: { batchId: 'b2' } })
    await createReclassificationBatch(items, false)
    expect(mockPost).toHaveBeenCalledWith('/reclassification/batch', { items, pauseOnError: false })
  })

  it('validateReclassificationBatch calls POST with batch id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { valid: true } })
    const result = await validateReclassificationBatch('b1')
    expect(mockPost).toHaveBeenCalledWith('/reclassification/batch/b1/validate')
    expect(result).toEqual({ data: { valid: true } })
  })

  it('executeReclassificationBatch calls POST with batch id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'running' } })
    const result = await executeReclassificationBatch('b1')
    expect(mockPost).toHaveBeenCalledWith('/reclassification/batch/b1/execute')
    expect(result).toEqual({ data: { status: 'running' } })
  })

  it('pauseReclassificationBatch calls POST with batch id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'paused' } })
    const result = await pauseReclassificationBatch('b1')
    expect(mockPost).toHaveBeenCalledWith('/reclassification/batch/b1/pause')
    expect(result).toEqual({ data: { status: 'paused' } })
  })

  it('resumeReclassificationBatch calls POST with batch id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'running' } })
    const result = await resumeReclassificationBatch('b1')
    expect(mockPost).toHaveBeenCalledWith('/reclassification/batch/b1/resume')
    expect(result).toEqual({ data: { status: 'running' } })
  })

  it('cancelReclassificationBatch calls POST with batch id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'cancelled' } })
    const result = await cancelReclassificationBatch('b1')
    expect(mockPost).toHaveBeenCalledWith('/reclassification/batch/b1/cancel')
    expect(result).toEqual({ data: { status: 'cancelled' } })
  })

  it('getReclassificationBatchStatus calls getDataRequest with batch id in URL', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ status: 'completed', items: [] })
    const result = await getReclassificationBatchStatus('b1')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/reclassification/batch/b1')
    expect(result).toEqual({ status: 'completed', items: [] })
  })

  it('skipReclassificationItem calls POST with batch and item ids in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { skipped: true } })
    const result = await skipReclassificationItem('b1', 'i1')
    expect(mockPost).toHaveBeenCalledWith('/reclassification/batch/b1/item/i1/skip')
    expect(result).toEqual({ data: { skipped: true } })
  })

  it('retryReclassificationItem calls POST with batch and item ids in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { retried: true } })
    const result = await retryReclassificationItem('b1', 'i1')
    expect(mockPost).toHaveBeenCalledWith('/reclassification/batch/b1/item/i1/retry')
    expect(result).toEqual({ data: { retried: true } })
  })
})
