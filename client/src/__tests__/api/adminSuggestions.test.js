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
  getSuggestion,
  applySuggestion,
  rejectSuggestion,
} from '../../api/adminSuggestions'

describe('adminSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('applySuggestion calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { applied: true } })
    const result = await applySuggestion(3)
    expect(mockPost).toHaveBeenCalledWith('/suggestions/3/apply')
    expect(result).toEqual({ data: { applied: true } })
  })

  it('rejectSuggestion calls POST with id in URL and reason', async () => {
    mockPost.mockResolvedValueOnce({ data: { rejected: true } })
    const result = await rejectSuggestion(7, 'Not applicable')
    expect(mockPost).toHaveBeenCalledWith('/suggestions/7/reject', { reason: 'Not applicable' })
    expect(result).toEqual({ data: { rejected: true } })
  })
})
