/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CommandCenter from '@/views/CommandCenter.vue'
import { createMemoryRouter, ROUTER_LINK_SIMPLE_STUB } from './helpers/vueTestUtils'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getLiveStats: vi.fn(),
    getClassificationProgress: vi.fn(),
    getQueuePending: vi.fn(),
    getQueueFailed: vi.fn(),
    getPendingClassifications: vi.fn(),
    getAiGenerationStatus: vi.fn(),
    getAIUsage: vi.fn(),
    getLibraries: vi.fn(),
    getLiveFeed: vi.fn(),
    getMediaServerConfig: vi.fn(),
    getArrConfigStatus: vi.fn(),
    cancelQueueTask: vi.fn(),
    cancelAllPendingTasks: vi.fn(),
    post: vi.fn(),
    processEnrichmentRetries: vi.fn(),
    resolvePendingClassification: vi.fn(),
    retryQueueTask: vi.fn(),
    dismissQueueTask: vi.fn(),
    retryAllFailedTasks: vi.fn(),
    clearFailedTasks: vi.fn(),
    searchTMDB: vi.fn(),
    submitManualRequest: vi.fn(),
    syncLibrary: vi.fn(),
  },
}))

vi.mock('@/api', () => ({
  default: apiMock,
}))

function mockMatchMedia(matches) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(max-width: 767px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const createLiveStats = () => ({
  queue: { pending: 0, processing: 0, completed: 0, failed: 0 },
  gapAnalysis: { processedCount: 6324, totalCount: 6324, percentComplete: 100 },
  enrichment: {
    totalItems: 0,
    completedItems: 0,
    processingItems: 0,
    pendingItems: 0,
    deferredItems: 0,
    failedItems: 0,
    omdbEnriched: 0,
    webSearchEnriched: 0,
    progress: 0,
    retryQueue: { total: { pending: 0, deferred: 0 } },
  },
  health: { ai: true, worker: true },
  today: { classified: 0, avgConfidence: 0, allClassified: 0 },
})

async function mountCommandCenter(initialPath = '/') {
  const router = await createMemoryRouter([
    { path: '/', component: CommandCenter },
    { path: '/settings', component: { template: '<div>Settings</div>' } },
    { path: '/policies', component: { template: '<div>Policies</div>' } },
    { path: '/presets', component: { template: '<div>Presets</div>' } },
    { path: '/tuning-suggestions', component: { template: '<div>Tuning</div>' } },
    { path: '/notifications', component: { template: '<div>Notifications</div>' } },
  ], initialPath)

  const wrapper = mount(CommandCenter, {
    global: {
      plugins: [router],
      stubs: {
        RouterLink: ROUTER_LINK_SIMPLE_STUB,
      },
    },
  })

  await flushPromises()
  await flushPromises()
  return { wrapper, router }
}

describe('CommandCenter legacy compatibility guidance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)

    apiMock.getLiveStats.mockResolvedValue(createLiveStats())
    apiMock.getClassificationProgress.mockResolvedValue([])
    apiMock.getQueuePending.mockResolvedValue([])
    apiMock.getQueueFailed.mockResolvedValue([])
    apiMock.getPendingClassifications.mockResolvedValue({ items: [] })
    apiMock.getAiGenerationStatus.mockResolvedValue({ isActive: false })
    apiMock.getAIUsage.mockResolvedValue({ budget: { limit: 5, used: 1, percentUsed: 20 } })
    apiMock.getLibraries.mockResolvedValue([])
    apiMock.getLiveFeed.mockResolvedValue({ items: [] })
    apiMock.getMediaServerConfig.mockResolvedValue({ id: 1, name: 'Plex' })
    apiMock.getArrConfigStatus.mockResolvedValue({ incompleteConfigs: [] })
  })

  it('renders queue legacy redirect guidance and can dismiss it', async () => {
    const { wrapper, router } = await mountCommandCenter('/?legacyRoute=queue')

    expect(wrapper.text()).toContain('You were redirected from Queue.')
    expect(wrapper.text()).toContain('Open Settings Queue')

    const dismissButton = wrapper.findAll('button').find((node) => node.text() === 'Dismiss')
    expect(dismissButton).toBeDefined()
    await dismissButton.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.legacyRoute).toBeUndefined()
    wrapper.unmount()
  })
})
