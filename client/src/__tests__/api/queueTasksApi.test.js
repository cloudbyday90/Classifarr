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
  checkQueueTaskMetadata,
  getQueueIdentityRepair,
  previewQueueIdentityRepair,
  confirmQueueIdentityRepair,
  retryQueueIdentityRepair,
  getQueueRepairBackfill,
  retryQueueRepairBackfill,
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
  it('uses bounded discovery parameters and never automatically repeats selected backfill', async () => {
    const signal = new AbortController().signal
    const snapshot = { items: [{ taskId: '23', readiness: { status: 'blocked', reason: 'provider_changed' } }],
      nextCursor: null, checkedAt: '2026-10-13T23:00:00Z' }
    mockGetDataRequest.mockResolvedValue(snapshot)
    expect(await getQueueRepairBackfill()).toBe(snapshot)
    expect(mockGetDataRequest).toHaveBeenLastCalledWith('/queue/identity-repair/backfill', { params: {}, skipAutomaticRetry: true, signal: undefined })
    await getQueueRepairBackfill({ afterId: '23', signal })
    expect(mockGetDataRequest).toHaveBeenLastCalledWith('/queue/identity-repair/backfill', { params: { afterId: '23' }, skipAutomaticRetry: true, signal })
    const body = { items: [{ taskId: '23', receiptId: 'fixture' }], confirmRetry: true }
    const response = { data: { receipts: [] } }
    mockPost.mockResolvedValue(response)
    expect(await retryQueueRepairBackfill(body, { signal })).toBe(response)
    expect(mockPost).toHaveBeenCalledWith('/queue/identity-repair/backfill', body, { skipAutomaticRetry: true, signal })
  })
  it('reads durable repair state through the unwrapped GET helper', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ receipt: null })
    expect(await getQueueIdentityRepair(12)).toEqual({ receipt: null })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/task/12/identity-repair', { skipAutomaticRetry: true, signal: undefined })
  })
  it.each([
    ['preview', previewQueueIdentityRepair, {}],
    ['confirm', confirmQueueIdentityRepair, { previewId: 'fixture', sameWorkAndEdition: true }],
    ['retry', retryQueueIdentityRepair, { receiptId: 'fixture' }],
  ])('explicit %s repair command preserves Axios response and never retries automatically', async (action, method, body) => {
    const signal = new AbortController().signal
    const response = { data: { receipt: null } }
    mockPost.mockResolvedValueOnce(response)
    const result = action === 'preview' ? await method(12, { signal }) : await method(12, body, { signal })
    expect(result).toBe(response)
    expect(mockPost).toHaveBeenCalledWith(`/queue/task/12/identity-repair/${action}`, body, { skipAutomaticRetry: true, signal })
  })
  it('checks a saved ID without automatic retry or caller-supplied replacement', async () => {
    const signal = new AbortController().signal
    const response = { data: { taskId: '12' } }
    mockPost.mockResolvedValueOnce(response)
    expect(await checkQueueTaskMetadata(12, { signal })).toBe(response)
    expect(mockPost).toHaveBeenCalledWith('/queue/task/12/metadata-check', {}, { skipAutomaticRetry: true, signal })
  })
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
  it('preserves exact BIGINT paths for the check and both background commands', async () => {
    await checkManualRouting('9007199254740993')
    await getManualRoutingBackground('9223372036854775807')
    await setManualRoutingBackground('9007199254740992', true)
    expect(mockPost).toHaveBeenCalledWith('/queue/manual-routing/9007199254740993/check', {}, { skipAutomaticRetry: true })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/manual-routing/9223372036854775807/background', { skipAutomaticRetry: true })
    expect(mockPost).toHaveBeenCalledWith('/queue/manual-routing/9007199254740992/background', { enabled: true }, { skipAutomaticRetry: true })
  })
  it('refuses unsafe or noncanonical values before constructing a routing request', () => {
    mockPost.mockClear()
    mockGetDataRequest.mockClear()
    for (const id of [9007199254740992, '009', '9path', '..', ['9'], '9223372036854775808']) {
      expect(() => checkManualRouting(id)).toThrow('Valid classification ID is required')
      expect(() => getManualRoutingBackground(id)).toThrow('Valid classification ID is required')
      expect(() => setManualRoutingBackground(id, true)).toThrow('Valid classification ID is required')
    }
    expect(mockPost).not.toHaveBeenCalled()
    expect(mockGetDataRequest).not.toHaveBeenCalled()
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
    const result = await retryQueueTask(1)
    expect(mockPost).toHaveBeenCalledWith('/queue/task/1/retry')
    expect(result).toEqual({ data: { retried: true } })
  })

  it('dismissQueueTask calls POST with task id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { dismissed: true } })
    const result = await dismissQueueTask('2')
    expect(mockPost).toHaveBeenCalledWith('/queue/task/2/dismiss')
    expect(result).toEqual({ data: { dismissed: true } })
  })

  it('cancelQueueTask calls POST with task id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { cancelled: true } })
    const result = await cancelQueueTask(3)
    expect(mockPost).toHaveBeenCalledWith('/queue/task/3/cancel')
    expect(result).toEqual({ data: { cancelled: true } })
  })

  it.each(['9007199254740992', '9007199254740993', '9223372036854775807'])('keeps %s exact in all four action URLs', async (id) => {
    const selection = { library_id: 4 }
    await retryQueueTask(id)
    await dismissQueueTask(id)
    await cancelQueueTask(id)
    await classifyQueueTask(id, selection)
    expect(mockPost.mock.calls).toEqual([
      [`/queue/task/${id}/retry`],
      [`/queue/task/${id}/dismiss`],
      [`/queue/task/${id}/cancel`],
      [`/queue/tasks/${id}/classify`, selection, { skipAutomaticRetry: true }],
    ])
  })

  it('refuses invalid queue task IDs before any action request', () => {
    for (const id of [0, 2.5, Number.MAX_SAFE_INTEGER + 1, '01', '1suffix', '1e2', ' 1', '../1', ['1'], '9223372036854775808']) {
      expect(() => retryQueueTask(id)).toThrow('Valid task id is required')
      expect(() => dismissQueueTask(id)).toThrow('Valid task id is required')
      expect(() => cancelQueueTask(id)).toThrow('Valid task id is required')
      expect(() => classifyQueueTask(id, { library_id: 4 })).toThrow('Valid task id is required')
    }
    expect(mockPost).not.toHaveBeenCalled()
  })
})
