/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CommandCenter from '@/views/CommandCenter.vue'
import { createMemoryRouter, ROUTER_LINK_STUB } from './helpers/vueTestUtils'

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

const mountCommandCenter = async () => {
  const router = await createMemoryRouter([
    { path: '/', component: { template: '<div />' } },
    { path: '/history', component: { template: '<div />' } },
    { path: '/libraries', component: { template: '<div />' } },
    { path: '/settings', component: { template: '<div />' } },
  ])

  const wrapper = mount(CommandCenter, {
    global: {
      plugins: [router],
      stubs: {
        RouterLink: ROUTER_LINK_STUB,
      },
    },
  })

  await flushPromises()
  await flushPromises()
  return { wrapper, router }
}

const createLiveStats = () => ({
  queue: { pending: 2, processing: 1, completed: 20, failed: 0 },
  gapAnalysis: { processedCount: 2847, totalCount: 6324, percentComplete: 45 },
  today: { classified: 127, avgConfidence: 89, allClassified: 139 },
  enrichment: {
    totalItems: 6324,
    completedItems: 5621,
    processingItems: 0,
    pendingItems: 0,
    deferredItems: 0,
    failedItems: 0,
    omdbEnriched: 5418,
    webSearchEnriched: 203,
    progress: 89,
    retryQueue: { total: { pending: 0 } },
  },
  health: { ai: true, worker: true },
})

