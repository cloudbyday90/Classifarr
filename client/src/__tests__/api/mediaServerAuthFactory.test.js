import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

import { createMediaServerAuthApi } from '../../api/mediaServerAuthFactory'

describe('mediaServerAuthFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('testConnection calls POST with prefix/test', async () => {
    const api = createMediaServerAuthApi('jellyfin')
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await api.testConnection('http://jellyfin.local')
    expect(mockPost).toHaveBeenCalledWith('/jellyfin/test', { serverUrl: 'http://jellyfin.local' })
  })

  it('authenticate calls POST with prefix/authenticate', async () => {
    const api = createMediaServerAuthApi('emby')
    mockPost.mockResolvedValueOnce({ data: { token: 'abc' } })
    await api.authenticate('http://emby.local', 'admin', 'pass')
    expect(mockPost).toHaveBeenCalledWith('/emby/authenticate', {
      serverUrl: 'http://emby.local',
      username: 'admin',
      password: 'pass',
    })
  })

  it('saveServer calls POST with prefix/save', async () => {
    const api = createMediaServerAuthApi('plex')
    mockPost.mockResolvedValueOnce({ data: {} })
    await api.saveServer('http://plex.local', 'token123', 'My Server')
    expect(mockPost).toHaveBeenCalledWith('/plex/save', {
      serverUrl: 'http://plex.local',
      token: 'token123',
      serverName: 'My Server',
    })
  })
})
