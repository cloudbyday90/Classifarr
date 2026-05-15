import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}))

import {
  getPolicy,
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getPresetSuggestions,
} from '../../api/policiesApi'

describe('policiesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPolicy calls getDataRequest with id', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ id: 1, name: 'Test' })
    await getPolicy(1)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/1')
  })

  it('getPolicies calls getDataRequest with /policies', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getPolicies()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies')
  })

  it('createPolicy calls POST with data', async () => {
    const data = { name: 'New Policy', library_id: 1 }
    mockPost.mockResolvedValueOnce({ data: { id: 2 } })
    await createPolicy(data)
    expect(mockPost).toHaveBeenCalledWith('/policies', data)
  })

  it('updatePolicy calls PUT with id and data', async () => {
    const data = { name: 'Updated' }
    mockPut.mockResolvedValueOnce({ data: {} })
    await updatePolicy(5, data)
    expect(mockPut).toHaveBeenCalledWith('/policies/5', data)
  })

  it('deletePolicy calls DELETE with id', async () => {
    mockDelete.mockResolvedValueOnce({ data: {} })
    await deletePolicy(3)
    expect(mockDelete).toHaveBeenCalledWith('/policies/3')
  })

  it('getPresetSuggestions calls getDataRequest with library id', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ suggestions: [] })
    await getPresetSuggestions(7)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/presets/suggest/7')
  })
})
