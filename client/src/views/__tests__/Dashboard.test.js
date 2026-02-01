/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import Dashboard from '../Dashboard.vue'
import { useLibrariesStore } from '@/stores/libraries'

// Mock @vueuse/core
vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => ref('visible'),
  useOnline: () => ref(true)
}))

// Mock router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock API
vi.mock('@/api', () => ({
  default: {
    getStats: vi.fn(),
    getHistory: vi.fn(),
    get: vi.fn(),
    getLiveStats: vi.fn(),
    getQueueStats: vi.fn()
  }
}))

// Mock components
vi.mock('@/components/common/Card.vue', () => ({
  default: {
    name: 'Card',
    template: '<div class="card"><slot /></div>'
  }
}))

vi.mock('@/components/common/Button.vue', () => ({
  default: {
    name: 'Button',
    template: '<button><slot /></button>',
    props: ['variant', 'size']
  }
}))

vi.mock('@/components/common/Badge.vue', () => ({
  default: {
    name: 'Badge',
    template: '<span class="badge"><slot /></span>',
    props: ['variant']
  }
}))

vi.mock('@/components/SetupBanner.vue', () => ({
  default: {
    name: 'SetupBanner',
    template: '<div class="setup-banner"></div>'
  }
}))

vi.mock('@/components/settings/ArrConfigWarning.vue', () => ({
  default: {
    name: 'ArrConfigWarning',
    template: '<div class="arr-warning"></div>'
  }
}))

vi.mock('@/components/PgvectorVariantBanner.vue', () => ({
  default: {
    name: 'PgvectorVariantBanner',
    template: '<div class="pgvector-banner"></div>'
  }
}))

// Mock useSWR composable
vi.mock('@/composables/useSWR', () => ({
  useSWR: vi.fn()
}))

import { useSWR } from '@/composables/useSWR'

