import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    delete: (...args) => mockDelete(...args),
  },
}))

import {
  getPathMappings,
  createPathMapping,
  deletePathMapping,
  verifyPathMapping,
  verifyAllPathMappings,
  getPathTestHealth,
  testPath,
} from '../../api/settingsPathMappingApi'

describe('settingsPathMappingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPathMappings calls getDataRequest with correct URL', async () => {
    const mappings = [{ id: 1, arr_path: '/tv', local_path: '/media/tv' }]
    mockGetDataRequest.mockResolvedValueOnce(mappings)
    const result = await getPathMappings()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/path-mappings')
    expect(result).toEqual(mappings)
  })

  it('createPathMapping calls POST with data', async () => {
    const data = { arr_path: '/movies', local_path: '/media/movies' }
    mockPost.mockResolvedValueOnce({ data: { id: 2 } })
    await createPathMapping(data)
    expect(mockPost).toHaveBeenCalledWith('/settings/path-mappings', data)
  })

  it('deletePathMapping calls DELETE with mapping id', async () => {
    mockDelete.mockResolvedValueOnce({ data: {} })
    await deletePathMapping(5)
    expect(mockDelete).toHaveBeenCalledWith('/settings/path-mappings/5')
  })

  it('verifyPathMapping calls POST with mapping id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { verified: true } })
    await verifyPathMapping(3)
    expect(mockPost).toHaveBeenCalledWith('/settings/path-mappings/3/verify')
  })

  it('verifyAllPathMappings calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { summary: { verified: 5, failed: 0 } } })
    await verifyAllPathMappings()
    expect(mockPost).toHaveBeenCalledWith('/settings/path-mappings/verify-all')
  })

  it('getPathTestHealth calls getDataRequest with correct URL', async () => {
    const health = { healthy: true }
    mockGetDataRequest.mockResolvedValueOnce(health)
    const result = await getPathTestHealth()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/path-test/health')
    expect(result).toEqual(health)
  })

  it('testPath calls POST with path in body', async () => {
    mockPost.mockResolvedValueOnce({ data: { accessible: true } })
    await testPath('/media/tv')
    expect(mockPost).toHaveBeenCalledWith('/settings/path-test', { path: '/media/tv' })
  })
})
