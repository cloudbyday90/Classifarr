/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import CommandCenter from '@/views/CommandCenter.vue'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getLiveStats: vi.fn(),
    getClassificationProgress: vi.fn(),
    getQueuePending: vi.fn(),
    getQueueFailed: vi.fn(),
    getPendingClassifications: vi.fn(),
    getOllamaStatus: vi.fn(),
    getAIUsage: vi.fn(),
    getLibraries: vi.fn(),
    getLiveFeed: vi.fn(),
    getMediaServerConfig: vi.fn(),
    get: vi.fn(),
    searchTMDB: vi.fn(),
    submitManualRequest: vi.fn(),
    syncLibrary: vi.fn(),
    cancelQueueTask: vi.fn(),
    cancelAllPendingTasks: vi.fn(),
    post: vi.fn(),
    processRetryQueue: vi.fn(),
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
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()

  const wrapper = mount(CommandCenter, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: {
        RouterLink: {
          template: '<a><slot /></a>',
        },
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

    apiMock.getLiveStats.mockResolvedValue({ data: createLiveStats() })
    apiMock.getClassificationProgress.mockResolvedValue({
      data: [{
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
      }],
    })
    apiMock.getQueuePending.mockResolvedValue([])
    apiMock.getQueueFailed.mockResolvedValue([])
    apiMock.getPendingClassifications.mockResolvedValue({ data: { items: [] } })
    apiMock.getOllamaStatus.mockResolvedValue({ data: { isActive: false } })
    apiMock.getAIUsage.mockResolvedValue({ data: { budget: { limit: 5, used: 1, percentUsed: 20 } } })
    apiMock.getLibraries.mockResolvedValue({ data: [{ id: 10, name: 'TV Shows', media_type: 'tv', is_active: true }] })
    apiMock.getLiveFeed.mockResolvedValue({ data: { items: [] } })
    apiMock.getMediaServerConfig.mockResolvedValue({ data: { id: 1, name: 'Plex' } })
    apiMock.get.mockResolvedValue({ data: { incompleteConfigs: [] } })
  })

  it('shows freshness UX and polite live-update announcement', async () => {
    const wrapper = await mountCommandCenter()

    const liveRegion = wrapper.find('[aria-live="polite"]')
    expect(liveRegion.exists()).toBe(true)
    expect(liveRegion.text()).toContain('Last updated at')
  })

  it('shows inline processing stepper on mobile when task is active', async () => {
    mockMatchMedia(true)
    const wrapper = await mountCommandCenter()

    expect(wrapper.find('.processing-stepper').exists()).toBe(true)
    expect(wrapper.find('.stepper-item').exists()).toBe(true)
    expect(wrapper.text()).toContain('Inception')
    wrapper.unmount()
  })

  it('opens and closes the processing details sheet on mobile', async () => {
    mockMatchMedia(true)
    const wrapper = await mountCommandCenter()

    const detailsButton = wrapper.findAll('button').find((node) => node.text() === 'View Details')
    expect(detailsButton).toBeDefined()

    await detailsButton.trigger('click')
    await flushPromises()

    const dialog = document.body.querySelector('[role="dialog"][aria-modal="true"]')
    expect(dialog).not.toBeNull()
    expect(document.body.textContent).toContain('Processing Details')
    expect(document.body.textContent).toContain('Inception')
    expect(document.body.classList.contains('overflow-hidden')).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(document.body.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull()
    expect(document.body.classList.contains('overflow-hidden')).toBe(false)
    expect(document.activeElement).toBe(detailsButton.element)

    wrapper.unmount()
  })

  it('closes the processing details sheet when the selected task disappears on refresh', async () => {
    mockMatchMedia(true)
    const wrapper = await mountCommandCenter()

    const detailsButton = wrapper.findAll('button').find((node) => node.text() === 'View Details')
    expect(detailsButton).toBeDefined()

    await detailsButton.trigger('click')
    await flushPromises()

    expect(document.body.textContent).toContain('Inception')

    apiMock.getClassificationProgress.mockResolvedValueOnce({
      data: [{
        taskId: 16,
        title: 'Replacement Task',
        year: 2024,
        mediaType: 'movie',
        currentPhase: 'decision',
        phaseIndex: 7,
        totalPhases: 8,
        progress: 90,
        phaseDuration: 1800,
        phases: [{ name: 'decision', label: 'Decision', status: 'in_progress' }],
      }],
    })

    await wrapper.vm.$.setupState.refreshOperationalData()
    await flushPromises()

    expect(document.body.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull()
    expect(document.body.textContent).not.toContain('Processing DetailsReplacement Task')
    expect(document.activeElement).toBe(detailsButton.element)

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
