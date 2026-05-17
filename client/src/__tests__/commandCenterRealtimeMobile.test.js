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
    searchTMDB: vi.fn(),
    submitManualRequest: vi.fn(),
    syncLibrary: vi.fn(),
    cancelQueueTask: vi.fn(),
    cancelAllPendingTasks: vi.fn(),
    post: vi.fn(),
    processEnrichmentRetries: vi.fn(),
    resolvePendingClassification: vi.fn(),
    retryQueueTask: vi.fn(),
    dismissQueueTask: vi.fn(),
    retryAllFailedTasks: vi.fn(),
    clearFailedTasks: vi.fn(),
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
  queue: { pending: 3, processing: 1, completed: 9, failed: 0 },
  gapAnalysis: { processedCount: 2847, totalCount: 6324, percentComplete: 45 },
  librarySync: {
    syncedItems: 2847,
    totalItems: 6324,
    remainingItems: 3477,
    percentComplete: 45,
    isRunning: false,
    type: null,
    progress: 0,
    currentLibrary: null,
    startedAt: null,
    duration: 0,
    canInterrupt: true,
  },
  enrichment: {
    totalItems: 6324,
    enriched: 5621,
    omdbEnriched: 5418,
    tavilyEnriched: 203,
    progress: 89,
    retryQueue: { total: { pending: 0 } },
  },
  health: { ai: true, worker: true },
  today: { classified: 12, avgConfidence: 89, allClassified: 15 },
})

async function mountCommandCenter() {
  const router = await createMemoryRouter([{ path: '/', component: { template: '<div />' } }])

  const wrapper = mount(CommandCenter, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: {
        RouterLink: ROUTER_LINK_SIMPLE_STUB,
      },
    },
  })

  await flushPromises()
  await flushPromises()
  return wrapper
}

describe('CommandCenter realtime and mobile behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)

    apiMock.getLiveStats.mockResolvedValue(createLiveStats())
    apiMock.getClassificationProgress.mockResolvedValue([
      {
        taskId: 15,
        title: 'Inception',
        year: 2010,
        mediaType: 'movie',
        currentPhase: 'ai_analysis',
        phaseIndex: 6,
        totalPhases: 8,
        progress: 67,
        phaseDuration: 3200,
        phases: [{ name: 'ai_analysis', label: 'AI Analysis', status: 'in_progress' }],
      },
    ])
    apiMock.getQueuePending.mockResolvedValue([])
    apiMock.getQueueFailed.mockResolvedValue([])
    apiMock.getPendingClassifications.mockResolvedValue({ items: [] })
    apiMock.getAiGenerationStatus.mockResolvedValue({ isActive: false })
    apiMock.getAIUsage.mockResolvedValue({ budget: { limit: 5, used: 1, percentUsed: 20 } })
    apiMock.getLibraries.mockResolvedValue([{ id: 10, name: 'TV Shows', media_type: 'tv', is_active: true }])
    apiMock.getLiveFeed.mockResolvedValue({ items: [] })
    apiMock.getMediaServerConfig.mockResolvedValue({ id: 1, name: 'Plex' })
    apiMock.getArrConfigStatus.mockResolvedValue({ incompleteConfigs: [] })
  })

  it('shows freshness UX and polite live-update announcement', async () => {
    const wrapper = await mountCommandCenter()

    const liveRegion = wrapper.find('[aria-live="polite"]')
    expect(liveRegion.exists()).toBe(true)
    expect(liveRegion.text()).toContain('Last updated at')
  })

  it('shows live Plex sync coverage on mobile when a library sync is active', async () => {
    mockMatchMedia(true)
    apiMock.getLiveStats.mockResolvedValueOnce({
      ...createLiveStats(),
      librarySync: {
        syncedItems: 3330,
        totalItems: 6634,
        remainingItems: 3304,
        percentComplete: 50,
        isRunning: true,
        type: 'full',
        progress: 50,
        currentLibrary: 'TV Shows',
        startedAt: Date.now(),
        duration: 120000,
        canInterrupt: true,
      },
    })
    const wrapper = await mountCommandCenter()

    expect(wrapper.text()).toContain('Syncing Plex Library')
    expect(wrapper.text()).toContain('Current library: TV Shows')
    expect(wrapper.text()).toContain('Library: 3,330 / 6,634 (50%)')
    wrapper.unmount()
  })

  it('shows the idle sync snapshot on mobile when no Plex sync is running', async () => {
    mockMatchMedia(true)
    const wrapper = await mountCommandCenter()

    expect(wrapper.text()).toContain('No active processing')
    expect(wrapper.text()).toContain('Library: 2,847 / 6,324 (45%)')
    wrapper.unmount()
  })

  it('has accessible action controls on mobile for failed tasks and quick add', async () => {
    mockMatchMedia(true)
    apiMock.getQueueFailed.mockResolvedValueOnce([
      {
        id: 99,
        title: 'Broken Item',
        year: 2026,
        task_type: 'CLASSIFICATION',
        error_message: 'AI timeout',
        created_at: new Date().toISOString(),
      },
    ])
    const wrapper = await mountCommandCenter()

    const retryAllButton = wrapper.findAll('button').find((node) => node.text() === 'Retry All')
    expect(retryAllButton).toBeDefined()

    const quickAddSection = wrapper.find('.secondary-section-title')
    expect(quickAddSection.exists()).toBe(true)

    wrapper.unmount()
  })
})
