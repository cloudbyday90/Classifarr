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
  getSystemHealth,
  getSystemStatus,
  refreshSystemHealth,
  resetOmdbCircuitBreaker,
  browseFolders,
} from '../../api/systemHealthApi'

describe('systemHealthApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getSystemHealth calls getDataRequest with /system/health', async () => {
    const health = { status: 'ok' }
    mockGetDataRequest.mockResolvedValueOnce(health)
    const result = await getSystemHealth()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/system/health')
    expect(result).toEqual(health)
  })

  it('getSystemStatus calls getDataRequest with /system/status', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ uptime: 3600 })
    await getSystemStatus()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/system/status')
  })

  it('refreshSystemHealth calls POST with /system/health/refresh', async () => {
    mockPost.mockResolvedValueOnce({ data: { refreshed: true } })
    await refreshSystemHealth()
    expect(mockPost).toHaveBeenCalledWith('/system/health/refresh')
  })

  it('resetOmdbCircuitBreaker calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { reset: true } })
    await resetOmdbCircuitBreaker()
    expect(mockPost).toHaveBeenCalledWith('/settings/omdb/circuit-breaker/reset')
  })

  it('browseFolders encodes path in URL', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ folders: [] })
    await browseFolders('/media/tv shows')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/system/browse-folders?path=%2Fmedia%2Ftv%20shows')
  })
})
