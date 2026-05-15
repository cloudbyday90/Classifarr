import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

vi.mock('../../api/mediaServerAuthFactory', () => ({
  createMediaServerAuthApi: (prefix) => ({
    testConnection: (url) => mockPost(`/${prefix}/test`, { serverUrl: url }),
    authenticate: (url, user, pass) => mockPost(`/${prefix}/authenticate`, { serverUrl: url, username: user, password: pass }),
    saveServer: (url, token, name) => mockPost(`/${prefix}/save`, { serverUrl: url, token, serverName: name }),
  }),
}))

import {
  testEmbyConnection,
  authenticateEmby,
  saveEmbyServer,
} from '../../api/embyApi'

describe('embyApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('testEmbyConnection delegates to factory', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await testEmbyConnection('http://emby.local')
    expect(mockPost).toHaveBeenCalledWith('/emby/test', { serverUrl: 'http://emby.local' })
  })

  it('authenticateEmby delegates to factory', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: 't' } })
    await authenticateEmby('http://emby.local', 'admin', 'pass')
    expect(mockPost).toHaveBeenCalledWith('/emby/authenticate', { serverUrl: 'http://emby.local', username: 'admin', password: 'pass' })
  })

  it('saveEmbyServer delegates to factory', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    await saveEmbyServer('http://emby.local', 'tok', 'My Emby')
    expect(mockPost).toHaveBeenCalledWith('/emby/save', { serverUrl: 'http://emby.local', token: 'tok', serverName: 'My Emby' })
  })
})
