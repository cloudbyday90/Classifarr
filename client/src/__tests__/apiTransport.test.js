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
 * Tests for the apiTransport interceptors — CSRF injection, retry with
 * exponential backoff, and 401 token-refresh-with-replay.
 *
 * We mock axios at the module level so apiTransport's apiClient picks up the
 * mock. The mock instance is callable (vi.fn) so `apiClient(config)` works
 * for retry/replay paths. A lightweight MockHeaders shim satisfies the
 * `axios.AxiosHeaders.from(...)` call in the CSRF interceptor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/csrf.js', () => ({
  getCsrfToken: vi.fn(() => null),
  getCookieValue: vi.fn(() => null),
  CSRF_COOKIE_NAME: 'classifarr_csrf_token',
}))

vi.mock('axios', () => {
  class MockHeaders {
    constructor(init = {}) { Object.assign(this, init) }
    static from(h) { return h instanceof MockHeaders ? h : new MockHeaders(h) }
    set(k, v) { this[k] = v }
  }

  const instance = vi.fn(() => Promise.resolve({ data: {} }))
  instance.post = vi.fn(() => Promise.resolve({ data: {} }))
  instance.get = vi.fn(() => Promise.resolve({ data: {} }))
  instance.put = vi.fn(() => Promise.resolve({ data: {} }))
  instance.patch = vi.fn(() => Promise.resolve({ data: {} }))
  instance.delete = vi.fn(() => Promise.resolve({ data: {} }))
  instance.interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  }

  return {
    default: {
      ...instance,
      create: vi.fn(() => instance),
      post: vi.fn(() => Promise.resolve({ data: {} })),
      AxiosHeaders: MockHeaders,
    },
    create: vi.fn(() => instance),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    AxiosHeaders: MockHeaders,
    interceptors: instance.interceptors,
  }
})

import axios from 'axios'
import { getCsrfToken } from '../utils/csrf.js'
import {
  apiClient,
  resetNavigationHandler,
  setNavigationHandler,
} from '../api/apiTransport'

const onRequest = apiClient.interceptors.request.use.mock.calls[0][0]
const onRequestError = apiClient.interceptors.request.use.mock.calls[0][1]
const onResponseError = apiClient.interceptors.response.use.mock.calls[0][1]

describe('apiTransport interceptors', () => {
  let navigationSpy

  beforeEach(() => {
    vi.clearAllMocks()
    getCsrfToken.mockReturnValue(null)
    navigationSpy = vi.fn()
    setNavigationHandler(navigationSpy)
  })

  afterEach(() => {
    resetNavigationHandler()
    vi.useRealTimers()
  })

  it('adds X-CSRF-Token to POST requests when token is available', () => {
    getCsrfToken.mockReturnValue('tok-abc')
    const config = { method: 'post', headers: {} }

    const result = onRequest(config)

    expect(result.headers['X-CSRF-Token']).toBe('tok-abc')
  })

  it('adds X-CSRF-Token to PUT, PATCH, and DELETE requests', () => {
    getCsrfToken.mockReturnValue('tok-xyz')

    for (const method of ['put', 'patch', 'delete']) {
      const config = { method, headers: {} }
      const result = onRequest(config)
      expect(result.headers['X-CSRF-Token']).toBe('tok-xyz')
    }
  })

  it('does not add CSRF token to GET requests', () => {
    getCsrfToken.mockReturnValue('tok-abc')
    const result = onRequest({ method: 'get', headers: {} })

    expect(result.headers['X-CSRF-Token']).toBeUndefined()
  })

  it('does not add CSRF header when no token is available', () => {
    const result = onRequest({ method: 'post', headers: {} })

    expect(result.headers['X-CSRF-Token']).toBeUndefined()
  })

  it('passes through request errors unchanged', async () => {
    const error = new Error('network failure')

    await expect(onRequestError(error)).rejects.toThrow('network failure')
  })

  it('retries on 429 status with exponential backoff', async () => {
    vi.useFakeTimers()
    apiClient.mockResolvedValueOnce({ data: { ok: true } })

    const config = { _retryCount: 0 }
    const promise = onResponseError({ config, response: { status: 429 } })

    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(config._retryCount).toBe(1)
    expect(apiClient).toHaveBeenCalledWith(config)
    expect(result).toEqual({ data: { ok: true } })
  })

  it('retries on network errors when no response is present', async () => {
    vi.useFakeTimers()
    apiClient.mockResolvedValueOnce({ data: { ok: true } })

    const config = { _retryCount: 0 }
    const promise = onResponseError({ config })

    await vi.advanceTimersByTimeAsync(1000)
    await promise

    expect(apiClient).toHaveBeenCalledWith(config)
    expect(config._retryCount).toBe(1)
  })

  it('rejects immediately on non-retryable status codes', async () => {
    const error = { config: {}, response: { status: 400 } }

    await expect(onResponseError(error)).rejects.toBe(error)
    expect(apiClient).not.toHaveBeenCalled()
  })

  it('refreshes token and replays request on 401', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true } })
    apiClient.mockResolvedValueOnce({ data: { replayed: true } })

    const config = {}
    const error = { config, response: { status: 401 } }
    const result = await onResponseError(error)

    expect(axios.post).toHaveBeenCalledWith('/api/auth/refresh', {}, expect.objectContaining({
      withCredentials: true,
    }))
    expect(config._retry).toBe(true)
    expect(apiClient).toHaveBeenCalledWith(config)
    expect(result).toEqual({ data: { replayed: true } })
  })

  it('does not refresh or redirect when a 401 request suppresses auth redirects', async () => {
    const config = { skipAuthRedirect: true }
    const error = { config, response: { status: 401 } }

    await expect(onResponseError(error)).rejects.toBe(error)

    expect(axios.post).not.toHaveBeenCalled()
    expect(apiClient).not.toHaveBeenCalled()
    expect(navigationSpy).not.toHaveBeenCalled()
  })

  it('rejects with original error when 401 refresh fails', async () => {
    axios.post.mockRejectedValueOnce(new Error('refresh expired'))

    const config = {}
    const error = { config, response: { status: 401 } }

    await expect(onResponseError(error)).rejects.toBe(error)
    expect(config._retry).toBe(true)
    expect(navigationSpy).toHaveBeenCalledWith('/login?expired=true')
  })
})
