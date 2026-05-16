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