describe('Dashboard.vue', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    
    // Reset mocks
    vi.clearAllMocks()
    
    // Default mock implementations with refs
    useSWR.mockImplementation((key, fetcher, options) => {
      if (key.includes('DASHBOARD_MAIN')) {
        return {
          data: ref(null),
          isLoading: ref(false),
          isStale: ref(false),
          error: ref(null),
          refresh: vi.fn(),
          isOffline: ref(false),
          cacheTimestamp: ref(null)
        }
      } else {
        return {
          data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
          refresh: vi.fn()
        }
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading State', () => {
    it('shows loading skeletons when loading', async () => {
      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref(null),
            isLoading: ref(true),
            isStale: ref(false),
            error: ref(null),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      expect(wrapper.find('[role="status"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Loading dashboard statistics"]').exists()).toBe(true)
      expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
    })

    it('has proper ARIA attributes on loading state', async () => {
      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref(null),
            isLoading: ref(true),
            isStale: ref(false),
            error: ref(null),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      const loadingContainer = wrapper.find('[role="status"]')
      expect(loadingContainer.attributes('aria-live')).toBe('polite')
      expect(loadingContainer.attributes('aria-label')).toContain('Loading')
    })

    it('has screen reader text for loading state', async () => {
      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref(null),
            isLoading: ref(true),
            isStale: ref(false),
            error: ref(null),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      const srText = wrapper.find('.sr-only')
      expect(srText.exists()).toBe(true)
      expect(srText.text()).toContain('Loading dashboard data')
    })
  })

  describe('Error State', () => {
    it('shows error message when error occurs', async () => {
      const errorMessage = 'Failed to fetch data'
      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref(null),
            isLoading: ref(false),
            isStale: ref(false),
            error: ref({ message: errorMessage }),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Failed to Load Dashboard')
      expect(wrapper.text()).toContain(errorMessage)
    })

    it('has retry button in error state', async () => {
      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref(null),
            isLoading: ref(false),
            isStale: ref(false),
            error: ref({ message: 'Network error' }),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      const retryButton = wrapper.find('button')
      expect(retryButton.exists()).toBe(true)
      expect(retryButton.text()).toContain('Retry')
    })

    it('has assertive ARIA live region for errors', async () => {
      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref(null),
            isLoading: ref(false),
            isStale: ref(false),
            error: ref({ message: 'Error message' }),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      const errorContainer = wrapper.find('[role="alert"]')
      expect(errorContainer.attributes('aria-live')).toBe('assertive')
    })

    it('error has proper ARIA describedby on retry button', async () => {
      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref(null),
            isLoading: ref(false),
            isStale: ref(false),
            error: ref({ message: 'Test error' }),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      const retryButton = wrapper.find('button')
      expect(retryButton.attributes('aria-describedby')).toBe('error-description')
    })
  })

  describe('Empty State', () => {
    it('shows welcome message when no libraries exist', async () => {
      const librariesStore = useLibrariesStore()
      librariesStore.libraries = []

      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref({ stats: {}, recentHistory: [], awaitingDecisionCount: 0 }),
            isLoading: ref(false),
            isStale: ref(false),
            error: ref(null),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      expect(wrapper.text()).toContain('Welcome to Classifarr!')
      expect(wrapper.find('[role="region"]').exists()).toBe(true)
    })

    it('has proper ARIA labelledby on empty state', async () => {
      const librariesStore = useLibrariesStore()
      librariesStore.libraries = []

      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref({ stats: {}, recentHistory: [], awaitingDecisionCount: 0 }),
            isLoading: ref(false),
            isStale: ref(false),
            error: ref(null),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      const emptyState = wrapper.find('[role="region"]')
      expect(emptyState.attributes('aria-labelledby')).toBe('welcome-heading')
    })
  })

  describe('Keyboard Navigation', () => {
    it('refreshes dashboard on Ctrl+R', async () => {
      const mockRefresh = vi.fn()
      const mockQueueRefresh = vi.fn()

      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref({ stats: {}, recentHistory: [], awaitingDecisionCount: 0 }),
            isLoading: ref(false),
            isStale: ref(false),
            error: ref(null),
            refresh: mockRefresh,
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: mockQueueRefresh
          }
        }
      })

      const librariesStore = useLibrariesStore()
      librariesStore.libraries = [{ id: 1, name: 'Test Library' }]

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      // Simulate Ctrl+R
      const event = new KeyboardEvent('keydown', { 
        ctrlKey: true, 
        key: 'r',
        bubbles: true
      })
      window.dispatchEvent(event)
      
      await nextTick()
      
      expect(mockRefresh).toHaveBeenCalled()
      expect(mockQueueRefresh).toHaveBeenCalled()
    })

    it('dismisses error on Escape key', async () => {
      const errorRefObj = ref({ message: 'Test error' })
      
      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref(null),
            isLoading: ref(false),
            isStale: ref(false),
            error: errorRefObj,
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      expect(wrapper.vm.error).toBeTruthy()
      
      // Simulate Escape key
      const event = new KeyboardEvent('keydown', { 
        key: 'Escape',
        bubbles: true
      })
      window.dispatchEvent(event)
      
      await nextTick()
      expect(wrapper.vm.error).toBeNull()
    })
  })

  describe('Accessibility', () => {
    it('has skip to main content link', async () => {
      const librariesStore = useLibrariesStore()
      librariesStore.libraries = [{ id: 1, name: 'Test Library' }]

      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref({ stats: {}, recentHistory: [], awaitingDecisionCount: 0 }),
            isLoading: ref(false),
            isStale: ref(false),
            error: ref(null),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      const skipLink = wrapper.find('.skip-to-main')
      expect(skipLink.exists()).toBe(true)
      expect(skipLink.text()).toContain('Skip to main content')
      expect(skipLink.attributes('href')).toBe('#main-content')
    })

    it('main content has tabindex for focus management', async () => {
      const librariesStore = useLibrariesStore()
      librariesStore.libraries = [{ id: 1, name: 'Test Library' }]

      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref({ stats: {}, recentHistory: [], awaitingDecisionCount: 0 }),
            isLoading: ref(false),
            isStale: ref(false),
            error: ref(null),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      const main = wrapper.find('#main-content')
      expect(main.exists()).toBe(true)
      expect(main.attributes('tabindex')).toBe('-1')
    })

    it('focuses error heading when error occurs', async () => {
      // Create a mock element
      const mockElement = document.createElement('h3')
      mockElement.id = 'error-heading'
      mockElement.tabIndex = -1
      document.body.appendChild(mockElement)

      const errorRefObj = ref(null)
      
      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref(null),
            isLoading: ref(false),
            isStale: ref(false),
            error: errorRefObj,
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(null)
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Trigger error
      errorRefObj.value = { message: 'New error' }
      await nextTick()
      await flushPromises()
      
      // Should focus error heading
      const errorHeading = document.getElementById('error-heading')
      expect(document.activeElement).toBe(errorHeading)

      wrapper.unmount()
      document.body.removeChild(mockElement)
    })
  })

  describe('Last Updated Timestamp', () => {
    it('shows last updated time with ARIA label', async () => {
      const now = new Date()
      const librariesStore = useLibrariesStore()
      librariesStore.libraries = [{ id: 1, name: 'Test Library' }]

      useSWR.mockImplementation((key) => {
        if (key.includes('DASHBOARD_MAIN')) {
          return {
            data: ref({ stats: {}, recentHistory: [], awaitingDecisionCount: 0 }),
            isLoading: ref(false),
            isStale: ref(false),
            error: ref(null),
            refresh: vi.fn(),
            isOffline: ref(false),
            cacheTimestamp: ref(now.getTime())
          }
        } else {
          return {
            data: ref({ queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, aiAvailable: true } }),
            refresh: vi.fn()
          }
        }
      })

      const wrapper = mount(Dashboard, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      await nextTick()
      
      // Find the timestamp span with aria-label
      const timestamps = wrapper.findAll('[role="status"][aria-live="polite"]')
      const timestampWithLabel = timestamps.find(el => el.attributes('aria-label')?.includes('Dashboard last updated'))
      
      expect(timestampWithLabel).toBeDefined()
      expect(timestampWithLabel.attributes('aria-label')).toContain('Dashboard last updated')
    })
  })
})
