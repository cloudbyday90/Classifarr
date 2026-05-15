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
  testJellyfinConnection,
  authenticateJellyfin,
  saveJellyfinServer,
  isJellyfinQuickConnectEnabled,
  initiateJellyfinQuickConnect,
  checkJellyfinQuickConnect,
  authenticateJellyfinQuickConnect,
} from '../../api/jellyfinApi'

describe('jellyfinApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('testJellyfinConnection delegates to factory', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await testJellyfinConnection('http://jf.local')
    expect(mockPost).toHaveBeenCalledWith('/jellyfin/test', { serverUrl: 'http://jf.local' })
  })

  it('authenticateJellyfin delegates to factory', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: 't' } })
    await authenticateJellyfin('http://jf.local', 'admin', 'pass')
    expect(mockPost).toHaveBeenCalledWith('/jellyfin/authenticate', { serverUrl: 'http://jf.local', username: 'admin', password: 'pass' })
  })

  it('saveJellyfinServer delegates to factory', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    await saveJellyfinServer('http://jf.local', 'tok', 'My JF')
    expect(mockPost).toHaveBeenCalledWith('/jellyfin/save', { serverUrl: 'http://jf.local', token: 'tok', serverName: 'My JF' })
  })

  it('isJellyfinQuickConnectEnabled calls POST with serverUrl', async () => {
    mockPost.mockResolvedValueOnce({ data: { enabled: true } })
    await isJellyfinQuickConnectEnabled('http://jf.local')
    expect(mockPost).toHaveBeenCalledWith('/jellyfin/quick-connect/enabled', { serverUrl: 'http://jf.local' })
  })

  it('initiateJellyfinQuickConnect calls POST with serverUrl', async () => {
    mockPost.mockResolvedValueOnce({ data: { secret: 'abc' } })
    await initiateJellyfinQuickConnect('http://jf.local')
    expect(mockPost).toHaveBeenCalledWith('/jellyfin/quick-connect/initiate', { serverUrl: 'http://jf.local' })
  })

  it('checkJellyfinQuickConnect calls POST with serverUrl and secret', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    await checkJellyfinQuickConnect('http://jf.local', 'secret123')
    expect(mockPost).toHaveBeenCalledWith('/jellyfin/quick-connect/check', { serverUrl: 'http://jf.local', secret: 'secret123' })
  })

  it('authenticateJellyfinQuickConnect calls POST with serverUrl and secret', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: 't' } })
    await authenticateJellyfinQuickConnect('http://jf.local', 'secret123')
    expect(mockPost).toHaveBeenCalledWith('/jellyfin/quick-connect/authenticate', { serverUrl: 'http://jf.local', secret: 'secret123' })
  })
})
