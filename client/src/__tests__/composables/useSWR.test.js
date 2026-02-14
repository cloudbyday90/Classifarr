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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { useSWR } from '../../composables/useSWR'
import {
  setupLocalStorageMock,
  cleanupLocalStorageMock,
  setSWRCache,
  getSWRCache,
  clearSWRCache,
  setSWRCacheExpired,
  createMockFetcher,
  createFailingFetcher
} from '../helpers/swrTestUtils'

// Mock @vueuse/core
vi.mock('@vueuse/core', async () => {
  const vue = await import('vue')
  return {
    useOnline: () => vue.ref(true)
  }
})

/**
 * Helper to create a test component that uses useSWR
 */
const createTestComponent = (cacheKey, fetcher, options = {}) => {
  return defineComponent({
    setup() {
      const swr = useSWR(cacheKey, fetcher, options)
      return { ...swr }
    },
    template: '<div>{{ JSON.stringify(data) }}</div>'
  })
}

describe('useSWR composable', () => {
  let mockStorage

  beforeEach(() => {
    mockStorage = setupLocalStorageMock()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanupLocalStorageMock()
    vi.clearAllMocks()
  })

  // ============================================
  // Initial Load Behavior
  // ============================================
  describe('Initial Load Behavior', () => {
    it('returns isLoading=true initially when no cache exists', async () => {
      const fetcher = createMockFetcher({ value: 'fresh' })
      const TestComponent = createTestComponent('test:no-cache', fetcher)

      const wrapper = mount(TestComponent)

      expect(wrapper.vm.isLoading).toBe(true)
      expect(wrapper.vm.isStale).toBe(false)
      expect(wrapper.vm.data).toBe(null)

      await flushPromises()

      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.data).toEqual({ value: 'fresh' })
    })

    it('hydrates from cache immediately when cache exists', async () => {
      // Pre-populate cache
      const cachedData = { value: 'cached' }
      setSWRCache('test:cached', cachedData)

      const fetcher = createMockFetcher({ value: 'fresh' })
      const TestComponent = createTestComponent('test:cached', fetcher)

      const wrapper = mount(TestComponent)

      // Immediately has cached data
      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.isStale).toBe(true) // Stale because fetching fresh
      expect(wrapper.vm.data).toEqual(cachedData)

      await flushPromises()

      // Updated with fresh data
      expect(wrapper.vm.isStale).toBe(false)
      expect(wrapper.vm.data).toEqual({ value: 'fresh' })
    })

    it('ignores expired cache (beyond TTL)', async () => {
      // Cache from 2 minutes ago (beyond default 60s TTL)
      const cachedData = { value: 'old-cached' }
      setSWRCacheExpired('test:expired', cachedData, 120000)

      const fetcher = createMockFetcher({ value: 'fresh' })
      const TestComponent = createTestComponent('test:expired', fetcher, { ttl: 60000 })

      const wrapper = mount(TestComponent)

      // Should NOT hydrate from expired cache
      expect(wrapper.vm.isLoading).toBe(true)
      expect(wrapper.vm.data).toBe(null)

      await flushPromises()

      expect(wrapper.vm.data).toEqual({ value: 'fresh' })
    })

    it('uses initialData when provided and no cache', async () => {
      let resolvePromise
      const fetcher = vi.fn().mockImplementation(
        () => new Promise(resolve => { resolvePromise = resolve })
      )

      const TestComponent = createTestComponent('test:initial', fetcher, {
        initialData: { value: 'placeholder' }
      })

      const wrapper = mount(TestComponent)
      await nextTick()

      expect(wrapper.vm.data).toEqual({ value: 'placeholder' })

      resolvePromise({ value: 'fetched' })
      await flushPromises()

      expect(wrapper.vm.data).toEqual({ value: 'fetched' })
    })
  })

  // ============================================
  // Cache Storage
  // ============================================
  describe('Cache Storage', () => {
    it('saves data to localStorage after successful fetch', async () => {
      const fetcher = createMockFetcher({ value: 'fresh' })
      const TestComponent = createTestComponent('test:save', fetcher)

      mount(TestComponent)
      await flushPromises()

      expect(localStorage.setItem).toHaveBeenCalled()
      const savedData = getSWRCache('test:save')
      expect(savedData.value).toEqual({ value: 'fresh' })
      expect(savedData.timestamp).toBeDefined()
    })

    it('handles localStorage quota exceeded error gracefully', async () => {
      localStorage.setItem.mockImplementation(() => {
        const error = new Error('QuotaExceededError')
        error.name = 'QuotaExceededError'
        throw error
      })

      const fetcher = createMockFetcher({ value: 'data' })
      const TestComponent = createTestComponent('test:quota', fetcher)

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const wrapper = mount(TestComponent)
      await flushPromises()

      // Should still return data even if cache write fails
      expect(wrapper.vm.data).toEqual({ value: 'data' })
      expect(consoleWarn).toHaveBeenCalled()

      consoleWarn.mockRestore()
    })

    it('updates cacheTimestamp when saving to cache', async () => {
      const fetcher = createMockFetcher({ value: 'data' })
      const TestComponent = createTestComponent('test:timestamp', fetcher)

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(wrapper.vm.cacheTimestamp).toBeDefined()
      expect(typeof wrapper.vm.cacheTimestamp).toBe('number')
    })
  })

  // ============================================
  // Error Handling
  // ============================================
  describe('Error Handling', () => {
    it('sets error state when fetcher fails', async () => {
      const fetcher = createFailingFetcher('Network error')
      const TestComponent = createTestComponent('test:error', fetcher, { autoRetry: false })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(wrapper.vm.error).toBeTruthy()
      expect(wrapper.vm.error.message).toBe('Network error')
      expect(wrapper.vm.isLoading).toBe(false)

      consoleError.mockRestore()
    })

    it('keeps cached data when revalidation fails', async () => {
      // Pre-populate cache
      const cachedData = { value: 'cached' }
      setSWRCache('test:keep', cachedData)

      const fetcher = createFailingFetcher('Failed')
      const TestComponent = createTestComponent('test:keep', fetcher, { autoRetry: false })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mount(TestComponent)
      await flushPromises()

      // Should keep cached data even when fetch fails
      expect(wrapper.vm.data).toEqual(cachedData)
      expect(wrapper.vm.error).toBeTruthy()
      expect(wrapper.vm.error.message).toBe('Failed')

      consoleError.mockRestore()
    })

    it('marks network errors as retryable', async () => {
      const fetcher = createFailingFetcher('Network error') // No status code
      const TestComponent = createTestComponent('test:retryable', fetcher, { autoRetry: false })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(wrapper.vm.error.retryable).toBe(true)

      consoleError.mockRestore()
    })

    it('marks 5xx errors as retryable', async () => {
      const fetcher = createFailingFetcher('Server error', 500)
      const TestComponent = createTestComponent('test:5xx', fetcher, { autoRetry: false })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(wrapper.vm.error.retryable).toBe(true)

      consoleError.mockRestore()
    })

    it('marks 4xx errors (except 429) as non-retryable', async () => {
      const fetcher = createFailingFetcher('Not found', 404)
      const TestComponent = createTestComponent('test:4xx', fetcher, { autoRetry: false })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(wrapper.vm.error.retryable).toBe(false)

      consoleError.mockRestore()
    })

    it('marks 429 (rate limit) as retryable', async () => {
      const fetcher = createFailingFetcher('Rate limited', 429)
      const TestComponent = createTestComponent('test:429', fetcher, { autoRetry: false })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(wrapper.vm.error.retryable).toBe(true)

      consoleError.mockRestore()
    })
  })

  // ============================================
  // Auto-Retry
  // ============================================
  describe('Auto-Retry', () => {
    it('auto-retries on retryable error with backoff', async () => {
      const fetcher = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ value: 'success' })

      const TestComponent = createTestComponent('test:retry', fetcher, { autoRetry: true })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(wrapper.vm.retryCount).toBe(1)

      // Fast-forward 1s (first retry)
      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()
      expect(fetcher).toHaveBeenCalledTimes(2)

      // Fast-forward 3s (second retry)
      await vi.advanceTimersByTimeAsync(3000)
      await flushPromises()
      expect(fetcher).toHaveBeenCalledTimes(3)

      expect(wrapper.vm.data).toEqual({ value: 'success' })
      expect(wrapper.vm.error).toBeNull()
      expect(wrapper.vm.retryCount).toBe(0)

      consoleError.mockRestore()
    })

    it('stops retrying after MAX_RETRIES', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('Always fails'))
      const TestComponent = createTestComponent('test:max-retry', fetcher, { autoRetry: true })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      mount(TestComponent)
      await flushPromises()

      // Initial + 3 retries
      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()
      await vi.advanceTimersByTimeAsync(3000)
      await flushPromises()
      await vi.advanceTimersByTimeAsync(10000)
      await flushPromises()

      // Should stop at 4 calls (1 initial + 3 retries)
      expect(fetcher).toHaveBeenCalledTimes(4)

      // Wait more time - no more retries
      await vi.advanceTimersByTimeAsync(30000)
      await flushPromises()
      expect(fetcher).toHaveBeenCalledTimes(4)

      consoleError.mockRestore()
    })

    it('does not retry when autoRetry is false', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('Error'))
      const TestComponent = createTestComponent('test:no-auto', fetcher, { autoRetry: false })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      mount(TestComponent)
      await flushPromises()

      await vi.advanceTimersByTimeAsync(10000)
      await flushPromises()

      expect(fetcher).toHaveBeenCalledTimes(1)

      consoleError.mockRestore()
    })
  })

  // ============================================
  // Refresh Function
  // ============================================
  describe('Refresh Function', () => {
    it('refresh() triggers revalidation', async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ value: 'first' })
        .mockResolvedValueOnce({ value: 'second' })

      const TestComponent = createTestComponent('test:refresh', fetcher)

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(wrapper.vm.data).toEqual({ value: 'first' })
      expect(fetcher).toHaveBeenCalledTimes(1)

      // Trigger refresh
      wrapper.vm.refresh()
      await flushPromises()

      expect(wrapper.vm.data).toEqual({ value: 'second' })
      expect(fetcher).toHaveBeenCalledTimes(2)
    })

    it('refresh() sets isStale=true during revalidation', async () => {
      let resolvePromise
      const fetcher = vi.fn().mockImplementation(
        () => new Promise(resolve => { resolvePromise = resolve })
      )

      const TestComponent = createTestComponent('test:stale', fetcher)

      const wrapper = mount(TestComponent)

      // Resolve first fetch
      resolvePromise({ value: 'initial' })
      await flushPromises()

      expect(wrapper.vm.isStale).toBe(false)

      // Start refresh (new promise)
      fetcher.mockImplementation(
        () => new Promise(resolve => { resolvePromise = resolve })
      )
      wrapper.vm.refresh()
      await nextTick()

      expect(wrapper.vm.isStale).toBe(true)

      // Resolve refresh
      resolvePromise({ value: 'refreshed' })
      await flushPromises()

      expect(wrapper.vm.isStale).toBe(false)
    })

    it('refresh() resets error state on success', async () => {
      const fetcher = vi.fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValueOnce({ value: 'success' })

      const TestComponent = createTestComponent('test:reset-error', fetcher, { autoRetry: false })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(wrapper.vm.error).toBeTruthy()

      wrapper.vm.refresh()
      await flushPromises()

      expect(wrapper.vm.error).toBeNull()
      expect(wrapper.vm.data).toEqual({ value: 'success' })

      consoleError.mockRestore()
    })
  })

  // ============================================
  // Cross-Tab Sync
  // ============================================
  describe('Cross-Tab Sync', () => {
    it('updates data when storage event fires for same key', async () => {
      const fetcher = createMockFetcher({ value: 'initial' })
      const TestComponent = createTestComponent('test:sync', fetcher)

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(wrapper.vm.data).toEqual({ value: 'initial' })

      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'classifarr:v1:swr:test:sync',
        newValue: JSON.stringify({
          value: { value: 'from-other-tab' },
          timestamp: Date.now()
        })
      })
      window.dispatchEvent(storageEvent)
      await nextTick()

      expect(wrapper.vm.data).toEqual({ value: 'from-other-tab' })
    })

    it('ignores storage events for different keys', async () => {
      const fetcher = createMockFetcher({ value: 'initial' })
      const TestComponent = createTestComponent('test:my-key', fetcher)

      const wrapper = mount(TestComponent)
      await flushPromises()

      // Simulate storage event for different key
      const storageEvent = new StorageEvent('storage', {
        key: 'classifarr:v1:swr:other-key',
        newValue: JSON.stringify({ value: { value: 'other' }, timestamp: Date.now() })
      })
      window.dispatchEvent(storageEvent)
      await nextTick()

      // Should not change
      expect(wrapper.vm.data).toEqual({ value: 'initial' })
    })

    it('clears error and isStale on cross-tab update', async () => {
      const fetcher = createFailingFetcher('Error')
      const TestComponent = createTestComponent('test:sync-clear', fetcher, { autoRetry: false })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(wrapper.vm.error).toBeTruthy()

      // Simulate successful update from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'classifarr:v1:swr:test:sync-clear',
        newValue: JSON.stringify({
          value: { value: 'success' },
          timestamp: Date.now()
        })
      })
      window.dispatchEvent(storageEvent)
      await nextTick()

      expect(wrapper.vm.data).toEqual({ value: 'success' })
      expect(wrapper.vm.error).toBeNull()
      expect(wrapper.vm.isStale).toBe(false)

      consoleError.mockRestore()
    })
  })

  // ============================================
  // TTL Configuration
  // ============================================
  describe('TTL Configuration', () => {
    it('respects custom TTL option', async () => {
      // Cache from 20 seconds ago
      setSWRCache('test:ttl', { value: 'cached' }, Date.now() - 20000)

      const fetcher = createMockFetcher({ value: 'fresh' })

      // TTL of 30 seconds - cache should be valid
      const TestComponent = createTestComponent('test:ttl', fetcher, { ttl: 30000 })
      const wrapper = mount(TestComponent)

      expect(wrapper.vm.data).toEqual({ value: 'cached' }) // Cache hit
    })

    it('uses default TTL of 60 seconds', async () => {
      // Cache from 50 seconds ago
      setSWRCache('test:default-ttl', { value: 'cached' }, Date.now() - 50000)

      const fetcher = createMockFetcher({ value: 'fresh' })
      const TestComponent = createTestComponent('test:default-ttl', fetcher)

      const wrapper = mount(TestComponent)

      // 50s < 60s default TTL, so cache should be valid
      expect(wrapper.vm.data).toEqual({ value: 'cached' })
    })

    it('invalidates cache beyond TTL', async () => {
      // Cache from 70 seconds ago
      setSWRCache('test:expired-ttl', { value: 'cached' }, Date.now() - 70000)

      const fetcher = createMockFetcher({ value: 'fresh' })
      const TestComponent = createTestComponent('test:expired-ttl', fetcher, { ttl: 60000 })

      const wrapper = mount(TestComponent)

      // 70s > 60s TTL, cache should be ignored
      expect(wrapper.vm.data).toBe(null)
      expect(wrapper.vm.isLoading).toBe(true)
    })
  })

  // ============================================
  // Polling
  // ============================================
  describe('Polling', () => {
    it('polls at configured interval', async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 3 })

      const TestComponent = createTestComponent('test:poll', fetcher, {
        pollInterval: 5000
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(wrapper.vm.data).toEqual({ count: 1 })

      // Advance 5 seconds
      await vi.advanceTimersByTimeAsync(5000)
      await flushPromises()

      expect(fetcher).toHaveBeenCalledTimes(2)
      expect(wrapper.vm.data).toEqual({ count: 2 })

      // Advance another 5 seconds
      await vi.advanceTimersByTimeAsync(5000)
      await flushPromises()

      expect(fetcher).toHaveBeenCalledTimes(3)
      expect(wrapper.vm.data).toEqual({ count: 3 })
    })

    it('does not poll when pollInterval is null', async () => {
      const fetcher = createMockFetcher({ value: 'data' })
      const TestComponent = createTestComponent('test:no-poll', fetcher, {
        pollInterval: null
      })

      mount(TestComponent)
      await flushPromises()

      expect(fetcher).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(30000)
      await flushPromises()

      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('stops polling on unmount', async () => {
      const fetcher = vi.fn().mockResolvedValue({ value: 'data' })
      const TestComponent = createTestComponent('test:unmount', fetcher, {
        pollInterval: 5000
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      expect(fetcher).toHaveBeenCalledTimes(1)

      wrapper.unmount()

      await vi.advanceTimersByTimeAsync(15000)
      await flushPromises()

      // Should not have polled after unmount
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('supports dynamic poll intervals via reactive resolver', async () => {
      const activeMode = ref(true)
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 3 })

      const TestComponent = defineComponent({
        setup() {
          const swr = useSWR('test:dynamic-poll', fetcher, {
            pollInterval: () => (activeMode.value ? 1000 : 10000)
          })
          return { ...swr }
        },
        template: '<div />'
      })

      mount(TestComponent)
      await flushPromises()
      expect(fetcher).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()
      expect(fetcher).toHaveBeenCalledTimes(2)

      activeMode.value = false
      await nextTick()

      await vi.advanceTimersByTimeAsync(2000)
      await flushPromises()
      expect(fetcher).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(8000)
      await flushPromises()
      expect(fetcher).toHaveBeenCalledTimes(3)
    })

    it('pauses polling while document is hidden when pollOnlyWhenVisible is enabled', async () => {
      const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get')
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 2 })

      const TestComponent = createTestComponent('test:hidden-tab', fetcher, {
        pollInterval: 5000,
        pollOnlyWhenVisible: true
      })

      visibilitySpy.mockReturnValue('hidden')
      mount(TestComponent)
      await flushPromises()
      expect(fetcher).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(5000)
      await flushPromises()
      expect(fetcher).toHaveBeenCalledTimes(1)

      visibilitySpy.mockReturnValue('visible')
      await vi.advanceTimersByTimeAsync(5000)
      await flushPromises()
      expect(fetcher).toHaveBeenCalledTimes(2)

      visibilitySpy.mockRestore()
    })
  })

  // ============================================
  // Cleanup
  // ============================================
  describe('Cleanup', () => {
    it('removes storage event listener on unmount', async () => {
      const removeEventSpy = vi.spyOn(window, 'removeEventListener')

      const fetcher = createMockFetcher({ value: 'data' })
      const TestComponent = createTestComponent('test:cleanup', fetcher)

      const wrapper = mount(TestComponent)
      await flushPromises()

      wrapper.unmount()

      expect(removeEventSpy).toHaveBeenCalledWith('storage', expect.any(Function))

      removeEventSpy.mockRestore()
    })
  })
})
