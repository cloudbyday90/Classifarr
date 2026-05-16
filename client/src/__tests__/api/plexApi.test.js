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
  createPlexPin,
  checkPlexPin,
  getPlexServers,
  getPlexUser,
  testPlexConnection,
  savePlexServer,
} from '../../api/plexApi'

describe('plexApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createPlexPin calls apiClient.post with /plex/pin', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'pin-123' } })
    const result = await createPlexPin()
    expect(mockPost).toHaveBeenCalledWith('/plex/pin')
    expect(result).toEqual({ data: { id: 'pin-123' } })
  })

  it('checkPlexPin calls getDataRequest with pin id in URL', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ authenticated: true, authToken: 'tok' })
    const result = await checkPlexPin('pin-456')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/plex/pin/pin-456')
    expect(result).toEqual({ authenticated: true, authToken: 'tok' })
  })

  it('getPlexServers calls apiClient.post with authToken in body', async () => {
    mockPost.mockResolvedValueOnce({ data: [{ name: 'Server1' }] })
    const result = await getPlexServers('auth-token-abc')
    expect(mockPost).toHaveBeenCalledWith('/plex/servers', { authToken: 'auth-token-abc' })
    expect(result).toEqual({ data: [{ name: 'Server1' }] })
  })

  it('getPlexUser calls apiClient.post with authToken in body', async () => {
    mockPost.mockResolvedValueOnce({ data: { username: 'user1' } })
    const result = await getPlexUser('auth-token-abc')
    expect(mockPost).toHaveBeenCalledWith('/plex/user', { authToken: 'auth-token-abc' })
    expect(result).toEqual({ data: { username: 'user1' } })
  })

  it('testPlexConnection calls apiClient.post with url and token', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    const result = await testPlexConnection('http://plex:32400', 'my-token')
    expect(mockPost).toHaveBeenCalledWith('/plex/test-connection', { url: 'http://plex:32400', token: 'my-token' })
    expect(result).toEqual({ data: { success: true } })
  })

  it('savePlexServer calls apiClient.post with all fields', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'srv-1' } })
    const result = await savePlexServer('MyPlex', 'http://plex:32400', 'tok', 'cid-001')
    expect(mockPost).toHaveBeenCalledWith('/plex/save-server', {
      name: 'MyPlex',
      url: 'http://plex:32400',
      token: 'tok',
      clientIdentifier: 'cid-001',
    })
    expect(result).toEqual({ data: { id: 'srv-1' } })
  })
})
