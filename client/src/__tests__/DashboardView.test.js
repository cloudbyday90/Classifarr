/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import Dashboard from '@/views/Dashboard.vue'
import { CACHE_KEYS } from '@/constants/cacheKeys'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/stores/libraries', () => ({
  useLibrariesStore: () => ({
    libraries: [{ id: 1, name: 'Movies' }],
    fetchLibraries: vi.fn().mockResolvedValue(),
  }),
}))

vi.mock('@/composables/useServiceRequirements', () => ({
  useServiceRequirements: () => ({ canUseFeature: true }),
}))

vi.mock('@/composables/useSWR', () => ({
  useSWR: vi.fn((key) => {
    const timestamp = ref(Date.now())
    if (key === CACHE_KEYS.DASHBOARD_MAIN) {
      return {
        data: ref({
          stats: { total: 12, avg_confidence: 83, byMethod: [] },
          recentHistory: [],
          awaitingDecisionCount: 2,
        }),
        isLoading: ref(false),
        isStale: ref(false),
        error: ref(null),
        refresh: vi.fn(),
        isOffline: ref(false),
        cacheTimestamp: timestamp,
      }
    }

    if (key === CACHE_KEYS.DASHBOARD_QUEUE) {
      return {
        data: ref({
          queueStats: { pending: 5, processing: 2, completed: 20, failed: 1, aiAvailable: true },
          enrichmentStats: {
            totalItems: 100,
            completedItems: 45,
            processingItems: 3,
            pendingItems: 40,
            deferredItems: 10,
            failedItems: 2,
            omdbEnriched: 40,
            notNeededItems: 0,
            tavilyEnriched: 5,
            progress: 45,
          },
        }),
        refresh: vi.fn(),
      }
    }

    return {
      data: ref(null),
      isLoading: ref(false),
      isStale: ref(false),
      error: ref(null),
      refresh: vi.fn(),
      isOffline: ref(false),
      cacheTimestamp: timestamp,
    }
  }),
}))

vi.mock('@/components/settings/ArrConfigWarning.vue', () => ({
  default: { template: '<div data-testid="arr-config-warning"></div>' },
}))

vi.mock('@/components/PgvectorVariantBanner.vue', () => ({
  default: { template: '<div data-testid="pgvector-banner"></div>' },
}))

describe('Dashboard enrichment summary', () => {
  it('renders explicit enrichment workflow state tallies', () => {
    const wrapper = mount(Dashboard, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          Card: { props: ['title'], template: '<section><h2>{{ title }}</h2><slot /></section>' },
          Button: { template: '<button><slot /></button>' },
          Badge: { template: '<span><slot /></span>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Library Enrichment')
    expect(wrapper.text()).toContain('45 / 100 processed')
    expect(wrapper.text()).toContain('Processed')
    expect(wrapper.text()).toContain('Basic Enriched')
    expect(wrapper.text()).toContain('Processing')
    expect(wrapper.text()).toContain('Pending')
    expect(wrapper.text()).toContain('Deferred')
    expect(wrapper.text()).toContain('Failed')
    expect(wrapper.text()).toContain('OMDb: 40 • Basic Enriched: 0 • Tavily: 5')
  })
})
