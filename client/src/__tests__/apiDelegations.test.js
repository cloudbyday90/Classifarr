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

/**
 * Tests for the convenience methods on the default api export (index.js)
 * — login, getMe, logout, createAdmin.
 *
 * These thin wrappers forward to apiClient.
 * Testing them ensures the public API surface works and picks up
 * regressions if the delegation layer changes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('axios', () => {
  const instance = {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }

  return {
    default: {
      ...instance,
      create: vi.fn(() => instance),
      post: vi.fn(),
    },
    create: vi.fn(() => instance),
    post: vi.fn(),
    interceptors: instance.interceptors,
  }
})

import axios from 'axios'
import api from '../api'

const apiClient = axios.create()

describe('api/index.js convenience methods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('login forwards to apiClient.post with correct arguments', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { token: 'abc' } })

    await api.login('admin', 'pass', true)

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      identifier: 'admin',
      password: 'pass',
      rememberMe: true,
    })
  })

  it('getMe forwards to apiClient.get', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { username: 'admin' } })

    await api.getMe()

    expect(apiClient.get).toHaveBeenCalledWith('/auth/me')
  })

  it('logout forwards to apiClient.post with refreshToken', async () => {
    apiClient.post.mockResolvedValueOnce({ data: {} })

    await api.logout('refresh-token-123')

    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-token-123' })
  })

  it('createAdmin forwards to apiClient.post with data', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { success: true } })

    await api.createAdmin({ username: 'admin', password: 'pass', confirmPassword: 'pass' })

    expect(apiClient.post).toHaveBeenCalledWith('/setup/create-admin', {
      username: 'admin',
      password: 'pass',
      confirmPassword: 'pass',
    })
  })
})
