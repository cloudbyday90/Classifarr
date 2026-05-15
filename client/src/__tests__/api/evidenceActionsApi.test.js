import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

import {
  decay,
  promote,
  purge,
} from '../../api/evidenceActionsApi'

describe('evidenceActionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('decay calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { decayed: true } })
    const result = await decay(7)
    expect(mockPost).toHaveBeenCalledWith('/evidence/7/decay')
    expect(result).toEqual({ data: { decayed: true } })
  })

  it('promote calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { promoted: true } })
    const result = await promote(12)
    expect(mockPost).toHaveBeenCalledWith('/evidence/12/promote')
    expect(result).toEqual({ data: { promoted: true } })
  })

  it('purge calls POST with filter body', async () => {
    const filter = { olderThan: '30d', status: 'decayed' }
    mockPost.mockResolvedValueOnce({ data: { purged: 15 } })
    const result = await purge(filter)
    expect(mockPost).toHaveBeenCalledWith('/evidence/purge', filter)
    expect(result).toEqual({ data: { purged: 15 } })
  })
})
