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
  getSuggestions,
  getSuggestionPage,
  getSuggestion,
  getSuggestionProposal,
  getSuggestionEvidence,
  applySuggestion,
  rejectSuggestion,
  runSuggestionAnalysisSummary,
} from '../../api/adminSuggestions'

describe('adminSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts one explicitly selected summary without automatic replay', async () => {
    const result = { data: { format: 'summary-v1', nextAfterPolicyId: 42 } }
    mockPost.mockResolvedValueOnce(result)
    await expect(runSuggestionAnalysisSummary()).resolves.toBe(result)
    expect(mockPost).toHaveBeenCalledWith('/feedback/analyze-all', {}, {
      params: { format: 'summary-v1' }, skipAutomaticRetry: true,
    })
  })

  it('uses the exact continuation when explicitly passed', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    await runSuggestionAnalysisSummary('2147483647')
    expect(mockPost).toHaveBeenCalledWith('/feedback/analyze-all', {}, {
      params: { format: 'summary-v1', afterPolicyId: '2147483647' }, skipAutomaticRetry: true,
    })
  })

  it.each([null, 0, '01', '1e0', 2147483648])('rejects invalid continuation %s without dispatching', async afterPolicyId => {
    await expect(runSuggestionAnalysisSummary(afterPolicyId)).rejects.toThrow('Invalid analysis continuation policy ID.')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('getSuggestions calls getDataRequest with default status=pending', async () => {
    const suggestions = [{ id: 1, type: 'tuning' }]
    mockGetDataRequest.mockResolvedValueOnce(suggestions)
    const result = await getSuggestions()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/suggestions', {
      params: { status: 'pending' },
    })
    expect(result).toEqual(suggestions)
  })

  it('getSuggestions passes custom status and policyId', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getSuggestions('applied', 42)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/suggestions', {
      params: { status: 'applied', policyId: 42 },
    })
  })

  it('getSuggestions omits policyId when null', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getSuggestions('rejected')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/suggestions', {
      params: { status: 'rejected' },
    })
  })

  it('getSuggestion calls getDataRequest with id in URL', async () => {
    const suggestion = { id: 5, type: 'threshold', status: 'pending' }
    mockGetDataRequest.mockResolvedValueOnce(suggestion)
    const result = await getSuggestion(5)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/suggestions/5')
    expect(result).toEqual(suggestion)
  })

  it('reads one pending page by default and sends an explicit all filter and continuation', async () => {
    const first = { items: [{ id: 2147483647 }], nextBeforeId: 2147483647 }
    const last = { items: [], nextBeforeId: null }
    mockGetDataRequest.mockResolvedValueOnce(first).mockResolvedValueOnce(last)

    await expect(getSuggestionPage()).resolves.toBe(first)
    expect(mockGetDataRequest).toHaveBeenCalledExactlyOnceWith('/suggestions/page', { params: { status: 'pending' } })
    await expect(getSuggestionPage({ status: 'all', policyId: 42, beforeId: first.nextBeforeId })).resolves.toBe(last)
    expect(mockGetDataRequest).toHaveBeenNthCalledWith(2, '/suggestions/page', {
      params: { status: 'all', policyId: '42', beforeId: '2147483647' },
    })
  })

  it.each([{ status: '' }, { status: ['all'] }, { policyId: '01' }, { beforeId: 2147483648 }, { beforeId: null }])(
    'rejects invalid suggestion page input %j without dispatch', async options => {
      await expect(getSuggestionPage(options)).rejects.toThrow(TypeError)
      expect(mockGetDataRequest).not.toHaveBeenCalled()
    },
  )

  it('reads a bounded proposal using the exact suggestion ID', async () => {
    const proposal = { id: 2147483647, proposal_status: 'available' }
    mockGetDataRequest.mockResolvedValueOnce(proposal)
    await expect(getSuggestionProposal('2147483647')).resolves.toBe(proposal)
    expect(mockGetDataRequest).toHaveBeenCalledExactlyOnceWith('/suggestions/2147483647/proposal')
  })

  it('checks the same bounded proposal once with a finite wait', async () => {
    const proposal = { id: 7, status: 'applied' }
    mockGetDataRequest.mockResolvedValueOnce(proposal)
    await expect(getSuggestionProposal(7, { reconcile: true })).resolves.toBe(proposal)
    expect(mockGetDataRequest).toHaveBeenCalledExactlyOnceWith('/suggestions/7/proposal', {
      skipAutomaticRetry: true, timeout: 10_000,
    })
  })

  it.each(['01', '3/4', 0, [3], 2147483648])('rejects invalid proposal ID %s before dispatch', async id => {
    await expect(getSuggestionProposal(id)).rejects.toThrow('Invalid suggestion ID')
    expect(mockGetDataRequest).not.toHaveBeenCalled()
  })

  it('reads one administrator evidence page and follows only an explicit continuation', async () => {
    const first = { suggestionId: 2147483647, nextAfterPosition: 20, items: [] }
    const last = { suggestionId: 2147483647, nextAfterPosition: null, items: [] }
    mockGetDataRequest.mockResolvedValueOnce(first).mockResolvedValueOnce(last)
    await expect(getSuggestionEvidence('2147483647')).resolves.toBe(first)
    expect(mockGetDataRequest).toHaveBeenCalledExactlyOnceWith('/suggestions/2147483647/evidence')
    await expect(getSuggestionEvidence(2147483647, first.nextAfterPosition)).resolves.toBe(last)
    expect(mockGetDataRequest).toHaveBeenNthCalledWith(2, '/suggestions/2147483647/evidence', {
      params: { afterPosition: '20' },
    })
  })

  it.each([null, 0, '01', '1e0', '4/5', [4], 5001])('rejects invalid evidence position %s before sending', async position => {
    await expect(getSuggestionEvidence(5, position)).rejects.toThrow('Invalid evidence continuation position')
    expect(mockGetDataRequest).not.toHaveBeenCalled()
  })

  it('rejects a noncanonical evidence suggestion ID before sending', async () => {
    await expect(getSuggestionEvidence('5/4')).rejects.toThrow('Invalid suggestion ID')
    expect(mockGetDataRequest).not.toHaveBeenCalled()
  })

  it('applySuggestion calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { applied: true } })
    const result = await applySuggestion(3)
    expect(mockPost).toHaveBeenCalledWith('/suggestions/3/apply', undefined, { skipAutomaticRetry: true, timeout: 60_000 })
    expect(result).toEqual({ data: { applied: true } })
  })

  it('accepts the largest database suggestion ID as exact decimal text', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await applySuggestion('2147483647')
    expect(mockPost).toHaveBeenCalledWith('/suggestions/2147483647/apply', undefined, { skipAutomaticRetry: true, timeout: 60_000 })
  })

  it.each(['03', '3x', '3\n', '2e0', '3/4', '2147483648', 2147483648, 0, -1, 1.5, null, [3]])(
    'rejects inexact or out-of-range IDs before sending a request (%s)', async id => {
      await expect(applySuggestion(id)).rejects.toThrow('Invalid suggestion ID')
      expect(mockPost).not.toHaveBeenCalled()
    },
  )

  it('rejectSuggestion calls POST with id in URL and reason', async () => {
    mockPost.mockResolvedValueOnce({ data: { rejected: true } })
    const result = await rejectSuggestion(7, 'Not applicable')
    expect(mockPost).toHaveBeenCalledWith('/suggestions/7/reject', { reason: 'Not applicable' }, { skipAutomaticRetry: true, timeout: 60_000 })
    expect(result).toEqual({ data: { rejected: true } })
  })

  it('rejects a suggestion at the maximum exact ID without changing the request body', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await rejectSuggestion('2147483647', 'Dismiss')
    expect(mockPost).toHaveBeenCalledWith('/suggestions/2147483647/reject', { reason: 'Dismiss' }, { skipAutomaticRetry: true, timeout: 60_000 })
  })

  it.each(['03', '3x', '3/4', '2147483648', 0, 1.5, null, [3]])(
    'refuses invalid rejection IDs before sending a request (%s)', async id => {
      await expect(rejectSuggestion(id, 'Dismiss')).rejects.toThrow('Invalid suggestion ID')
      expect(mockPost).not.toHaveBeenCalled()
    },
  )

  it.each([
    [applySuggestion, 'SUGGESTION_EVIDENCE_REQUIRED'],
    [applySuggestion, 'SUGGESTION_EVIDENCE_STALE'],
    [applySuggestion, 'SUGGESTION_EVIDENCE_BUSY'],
    [applySuggestion, 'SUGGESTION_NOT_PENDING'],
    [rejectSuggestion, 'SUGGESTION_NOT_PENDING'],
  ])('propagates review conflicts without retrying', async (review, code) => {
    const error = { response: { status: 409, data: { code } } }
    mockPost.mockRejectedValueOnce(error)
    await expect(review(3, 'Reason')).rejects.toBe(error)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })
})
