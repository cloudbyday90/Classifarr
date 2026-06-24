/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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
    retryClassifications: vi.fn(),
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
  const router = await createMemoryRouter([{ path: '/', component: { template: '<div />' } }])

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
  return wrapper
}

const createLiveStats = () => ({
  queue: { pending: 3, processing: 1, completed: 9, failed: 1, classificationPaused: false, classificationPauseReason: null },
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
    completedItems: 5621,
    processingItems: 0,
    pendingItems: 0,
    deferredItems: 0,
    failedItems: 0,
    omdbEnriched: 5418,
    webSearchEnriched: 203,
    progress: 89,
    retryQueue: { total: { pending: 2 } },
  },
  health: { ai: true, worker: true },
})

describe('CommandCenter action modules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getLiveStats.mockResolvedValue(createLiveStats())
    apiMock.getClassificationProgress.mockResolvedValue([
      {
        taskId: 10,
        title: 'Inception',
        year: 2010,
        mediaType: 'movie',
        currentPhase: 'queued',
        phaseIndex: 1,
        totalPhases: 8,
        progress: 3,
        phaseDuration: 120,
        phases: [
          { name: 'queued', label: 'Queued', status: 'in_progress' },
          { name: 'metadata_fetch', label: 'Metadata Fetch', status: 'pending' },
        ],
      },
    ])
    apiMock.getQueuePending.mockResolvedValue([{
      id: 33,
      task_type: 'classification',
      status: 'pending',
      attempts: 0,
      max_attempts: 5,
      created_at: new Date().toISOString(),
      payload: { title: 'The Bear S03', media: { media_type: 'tv' } },
    }])
    apiMock.getQueueFailed.mockResolvedValue([{
      id: 77,
      task_type: 'classification',
      status: 'failed',
      error_message: 'AI timeout',
      created_at: new Date().toISOString(),
      payload: { title: 'The Matrix 5' },
    }])
    apiMock.getPendingClassifications.mockResolvedValue({
      items: [{
          id: 201,
          title: 'Motorvalley',
          year: 2026,
          media_type: 'tv',
          confidence: 22.72,
          policy_question_stale: false,
          policy_question: {
            question: 'Does this belong in TV Shows?',
            why_uncertain: 'Conflicting signals',
            options: [
              { label: 'Yes', value: 'yes', library_id: 10 },
              { label: 'No', value: 'no', library_id: 8 },
            ],
          },
        }],
    })
    apiMock.retryClassifications.mockResolvedValue({
      data: {
        queued: 1,
        skipped: 0,
        failed: 0,
        results: [{ classificationId: 201, queued: true, taskId: 9011 }],
      },
    })
    apiMock.getAiGenerationStatus.mockResolvedValue({ isActive: false })
    apiMock.getAIUsage.mockResolvedValue({ budget: { limit: 5, used: 4.6, percentUsed: 92 } })
    apiMock.getLibraries.mockResolvedValue([{ id: 10, name: 'TV Shows', media_type: 'tv', is_active: true }])
    apiMock.getLiveFeed.mockResolvedValue({ items: [] })
    apiMock.getMediaServerConfig.mockResolvedValue({ id: 1, name: 'Plex' })
    apiMock.getArrConfigStatus.mockResolvedValue({ incompleteConfigs: [] })
  })

  it('renders module headers and unresolved counts from live data', async () => {
    const wrapper = await mountCommandCenter()

    // New design uses Title Case headers
    expect(wrapper.text()).toContain('Processing')
    expect(wrapper.text()).toContain('Needs Attention')
    expect(wrapper.text()).toContain('Errors')
    expect(wrapper.text()).toContain('AI budget at 92%')
  })

  it('shows dispatch-check pause messaging without implying manual review is blocking the queue', async () => {
    apiMock.getLiveStats.mockResolvedValueOnce({
        ...createLiveStats(),
        queue: {
          pending: 4,
          processing: 0,
          completed: 9,
          failed: 1,
          classificationPaused: true,
          classificationPauseReason: 'dispatch_check_failed',
        },
    })

    const wrapper = await mountCommandCenter()

    expect(wrapper.text()).toContain('Worker Paused')
    expect(wrapper.text()).toContain('Classification dispatch is temporarily paused because the worker could not verify queue state.')
    expect(wrapper.text()).not.toContain('Waiting for your decision')
  })

  it('flags stale policy questions in needs attention items', async () => {
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      items: [{
          id: 202,
          title: 'The Lost Forest',
          year: 2024,
          media_type: 'movie',
          confidence: 18,
          policy_question_stale: true,
          policy_question: {
            question: 'Should this go to Movies?',
            why_uncertain: 'Conflicting signals',
            options: [{ label: 'Movies', value: 'movies', library_id: 8 }],
          },
        }],
    })

    const wrapper = await mountCommandCenter()

    expect(wrapper.text()).toContain('This question may be outdated because policy or library settings changed after it was generated.')
    expect(wrapper.text()).toContain('Retry Classification to refresh it before confirming.')
  })

  it('renders explicit Yes/No controls for binary policy prompts', async () => {
    const wrapper = await mountCommandCenter()
    const buttonLabels = wrapper.findAll('button').map((node) => node.text())
    expect(buttonLabels).toContain('Yes')
    expect(buttonLabels).toContain('No')
  })

  it('shows policy fallback copy when policy_question payload is missing', async () => {
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      items: [{
          id: 999,
          title: 'No Prompt Title',
          media_type: 'movie',
          confidence: 40,
          policy_question: null,
        }],
    })

    const wrapper = await mountCommandCenter()
    // New design has slightly different copy
    expect(wrapper.text()).toContain('Policy question data unavailable')
  })

  it('renders library sync coverage in the processing panel from live sync stats', async () => {
    apiMock.getClassificationProgress.mockResolvedValueOnce([])
    apiMock.getQueuePending.mockResolvedValueOnce([])
    apiMock.getLiveStats.mockResolvedValueOnce({
      ...createLiveStats(),
      queue: { pending: 0, processing: 0, completed: 9, failed: 0, classificationPaused: false, classificationPauseReason: null },
      librarySync: {
        syncedItems: 3330,
        totalItems: 6634,
        remainingItems: 3304,
        percentComplete: 50,
        isRunning: false,
        type: null,
        progress: 0,
        currentLibrary: null,
        startedAt: null,
        duration: 0,
        canInterrupt: true,
      },
    })

    const wrapper = await mountCommandCenter()

    const text = wrapper.text()
    expect(text).toContain('No active processing')
    expect(text).toContain('Library: 3,330 / 6,634 (50%)')
  })

  it('renders active Plex sync state when the backend reports a running library import', async () => {
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
    expect(wrapper.text()).toContain('3,304 waiting to sync')
    expect(wrapper.text()).toContain('Library: 3,330 / 6,634 (50%)')
  })

  it('keeps the processing panel focused on sync coverage instead of queue item titles', async () => {
    apiMock.getClassificationProgress.mockResolvedValueOnce([])
    apiMock.getLiveStats.mockResolvedValueOnce({
        ...createLiveStats(),
        queue: { pending: 0, processing: 0, completed: 12, failed: 0 },
    })
    apiMock.getQueuePending.mockResolvedValueOnce([
      {
        id: 401,
        task_type: 'metadata_enrichment',
        status: 'pending',
        payload: { title: 'Metadata Only Task' },
      },
      {
        id: 402,
        task_type: 'classification',
        status: 'pending',
        payload: { title: 'Classification Task', media: { media_type: 'movie' } },
      },
    ])

    const wrapper = await mountCommandCenter()
    const text = wrapper.text()

    expect(text).toContain('No active processing')
    expect(text).toContain('Library: 2,847 / 6,324 (45%)')
    expect(text).not.toContain('Up Next (1)')
    expect(text).not.toContain('Classification Task')
    expect(text).not.toContain('Metadata Only Task')
  })

  it('shows routing reason when policy resolution succeeds but routing is skipped', async () => {
    apiMock.resolvePendingClassification.mockResolvedValueOnce({
      data: { routed: false, routingReason: 'missing_tvdb_id' },
    })

    const wrapper = await mountCommandCenter()
    const yesButton = wrapper.findAll('button').find((node) => node.text() === 'Yes')

    expect(yesButton).toBeTruthy()
    await yesButton.trigger('click')
    await flushPromises()

    expect(apiMock.resolvePendingClassification).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Resolved "Motorvalley" but routing did not complete (missing_tvdb_id).')
  })

  it('shows routing error when manual change resolves but routing fails', async () => {
    apiMock.resolvePendingClassification.mockResolvedValueOnce({
      data: { routed: false, routingError: 'Sonarr API connection failed' },
    })

    const wrapper = await mountCommandCenter()
    const changeButton = wrapper.findAll('button').find((node) => node.text() === 'Change')

    expect(changeButton).toBeTruthy()
    await changeButton.trigger('click')
    await flushPromises()

    const select = wrapper.find('.change-select')
    expect(select.exists()).toBe(true)
    await select.setValue('10')

    const resolveButton = wrapper.findAll('button').find((node) => node.text() === 'Resolve')
    expect(resolveButton).toBeTruthy()
    await resolveButton.trigger('click')
    await flushPromises()

    expect(apiMock.resolvePendingClassification).toHaveBeenCalledWith(201, expect.objectContaining({
      library_id: 10,
      selected_option: 'Manual selection',
    }))
    expect(wrapper.text()).toContain('Resolved "Motorvalley" but routing did not complete (Sonarr API connection failed).')
  })

  it('shows batch routing warnings when confirm all resolves items but routing is skipped', async () => {
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      items: [
          {
            id: 201,
            title: 'Motorvalley',
            year: 2026,
            media_type: 'tv',
            confidence: 22.72,
            policy_question: {
              question: 'Does this belong in TV Shows?',
              options: [{ label: 'Yes', value: 'yes', library_id: 10 }],
            },
          },
          {
            id: 202,
            title: 'The Burbs',
            year: 1989,
            media_type: 'movie',
            confidence: 30,
            policy_question: {
              question: 'Movie or Family?',
              options: [{ label: 'Movies', value: 'movies', library_id: 8 }],
            },
          },
        ],
    })
    apiMock.resolvePendingClassification
      .mockResolvedValueOnce({ data: { routed: false, routingReason: 'missing_tvdb_id' } })
      .mockResolvedValueOnce({ data: { routed: true } })

    const wrapper = await mountCommandCenter()
    const confirmAllButton = wrapper.findAll('button').find((node) => node.text() === 'Confirm All')

    expect(confirmAllButton).toBeTruthy()
    await confirmAllButton.trigger('click')
    await flushPromises()

    expect(apiMock.resolvePendingClassification).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Resolved "Motorvalley" but routing did not complete (missing_tvdb_id).')
  })

  it('retries a single needs-attention classification', async () => {
    const wrapper = await mountCommandCenter()
    const retryButton = wrapper.findAll('button').find((node) => node.text() === 'Retry Classification')

    expect(retryButton).toBeTruthy()
    await retryButton.trigger('click')
    await flushPromises()

    expect(apiMock.retryClassifications).toHaveBeenCalledWith([201], { purgeLearning: true })
  })

  it('retries all needs-attention classifications from footer action', async () => {
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      items: [
          {
            id: 201,
            title: 'Motorvalley',
            year: 2026,
            media_type: 'tv',
            confidence: 22.72,
            policy_question: {
              question: 'Does this belong in TV Shows?',
              options: [{ label: 'Yes', value: 'yes', library_id: 10 }],
            },
          },
          {
            id: 202,
            title: 'The Burbs',
            year: 1989,
            media_type: 'movie',
            confidence: 30,
            policy_question: {
              question: 'Movie or Family?',
              options: [{ label: 'Movies', value: 'movies', library_id: 8 }],
            },
          },
        ],
    })
    apiMock.retryClassifications.mockResolvedValueOnce({
      data: {
        queued: 2,
        skipped: 0,
        failed: 0,
        results: [
          { classificationId: 201, queued: true, taskId: 9012 },
          { classificationId: 202, queued: true, taskId: 9013 },
        ],
      },
    })

    const wrapper = await mountCommandCenter()
    const retryAllButton = wrapper.findAll('button').find((node) => node.text() === 'Retry Classification All')

    expect(retryAllButton).toBeTruthy()
    await retryAllButton.trigger('click')
    await flushPromises()

    expect(apiMock.retryClassifications).toHaveBeenCalledWith([201, 202], { purgeLearning: true })
  })
})
