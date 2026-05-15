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
 * Tests for apiRequestHelpers (unwrap, getDataRequest, getSettingsRequest,
 * updateSettingsRequest) and the uncovered delegation methods on the default
 * api export in index.js.
 *
 * Uses the same axios mock factory as api.auth.test.js and api.domains.test.js.
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
import {
  getDataRequest,
  getSettingsRequest,
  unwrapResponseData,
  updateSettingsRequest,
} from '../api/core'

const apiClient = axios.create()

describe('apiRequestHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('unwrapResponseData returns response.data when present', () => {
    expect(unwrapResponseData({ data: { id: 7 } })).toEqual({ id: 7 })
  })

  it('unwrapResponseData handles null/undefined gracefully', () => {
    expect(unwrapResponseData(null)).toBeUndefined()
    expect(unwrapResponseData(undefined)).toBeUndefined()
  })

  it('getDataRequest unwraps the response payload', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { items: [1, 2] } })

    const result = await getDataRequest('/widgets', { params: { limit: 10 } })

    expect(result).toEqual({ items: [1, 2] })
    expect(apiClient.get).toHaveBeenCalledWith('/widgets', { params: { limit: 10 } })
  })

  it('getSettingsRequest routes to category endpoint when category provided', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { ai: true } })

    const result = await getSettingsRequest('ai')

    expect(apiClient.get).toHaveBeenCalledWith('/settings/category/ai')
    expect(result).toEqual({ data: { ai: true } })
  })

  it('getSettingsRequest falls back to root settings when no category', async () => {
    apiClient.get.mockResolvedValueOnce({ data: {} })

    await getSettingsRequest()

    expect(apiClient.get).toHaveBeenCalledWith('/settings')
  })

  it('updateSettingsRequest routes to category when both args provided', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { ok: true } })

    const result = await updateSettingsRequest('ai', { model: 'gpt-4' })

    expect(apiClient.put).toHaveBeenCalledWith('/settings/category/ai', { model: 'gpt-4' })
    expect(result).toEqual({ data: { ok: true } })
  })

  it('updateSettingsRequest sends to root when only settings provided', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { ok: true } })

    await updateSettingsRequest({ theme: 'dark' })

    expect(apiClient.put).toHaveBeenCalledWith('/settings', { theme: 'dark' })
  })

  it('api.getMe delegates to apiClient.get /auth/me', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { id: 1, username: 'admin' } })

    const result = await api.getMe()

    expect(apiClient.get).toHaveBeenCalledWith('/auth/me')
    expect(result).toEqual({ data: { id: 1, username: 'admin' } })
  })
})
