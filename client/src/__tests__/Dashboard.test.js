/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { useSWR } from '../composables/useSWR'

// Mock @vueuse/core synchronously with Ref-like objects
// This fixes "Invalid watch source" warnings
vi.mock('@vueuse/core', () => ({
  useOnline: () => ({ value: true, __v_isRef: true }),
  useDocumentVisibility: () => ({ value: 'visible', __v_isRef: true })
}))

// Robust Mock Storage Function
const createMockStorage = () => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    key: vi.fn((i) => Object.keys(store)[i] || null),
    get length() { return Object.keys(store).length }
  };
}

const createTestComponent = (cacheKey, fetcher, options = {}) => {
  return defineComponent({
    setup() {
      const swr = useSWR(cacheKey, fetcher, { ttl: 60000, ...options })
      return { ...swr }
    },
    template: `
      <div>
        <div v-if="isLoading" data-testid="loading">Loading...</div>
        <div v-if="isStale" data-testid="updating">Updating...</div>
        <div v-if="data" data-testid="stats">{{ data.stats?.total }}</div>
        <div v-if="error" data-testid="error">{{ error.message }}</div>
        <button @click="refresh" data-testid="refresh">Refresh</button>
      </div>
    `
  })
}

describe('Dashboard SWR Integration', () => {
  let mockStorage
  const FIXED_TIME = 1600000000000

  beforeEach(() => {
    // 1. Setup Mock Storage
    mockStorage = createMockStorage()
    
    // 2. Inject into global scope (fixing missing localStorage issues)
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      configurable: true,
      writable: true
    })
    globalThis.localStorage = mockStorage
    
    // 3. Mock Date.now for deterministic cache expiry
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_TIME)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('SWR Cache Behavior', () => {
    it('shows loading when no cache exists', async () => {
      const fetcher = vi.fn().mockResolvedValue({ stats: { total: 100 } })
      const TestComponent = createTestComponent('dashboard:empty', fetcher)
      
      const wrapper = mount(TestComponent)
      await nextTick()
      
      expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="stats"]').exists()).toBe(false)
      
      await flushPromises()
      
      expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="stats"]').text()).toBe('100')
    })

    it('displays cached data immediately', async () => {
      const CACHE_KEY = 'dashboard:cached'
      const FULL_KEY = `classifarr:v1:swr:${CACHE_KEY}`
      
      // Seed Cache
      mockStorage.setItem(FULL_KEY, JSON.stringify({
        value: { stats: { total: 42 } },
        timestamp: FIXED_TIME // Fresh cache
      }))

      const fetcher = vi.fn().mockImplementation(async () => {
         await new Promise(r => setTimeout(r, 10))
         return { stats: { total: 100 } }
      })

      const TestComponent = createTestComponent(CACHE_KEY, fetcher)
      const wrapper = mount(TestComponent)
      await nextTick()
      
      // Should show cached data immediately
      expect(wrapper.find('[data-testid="stats"]').text()).toBe('42')
      expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
      
      // Should show updating indicator
      expect(wrapper.find('[data-testid="updating"]').exists()).toBe(true)
      
      // Wait for fetch
      await flushPromises()
      await new Promise(r => setTimeout(r, 20))
      await flushPromises()
      
      // Should show new data
      expect(wrapper.find('[data-testid="stats"]').text()).toBe('100')
      expect(wrapper.find('[data-testid="updating"]').exists()).toBe(false)
      
      // Verify storage was updated
      expect(mockStorage.setItem).toHaveBeenCalledWith(FULL_KEY, expect.stringContaining('"total":100'))
    })

    it('ignores expired cache', async () => {
      const CACHE_KEY = 'dashboard:expired'
      const FULL_KEY = `classifarr:v1:swr:${CACHE_KEY}`
      
      // Seed Expired Cache (older than 60s default TTL)
      mockStorage.setItem(FULL_KEY, JSON.stringify({
        value: { stats: { total: 999 } },
        timestamp: FIXED_TIME - 70000 
      }))

      const fetcher = vi.fn().mockResolvedValue({ stats: { total: 100 } })
      const TestComponent = createTestComponent(CACHE_KEY, fetcher)
      
      const wrapper = mount(TestComponent)
      await nextTick()
      
      // Should NOT show cached data
      expect(wrapper.find('[data-testid="stats"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
      
      await flushPromises()
      expect(wrapper.find('[data-testid="stats"]').text()).toBe('100')
    })
  })

  /* Manual refresh button removed from UI
  describe('Refresh Functionality', () => {
    it('refresh button triggers revalidation', async () => {
       // ... test removed ...
    })
  })
  */

  describe('Error Handling', () => {
    it('serves cached data when API fails', async () => {
      const CACHE_KEY = 'dashboard:error'
      mockStorage.setItem(`classifarr:v1:swr:${CACHE_KEY}`, JSON.stringify({
        value: { stats: { total: 55 } },
        timestamp: FIXED_TIME
      }))

      const fetcher = vi.fn().mockRejectedValue(new Error('Network Fail'))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const TestComponent = createTestComponent(CACHE_KEY, fetcher, { autoRetry: false })
      const wrapper = mount(TestComponent)
      await nextTick()
      
      // Should show cache
      expect(wrapper.find('[data-testid="stats"]').text()).toBe('55')
      
      await flushPromises()
      
      // Should show error but keep cache
      expect(wrapper.find('[data-testid="stats"]').text()).toBe('55')
      expect(wrapper.find('[data-testid="error"]').text()).toBe('Network Fail')
      
      consoleError.mockRestore()
    })
  })
})
