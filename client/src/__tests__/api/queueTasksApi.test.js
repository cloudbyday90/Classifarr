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
  checkManualRouting,
  getManualRoutingBackground,
  setManualRoutingBackground,
  getRetryReadiness,
  getOmdbRetryReadiness,
  getQueuePending,
  getQueueFailed,
  retryQueueTask,
  dismissQueueTask,
  cancelQueueTask,
  classifyQueueTask,
} from '../../api/queueTasksApi'

describe('queueTasksApi', () => {
  it('reads background settings locally and writes only explicit enablement without retry', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ enabled: false })
    expect(await getManualRoutingBackground(12)).toEqual({ enabled: false })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/manual-routing/12/background', { skipAutomaticRetry: true })
    const response = { data: { enabled: true } }
    mockPost.mockResolvedValueOnce(response)
    expect(await setManualRoutingBackground(12, true)).toBe(response)
    expect(mockPost).toHaveBeenCalledWith('/queue/manual-routing/12/background', { enabled: true }, { skipAutomaticRetry: true })
  })
  it('checks one saved routing intent without automatic transport retry', async () => {
    const response = { data: { reason: 'verified_present', recorded: true } }
    mockPost.mockResolvedValueOnce(response)
    expect(await checkManualRouting(8)).toBe(response)
    expect(mockPost).toHaveBeenCalledWith('/queue/manual-routing/8/check', {}, { skipAutomaticRetry: true })
  })
  it('preserves the separate selection/routing result and never automatically retries the write', async () => {
    const response = { data: { success: true, classificationId: 6, routing: { routed: false, recorded: true } } }
    mockPost.mockResolvedValueOnce(response)
    expect(await classifyQueueTask(3, { library_id: 4 })).toBe(response)
    expect(mockPost).toHaveBeenCalledWith('/queue/tasks/3/classify', { library_id: 4 }, { skipAutomaticRetry: true })
  })
  it('reads OMDb readiness through a fixed route without rapid transport retries', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ scope: 'omdb' })
    expect(await getOmdbRetryReadiness()).toEqual({ scope: 'omdb' })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/omdb-retry-readiness', { skipAutomaticRetry: true })
  })
  it('reads retry readiness through the named data helper without parameters', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ version: 1 })
    expect(await getRetryReadiness()).toEqual({ version: 1 })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/retry-readiness', { skipAutomaticRetry: true })
  })
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getQueuePending calls getDataRequest with default limit', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 1 }])
    const result = await getQueuePending()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/pending', { params: { limit: 20 } })
    expect(result).toEqual([{ id: 1 }])
  })

  it('getQueuePending passes custom limit', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getQueuePending(50)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/pending', { params: { limit: 50 } })
  })

  it('getQueueFailed calls getDataRequest with default limit', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 2 }])
    const result = await getQueueFailed()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/failed', { params: { limit: 20 } })
    expect(result).toEqual([{ id: 2 }])
  })

  it('getQueueFailed passes custom limit', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getQueueFailed(100)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/failed', { params: { limit: 100 } })
  })

  it('retryQueueTask calls POST with task id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { retried: true } })
    const result = await retryQueueTask('t1')
    expect(mockPost).toHaveBeenCalledWith('/queue/task/t1/retry')
    expect(result).toEqual({ data: { retried: true } })
  })

  it('dismissQueueTask calls POST with task id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { dismissed: true } })
    const result = await dismissQueueTask('t2')
    expect(mockPost).toHaveBeenCalledWith('/queue/task/t2/dismiss')
    expect(result).toEqual({ data: { dismissed: true } })
  })

  it('cancelQueueTask calls POST with task id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { cancelled: true } })
    const result = await cancelQueueTask('t3')
    expect(mockPost).toHaveBeenCalledWith('/queue/task/t3/cancel')
    expect(result).toEqual({ data: { cancelled: true } })
  })
})
