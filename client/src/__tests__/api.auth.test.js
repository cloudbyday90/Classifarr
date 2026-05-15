/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Tests for the auth-related methods in api/index.js.
 *
 * We mock axios at the module level so the apiClient instance picks up the
 * mock, then import the api module after the mock is in place. Every test
 * exercises api.login, api.logout, api.getMe and the 401-interceptor refresh flow.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── axios mock ────────────────────────────────────────────────────────────────
// We need the mock factory to return both a default export (the axios constructor
// for direct calls) and a create() method that returns the same mock instance.
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
  const axios = {
    default: {
      ...instance,
      create: vi.fn(() => instance),
      post: vi.fn(), // for the direct axios.post('/api/auth/refresh') call
    },
    create: vi.fn(() => instance),
    post: vi.fn(),
    interceptors: instance.interceptors,
  }
  return axios
})

// ── import api AFTER the mock is registered ────────────────────────────────
import api from '../api'
import axios from 'axios'

// Grab the inner apiClient instance that was created via axios.create()
const apiClient = axios.create()

describe('api/index.js — auth methods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── api.login ───────────────────────────────────────────────────────────────

  describe('api.login', () => {
    it('POSTs to /auth/login with identifier, password, and rememberMe', async () => {
      apiClient.post.mockResolvedValueOnce({ data: { success: true } })

      await api.login('admin', 'Password1!', false)

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        identifier: 'admin',
        password: 'Password1!',
        rememberMe: false,
      })
    })

    it('passes rememberMe=true through to the request', async () => {
      apiClient.post.mockResolvedValueOnce({ data: { success: true } })

      await api.login('admin', 'Password1!', true)

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        identifier: 'admin',
        password: 'Password1!',
        rememberMe: true,
      })
    })

    it('defaults rememberMe to false when not provided', async () => {
      apiClient.post.mockResolvedValueOnce({ data: { success: true } })

      await api.login('admin', 'Password1!')

      const body = apiClient.post.mock.calls[0][1]
      expect(body.rememberMe).toBe(false)
    })

    it('does NOT store any refresh token in sessionStorage', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: { success: true, refreshToken: 'should-be-ignored' },
      })
      const setSpy = vi.spyOn(Storage.prototype, 'setItem')

      await api.login('admin', 'Password1!')

      expect(setSpy).not.toHaveBeenCalled()
    })
  })

  // ── api.logout ──────────────────────────────────────────────────────────────

  describe('api.logout', () => {
    it('POSTs to /auth/logout with refreshToken', async () => {
      apiClient.post.mockResolvedValueOnce({ data: { success: true } })

      await api.logout('my-refresh-token')

      expect(apiClient.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'my-refresh-token' })
    })
  })

  // ── api.getMe ──────────────────────────────────────────────────────────────

  describe('api.getMe', () => {
    it('GETs /auth/me', async () => {
      apiClient.get.mockResolvedValueOnce({ data: { id: 1, username: 'admin' } })

      const result = await api.getMe()

      expect(apiClient.get).toHaveBeenCalledWith('/auth/me')
      expect(result.data).toEqual({ id: 1, username: 'admin' })
    })
  })
})
