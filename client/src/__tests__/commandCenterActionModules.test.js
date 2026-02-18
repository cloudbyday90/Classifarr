/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
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

const mountCommandCenter = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()

  const wrapper = mount(CommandCenter, {
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

const createLiveStats = () => ({
  queue: { pending: 3, processing: 1, completed: 9, failed: 1 },
  gapAnalysis: { processedCount: 2847, totalCount: 6324, percentComplete: 45 },
  enrichment: {
    totalItems: 6324,
    enriched: 5621,
    omdbEnriched: 5418,
    tavilyEnriched: 203,
    progress: 89,
    retryQueue: { total: { pending: 2 } },
  },
  health: { ai: true, worker: true },
})

describe('CommandCenter action modules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getLiveStats.mockResolvedValue({ data: createLiveStats() })
    apiMock.getClassificationProgress.mockResolvedValue({
      data: [{
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
      }],
    })
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
      data: {
        items: [{
          id: 201,
          title: 'Motorvalley',
          year: 2026,
          media_type: 'tv',
          confidence: 22.72,
          policy_question: {
            question: 'Does this belong in TV Shows?',
            why_uncertain: 'Conflicting signals',
            options: [
              { label: 'Yes', value: 'yes', library_id: 10 },
              { label: 'No', value: 'no', library_id: 8 },
            ],
          },
        }],
      },
    })
    apiMock.getOllamaStatus.mockResolvedValue({ data: { isActive: false } })
    apiMock.getAIUsage.mockResolvedValue({ data: { budget: { limit: 5, used: 4.6, percentUsed: 92 } } })
    apiMock.getLibraries.mockResolvedValue({ data: [{ id: 10, name: 'TV Shows', media_type: 'tv', is_active: true }] })
    apiMock.getLiveFeed.mockResolvedValue({ data: { items: [] } })
    apiMock.getMediaServerConfig.mockResolvedValue({ data: { id: 1, name: 'Plex' } })
    apiMock.get.mockResolvedValue({ data: { incompleteConfigs: [] } })
  })

  it('renders module headers and unresolved counts from live data', async () => {
    const wrapper = await mountCommandCenter()

    // New design uses Title Case headers
    expect(wrapper.text()).toContain('Processing')
    expect(wrapper.text()).toContain('Needs Attention')
    expect(wrapper.text()).toContain('Errors')
    expect(wrapper.text()).toContain('AI budget at 92%')
  })

  it('renders explicit Yes/No controls for binary policy prompts', async () => {
    const wrapper = await mountCommandCenter()
    const buttonLabels = wrapper.findAll('button').map((node) => node.text())
    expect(buttonLabels).toContain('Yes')
    expect(buttonLabels).toContain('No')
  })

  it('shows policy fallback copy when policy_question payload is missing', async () => {
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      data: {
        items: [{
          id: 999,
          title: 'No Prompt Title',
          media_type: 'movie',
          confidence: 40,
          policy_question: null,
        }],
      },
    })

    const wrapper = await mountCommandCenter()
    // New design has slightly different copy
    expect(wrapper.text()).toContain('Policy question data unavailable')
  })

  it('renders locked 8-step phase list in processing panel', async () => {
    apiMock.getClassificationProgress.mockResolvedValueOnce({
      data: [{
        taskId: 11,
        title: 'Partial Payload Item',
        currentPhase: 'queued',
        phaseIndex: 1,
        totalPhases: 8,
        progress: 5,
        phaseDuration: 80,
        phases: [{ name: 'queued', status: 'in_progress' }],
      }],
    })

    const wrapper = await mountCommandCenter()

    // Phase stepper is now inline in processing panel
    const text = wrapper.text()
    expect(text).toContain('Queued')
    expect(text).toContain('Metadata Fetch')
    expect(text).toContain('Policy Evaluation')
    expect(text).toContain('RAG Analysis')
    expect(text).toContain('Signal Combination')
    expect(text).toContain('AI Analysis')
    expect(text).toContain('Decision')
    expect(text).toContain('Notification')
  })

  it('renders skipped signal combine state when backend marks it skipped', async () => {
    apiMock.getClassificationProgress.mockResolvedValueOnce({
      data: [{
        taskId: 12,
        title: 'Policy Prompt Item',
        currentPhase: 'decision',
        phaseIndex: 7,
        totalPhases: 8,
        progress: 88,
        phaseDuration: 210,
        phases: [
          { name: 'queued', label: 'Queued', status: 'complete', duration_ms: 12 },
          { name: 'metadata_fetch', label: 'Metadata Fetch', status: 'complete', duration_ms: 80 },
          { name: 'policy_eval', label: 'Policy Evaluation', status: 'complete', duration_ms: 140 },
          { name: 'rag_analysis', label: 'RAG Analysis', status: 'complete', duration_ms: 95 },
          { name: 'signal_combine', label: 'Signal Combination', status: 'skipped' },
          { name: 'ai_analysis', label: 'AI Analysis', status: 'complete', duration_ms: 340 },
          { name: 'decision', label: 'Decision', status: 'in_progress' },
        ],
      }],
    })

    const wrapper = await mountCommandCenter()

    expect(wrapper.find('.stepper-skipped').exists()).toBe(true)
    expect(wrapper.text()).toContain('Signal Combination')
    expect(wrapper.text()).toContain('skipped')
  })

  it('shows Up Next count from classification pending tasks only', async () => {
    apiMock.getLiveStats.mockResolvedValueOnce({
      data: {
        ...createLiveStats(),
        queue: { pending: 0, processing: 0, completed: 12, failed: 0 },
      },
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

    expect(text).toContain('Up Next (1)')
    expect(text).toContain('Classification Task')
    expect(text).not.toContain('Metadata Only Task')
  })
})