describe('CommandCenter context modules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    apiMock.getLiveStats.mockResolvedValue(createLiveStats())
    apiMock.getClassificationProgress.mockResolvedValue([])
    apiMock.getQueuePending.mockResolvedValue([])
    apiMock.getQueueFailed.mockResolvedValue([])
    apiMock.getPendingClassifications.mockResolvedValue({ items: [] })
    apiMock.getAiGenerationStatus.mockResolvedValue({ isActive: false })
    apiMock.getAIUsage.mockResolvedValue({ budget: { limit: 5, used: 2.1, percentUsed: 42 } })
    apiMock.getLibraries.mockResolvedValue([
      { id: 10, name: 'TV Shows', media_type: 'tv', is_active: true, item_count: 2104 },
    ])
    apiMock.getLiveFeed.mockResolvedValue({
      items: [
          { id: 1, title: 'Toy Story 4', mediaType: 'movie', method: 'policy_engine', confidence: 98, library: 'Kids Movies', timestamp: new Date().toISOString() },
          { id: 2, title: 'Breaking Bad S01', mediaType: 'tv', method: 'policy_engine', confidence: 100, library: 'TV Shows', timestamp: new Date().toISOString() },
          { id: 3, title: 'John Wick 4', mediaType: 'movie', method: 'policy_engine', confidence: 94, library: '4K Movies', timestamp: new Date().toISOString() },
          { id: 4, title: 'The Bear', mediaType: 'tv', method: 'manual_classification', confidence: 88, library: 'TV Shows', timestamp: new Date().toISOString() },
          { id: 5, title: 'Oppenheimer', mediaType: 'movie', method: 'policy_engine', confidence: 92, library: '4K Movies', timestamp: new Date().toISOString() },
          { id: 6, title: 'Not Displayed', mediaType: 'movie', method: 'policy_engine', confidence: 90, library: 'Movies', timestamp: new Date().toISOString() },
        ],
    })
    apiMock.getMediaServerConfig.mockResolvedValue({ id: 1, name: 'Plex' })
    apiMock.getArrConfigStatus.mockResolvedValue({ incompleteConfigs: [] })
    apiMock.searchTMDB.mockResolvedValue([
      { id: 27205, media_type: 'movie', title: 'Inception', release_date: '2010-07-16' },
    ])
    apiMock.submitManualRequest.mockResolvedValue({ data: { success: true, queued: true } })
    apiMock.syncLibrary.mockResolvedValue({ data: { success: true } })
  })

  it('renders recently completed rows and today health stats', async () => {
    const { wrapper } = await mountCommandCenter()

    // New design uses Title Case
    expect(wrapper.text()).toContain('Recently Completed')
    expect(wrapper.text()).toContain('Toy Story 4')
    expect(wrapper.text()).not.toContain('Not Displayed')
    
    // Today section is collapsed by default, need to expand it
    const todayHeader = wrapper.findAll('h2').find((node) => node.text().includes("Today's Summary"))
    if (todayHeader) {
      await todayHeader.trigger('click')
      await flushPromises()
    }
    
    // Now Today stats should be visible
    expect(wrapper.text()).toContain('127 classified')
    // Status bar shows health indicators
    expect(wrapper.text()).toContain('Worker')
    expect(wrapper.text()).toContain('AI')

    const historyLink = wrapper.find('a[data-to*="history"]')
    expect(historyLink.exists()).toBe(true)
    expect(historyLink.attributes('data-to')).toContain('/history')
    expect(historyLink.attributes('data-to')).toContain('command-center')
  })

  it('renders relative time from live feed data', async () => {
    const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    apiMock.getLiveFeed.mockResolvedValueOnce({
      items: [{ id: 81, title: 'Old Item', mediaType: 'movie', method: 'policy_engine', confidence: 90, library: 'Movies', timestamp: oldTimestamp }],
    })

    const { wrapper } = await mountCommandCenter()
    expect(wrapper.text()).toContain('1h ago')
  })

  it('supports quick add search and submit from command center', async () => {
    const { wrapper, router } = await mountCommandCenter()

    // Quick Add section needs to be expanded first (it's collapsed by default)
    const quickAddHeader = wrapper.findAll('h2').find((node) => node.text().includes('Quick Add'))
    expect(quickAddHeader).toBeDefined()
    
    // Click to expand Quick Add section
    const quickAddSection = quickAddHeader.element.closest('.secondary-section')
    if (quickAddSection) {
      await quickAddHeader.trigger('click')
      await flushPromises()
    }

    // Find the search input (may need to look more broadly)
    const searchInput = wrapper.find('input[placeholder="Search TMDB..."]')
    await searchInput.setValue('Inception')
    const searchButton = wrapper.findAll('button').find((node) => node.text() === 'Search')
    expect(searchButton).toBeDefined()
    await searchButton.trigger('click')
    await flushPromises()

    expect(apiMock.searchTMDB).toHaveBeenCalledWith('Inception', 'multi')
    expect(wrapper.text()).toContain('Inception')

    const resultButton = wrapper.findAll('button').find((node) => node.text().includes('Inception'))
    expect(resultButton).toBeDefined()
    await resultButton.trigger('click')
    await flushPromises()

    const addButton = wrapper.findAll('button').find((node) => node.text() === 'Add')
    expect(addButton).toBeDefined()
    await addButton.trigger('click')
    await flushPromises()

    expect(apiMock.submitManualRequest).toHaveBeenCalledWith({
      tmdbId: 27205,
      mediaType: 'movie',
      title: 'Inception',
    })
    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('clears stale quick add selection when the query changes', async () => {
    const { wrapper } = await mountCommandCenter()

    const quickAddHeader = wrapper.findAll('h2').find((node) => node.text().includes('Quick Add'))
    expect(quickAddHeader).toBeDefined()
    await quickAddHeader.trigger('click')
    await flushPromises()

    const searchInput = wrapper.find('input[placeholder="Search TMDB..."]')
    await searchInput.setValue('Inception')

    const searchButton = wrapper.findAll('button').find((node) => node.text() === 'Search')
    expect(searchButton).toBeDefined()
    await searchButton.trigger('click')
    await flushPromises()

    const resultButton = wrapper.findAll('button').find((node) => node.text().includes('Inception'))
    expect(resultButton).toBeDefined()
    await resultButton.trigger('click')
    await flushPromises()

    const addButton = wrapper.findAll('button').find((node) => node.text() === 'Add')
    expect(addButton).toBeDefined()
    expect(addButton.attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('Selected: Inception')

    await searchInput.setValue('Interstellar')
    await flushPromises()

    expect(addButton.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('Selected: Inception')
    expect(wrapper.text()).not.toContain('was added to the queue')
  })

  it('renders library stats with manage-libraries navigation', async () => {
    const { wrapper } = await mountCommandCenter()
    
    // Libraries section is expanded by default, content should be visible
    expect(wrapper.text()).toContain('TV Shows')
    expect(wrapper.text()).toContain('2,104 items')
    expect(wrapper.text()).toContain('+2 today')
    const manageLink = wrapper.findAll('a').find((node) => node.text().includes('Manage'))
    expect(manageLink).toBeDefined()
  })

  it('shows configure media server CTA when setup is incomplete', async () => {
    apiMock.getMediaServerConfig.mockResolvedValueOnce(null)
    apiMock.getArrConfigStatus.mockResolvedValueOnce({
      incompleteConfigs: [{ type: 'Radarr', id: 1, missingField: 'quality_profile_id' }],
    })

    const { wrapper } = await mountCommandCenter()
    expect(wrapper.text()).toContain('Configure Media Server')
    expect(wrapper.text()).toContain('full library routing')
  })

  it('does not emit console errors during context-module interactions', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper } = await mountCommandCenter()

    // Quick Add section needs to be expanded
    const quickAddHeader = wrapper.findAll('h2').find((node) => node.text().includes('Quick Add'))
    if (quickAddHeader) {
      await quickAddHeader.trigger('click')
      await flushPromises()
    }

    const searchInput = wrapper.find('input[placeholder="Search TMDB..."]')
    await searchInput.setValue('Inception')
    const searchButton = wrapper.findAll('button').find((node) => node.text() === 'Search')
    expect(searchButton).toBeDefined()
    await searchButton.trigger('click')
    await flushPromises()

    const resultButton = wrapper.findAll('button').find((node) => node.text().includes('Inception'))
    expect(resultButton).toBeDefined()
    await resultButton.trigger('click')
    await flushPromises()

    const addButton = wrapper.findAll('button').find((node) => node.text() === 'Add')
    expect(addButton).toBeDefined()
    await addButton.trigger('click')
    await flushPromises()

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
