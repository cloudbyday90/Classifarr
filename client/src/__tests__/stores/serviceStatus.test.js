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

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useServiceStatusStore } from '@/stores/serviceStatus'
import api from '@/api'

// Mock the API
vi.mock('@/api', () => ({
  default: {
    getSystemHealth: vi.fn()
  }
}))

describe('useServiceStatusStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initial state', () => {
    it('initializes with empty serviceHealth', () => {
      const store = useServiceStatusStore()
      expect(store.serviceHealth).toEqual({})
    })

    it('initializes with null lastFetch', () => {
      const store = useServiceStatusStore()
      expect(store.lastFetch).toBeNull()
    })

    it('initializes with isLoading false', () => {
      const store = useServiceStatusStore()
      expect(store.isLoading).toBe(false)
    })

    it('initializes with no error', () => {
      const store = useServiceStatusStore()
      expect(store.error).toBeNull()
    })
  })

  describe('fetchServiceStatus', () => {
    it('fetches and stores service status', async () => {
      const mockHealthData = {
        data: {
          database: 'connected',
          mediaServer: 'connected',
          radarr: 'not_configured',
          sonarr: 'not_configured',
          ollama: 'configured',
          tmdb: 'configured',
          omdb: 'not_configured',
          discordBot: 'not_configured',
          tavily: 'not_configured',
          queueWorker: 'healthy',
          details: {
            database: { error: null },
            mediaServer: { error: null }
          }
        }
      }

      api.getSystemHealth.mockResolvedValueOnce(mockHealthData)

      const store = useServiceStatusStore()
      await store.fetchServiceStatus()

      expect(store.serviceHealth.database.status).toBe('connected')
      expect(store.serviceHealth.mediaServer.status).toBe('connected')
      expect(store.serviceHealth.aiProvider.status).toBe('configured')
      expect(store.lastFetch).not.toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('sets loading state during fetch', async () => {
      let resolvePromise
      api.getSystemHealth.mockImplementation(() => new Promise((resolve) => {
        resolvePromise = resolve
      }))

      const store = useServiceStatusStore()
      const promise = store.fetchServiceStatus()

      expect(store.isLoading).toBe(true)

      // Cleanup - resolve the promise to avoid timeout
      resolvePromise({ data: { database: 'connected' } })
      await promise
    })

    it('handles errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Network error')
      api.getSystemHealth.mockRejectedValueOnce(error)

      const store = useServiceStatusStore()
      await store.fetchServiceStatus()

      expect(store.error).toBe('Network error')
      expect(store.isLoading).toBe(false)
      consoleSpy.mockRestore()
    })
  })

  describe('isServiceHealthy', () => {
    it('returns true for healthy service', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        mediaServer: { status: 'healthy' }
      }

      expect(store.isServiceHealthy('mediaServer')).toBe(true)
    })

    it('returns true for connected service', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        database: { status: 'connected' }
      }

      expect(store.isServiceHealthy('database')).toBe(true)
    })

    it('returns true for configured service', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        aiProvider: { status: 'configured' }
      }

      expect(store.isServiceHealthy('aiProvider')).toBe(true)
    })

    it('returns false for not_configured service', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        radarr: { status: 'not_configured' }
      }

      expect(store.isServiceHealthy('radarr')).toBe(false)
    })

    it('returns false for disconnected service', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        mediaServer: { status: 'disconnected' }
      }

      expect(store.isServiceHealthy('mediaServer')).toBe(false)
    })

    it('returns false for error status', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        tmdb: { status: 'error' }
      }

      expect(store.isServiceHealthy('tmdb')).toBe(false)
    })

    it('returns false for unhealthy service', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        queueWorker: { status: 'unhealthy' }
      }

      expect(store.isServiceHealthy('queueWorker')).toBe(false)
    })

    it('returns false for unknown service', () => {
      const store = useServiceStatusStore()
      expect(store.isServiceHealthy('unknownService')).toBe(false)
    })
  })

  describe('getServiceStatus', () => {
    it('returns correct status for service', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        mediaServer: { status: 'connected' }
      }

      expect(store.getServiceStatus('mediaServer')).toBe('connected')
    })

    it('returns unknown for missing service', () => {
      const store = useServiceStatusStore()
      expect(store.getServiceStatus('missingService')).toBe('unknown')
    })
  })

  describe('getServiceError', () => {
    it('returns error message when present', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        mediaServer: {
          status: 'error',
          details: { error: 'Connection failed' }
        }
      }

      expect(store.getServiceError('mediaServer')).toBe('Connection failed')
    })

    it('returns null when no error', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        mediaServer: {
          status: 'connected',
          details: { error: null }
        }
      }

      expect(store.getServiceError('mediaServer')).toBeNull()
    })

    it('returns null when service not found', () => {
      const store = useServiceStatusStore()
      expect(store.getServiceError('unknownService')).toBeNull()
    })
  })

  describe('Auto-refresh', () => {
    it('starts auto-refresh and fetches immediately', async () => {
      api.getSystemHealth.mockResolvedValue({
        data: {
          database: 'connected'
        }
      })

      const store = useServiceStatusStore()
      store.startAutoRefresh()

      await vi.advanceTimersByTimeAsync(0)

      expect(api.getSystemHealth).toHaveBeenCalled()
      
      store.stopAutoRefresh()
    })

    it('refreshes every 30 seconds', async () => {
      api.getSystemHealth.mockResolvedValue({
        data: {
          database: 'connected'
        }
      })

      const store = useServiceStatusStore()
      store.startAutoRefresh()

      await vi.advanceTimersByTimeAsync(0)
      const initialCallCount = api.getSystemHealth.mock.calls.length

      await vi.advanceTimersByTimeAsync(30000)

      expect(api.getSystemHealth.mock.calls.length).toBeGreaterThan(initialCallCount)
      
      store.stopAutoRefresh()
    })

    it('does not start multiple intervals', async () => {
      api.getSystemHealth.mockResolvedValue({
        data: {
          database: 'connected'
        }
      })

      const store = useServiceStatusStore()
      store.startAutoRefresh()
      store.startAutoRefresh()
      store.startAutoRefresh()

      await vi.advanceTimersByTimeAsync(0)

      // Should only call once initially
      expect(api.getSystemHealth.mock.calls.length).toBe(1)
      
      store.stopAutoRefresh()
    })

    it('stops auto-refresh correctly', async () => {
      api.getSystemHealth.mockResolvedValue({
        data: {
          database: 'connected'
        }
      })

      const store = useServiceStatusStore()
      store.startAutoRefresh()

      await vi.advanceTimersByTimeAsync(0)
      const callCountBeforeStop = api.getSystemHealth.mock.calls.length

      store.stopAutoRefresh()

      await vi.advanceTimersByTimeAsync(60000)

      expect(api.getSystemHealth.mock.calls.length).toBe(callCountBeforeStop)
    })
  })

  describe('isSystemHealthy', () => {
    it('returns true when database is healthy', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        database: { status: 'connected' }
      }

      expect(store.isSystemHealthy).toBe(true)
    })

    it('returns false when database is not healthy', () => {
      const store = useServiceStatusStore()
      store.serviceHealth = {
        database: { status: 'disconnected' }
      }

      expect(store.isSystemHealthy).toBe(false)
    })
  })
})
