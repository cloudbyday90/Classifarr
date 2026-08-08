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

const createNativePendingQuestion = (overrides = {}) => ({
  version: 'policy.runtime_question_persistence.v1',
  question: 'Is TV Shows the right destination?',
  runtimeQuestion: { contractVersion: 'policy.runtime_question_reduction.v1' },
  runtimeQuestionReductionPlan: { version: 'policy.runtime_question_reduction.v1' },
  options: [
    {
      label: 'Resolve current item',
      outcomeId: 'resolve_current_item',
      library_id: 10,
      library_name: 'TV Shows',
    },
    {
      label: 'Do not learn',
      outcomeId: 'do_not_learn',
    },
  ],
  meta: {
    runtime_question_persistence: {
      destinationLibraryId: 10,
      destinationLibraryName: 'TV Shows',
    },
  },
  ...overrides,
})

const createPolicyQuestionAnswer = ({
  fingerprint = 'current-contract-fingerprint',
  destinations = [{ library_id: 10, library_name: 'TV Shows' }],
  recommendation = undefined,
  question = undefined,
  decisionSummary = undefined,
} = {}) => ({
  version: 'policy.runtime_question_answer.v1',
  fingerprint,
  candidate_destinations: destinations,
  ...(question ? { question } : {}),
  ...(decisionSummary ? { decision_summary: decisionSummary } : {}),
  recommendation: recommendation === undefined ? {
    version: 'policy.runtime_question_recommendation_presentation.v1',
    status_id: 'leading_candidate_available',
    leading_destination: {
      library_id: destinations[0]?.library_id,
      library_name: destinations[0]?.library_name,
      evidence_score: 75,
    },
    why_not_automatic: {
      reason_id: 'missing_identity_evidence',
      message: 'A score alone does not establish destination identity automatically.',
    },
  } : recommendation,
  allowed_actions: [
    {
      id: 'confirm_destination',
      available: true,
      destination_required: true,
      destination_scope: 'candidate_destinations',
    },
    {
      id: 'change_destination',
      available: true,
      destination_required: true,
      destination_scope: 'active_matching_media_type',
    },
    {
      id: 'route_not_applicable',
      available: true,
      destination_required: true,
      destination_scope: 'active_matching_media_type',
    },
  ],
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
        currentStage: 'queued',
        stageIndex: 1,
        totalStages: 8,
        progress: 3,
        stageDuration: 120,
        stages: [
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
          policy_question_answer: createPolicyQuestionAnswer(),
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
    expect(wrapper.text()).toContain('This question must be refreshed before it can be resolved.')
    const buttonLabels = wrapper.findAll('button').map(node => node.text())
    expect(buttonLabels).toContain('Retry Classification')
    expect(buttonLabels).not.toContain('Confirm')
  })

  it('renders server-provided destination controls rather than prompt labels', async () => {
    const wrapper = await mountCommandCenter()
    const buttonLabels = wrapper.findAll('button').map((node) => node.text())
    expect(buttonLabels).toContain('Confirm TV Shows')
    expect(buttonLabels).not.toContain('Yes')
    expect(buttonLabels).not.toContain('No')
  })

  it('renders the bounded native current-destination outcome without an inferred leading recommendation', async () => {
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      items: [{
        id: 203,
        title: 'Native Review',
        media_type: 'tv',
        confidence: 55,
        policy_question: createNativePendingQuestion(),
        policy_question_answer: createPolicyQuestionAnswer({
          recommendation: null,
          question: { type: 'native_runtime_question' },
        }),
      }],
    })

    const wrapper = await mountCommandCenter()
    const buttonLabels = wrapper.findAll('button').map(node => node.text())

    expect(buttonLabels).toEqual(expect.arrayContaining([
      'Confirm TV Shows',
      'Choose a different destination',
      'Retry Classification',
    ]))
    expect(wrapper.text()).toContain('Current destination')
    expect(buttonLabels).not.toContain('Use TV Shows')
    expect(buttonLabels).not.toContain('Do not learn')
  })

  it('fails closed to retry when native presentation data is incomplete', async () => {
    const malformedQuestion = createNativePendingQuestion({
      options: [{
        label: 'Resolve current item',
        outcomeId: 'resolve_current_item',
        library_id: 10,
      }],
    })
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      items: [{
        id: 206,
        title: 'Malformed Native Review',
        media_type: 'tv',
        confidence: 55,
        policy_question: malformedQuestion,
      }],
    })

    const wrapper = await mountCommandCenter()
    const buttonLabels = wrapper.findAll('button').map(node => node.text())

    expect(wrapper.text()).toContain('must be refreshed before it can be resolved')
    expect(buttonLabels).toContain('Retry Classification')
    expect(buttonLabels).not.toContain('Confirm')
    expect(buttonLabels).not.toContain('Resolve current item')
  })

  it('resolves a native runtime question through its server-owned answer contract', async () => {
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      items: [{
        id: 204,
        title: 'Native Outcome',
        media_type: 'tv',
        confidence: 55,
        policy_question: createNativePendingQuestion(),
        policy_question_answer: createPolicyQuestionAnswer({
          recommendation: null,
          question: { type: 'native_runtime_question' },
        }),
      }],
    })
    apiMock.resolvePendingClassification.mockResolvedValueOnce({ data: { routed: true } })

    const wrapper = await mountCommandCenter()
    const resolveDestination = wrapper.findAll('button')
      .find(node => node.text() === 'Confirm TV Shows')

    await resolveDestination.trigger('click')
    await flushPromises()

    expect(apiMock.resolvePendingClassification).toHaveBeenCalledWith(204, {
      contract_version: 'policy.runtime_question_answer.v1',
      contract_fingerprint: 'current-contract-fingerprint',
      action_id: 'confirm_destination',
      destination_library_id: 10,
    })
  })

  it('submits a manual destination change with the declared contract action', async () => {
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      items: [{
        id: 205,
        title: 'Native Alternative',
        media_type: 'tv',
        confidence: 55,
        policy_question: createNativePendingQuestion(),
        policy_question_answer: createPolicyQuestionAnswer({
          recommendation: null,
          question: { type: 'native_runtime_question' },
        }),
      }],
    })
    apiMock.resolvePendingClassification.mockResolvedValueOnce({ data: { routed: true } })

    const wrapper = await mountCommandCenter()
    const changeDestination = wrapper.findAll('button')
      .find(node => node.text() === 'Choose a different destination')
    await changeDestination.trigger('click')
    await flushPromises()

    const select = wrapper.find('.change-select')
    await select.setValue('10')
    const resolveButton = wrapper.findAll('button').find(node => node.text() === 'Resolve')
    await resolveButton.trigger('click')
    await flushPromises()

    expect(apiMock.resolvePendingClassification).toHaveBeenCalledWith(205, {
      contract_version: 'policy.runtime_question_answer.v1',
      contract_fingerprint: 'current-contract-fingerprint',
      action_id: 'change_destination',
      destination_library_id: 10,
    })
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
    expect(wrapper.text()).toContain('Policy question data is unavailable')
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
    const resolveDestination = wrapper.findAll('button')
      .find((node) => node.text() === 'Confirm TV Shows')

    expect(resolveDestination).toBeTruthy()
    await resolveDestination.trigger('click')
    await flushPromises()

    expect(apiMock.resolvePendingClassification).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Resolved "Motorvalley" but routing did not complete (missing_tvdb_id).')
  })

  it('renders a single leading confirmation and keeps other candidates deliberate', async () => {
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      items: [{
        id: 251,
        title: 'Deep Water',
        year: 2006,
        media_type: 'movie',
        confidence: 75,
        policy_question: {
          question: 'Is there enough evidence to treat this as a match?',
          options: [
            { library_id: 8, library_name: 'Movies' },
            { library_id: 9, library_name: 'Anime Movies' },
          ],
        },
        policy_question_answer: createPolicyQuestionAnswer({
          fingerprint: 'deep-water-contract-fingerprint',
          destinations: [
            { library_id: 8, library_name: 'Movies' },
            { library_id: 9, library_name: 'Anime Movies' },
          ],
          recommendation: {
            version: 'policy.runtime_question_recommendation_presentation.v1',
            status_id: 'leading_candidate_available',
            leading_destination: {
              library_id: 8,
              library_name: 'Movies',
              evidence_score: 75,
            },
            why_not_automatic: {
              reason_id: 'missing_identity_evidence',
              message: 'A score alone does not establish destination identity automatically.',
            },
          },
          decisionSummary: {
            version: 'policy.runtime_question_decision_presentation.v1',
            deterministic: {
              status_id: 'confirmation_required',
              destination: { library_id: 8, library_name: 'Movies' },
              score: 75,
              review_threshold: 60,
              automatic_threshold: 85,
              message: 'Movies meets the confirmation threshold but not the automatic threshold.',
              evidence: [
                { id: 'declared_intent', label: 'Declared policy intent supports Movies.' },
                { id: 'similar_items', label: 'Similar items already associated with Movies support this match.' },
              ],
            },
            ai_advisory: {
              status_id: 'alternative_selected',
              message: 'The model proposed "Anime Movies" instead of "Movies". The deterministic policy candidate was retained.',
              proposed_destination: { library_id: 9, library_name: 'Anime Movies' },
            },
          },
        }),
      }],
    })

    const wrapper = await mountCommandCenter()

    expect(wrapper.text()).toContain('Leading candidate')
    expect(wrapper.text()).toContain('Policy score: 75/100 (confirmation at 60, automatic at 85)')
    expect(wrapper.text()).toContain('Policy confirmation required')
    expect(wrapper.text()).toContain('Confirm Movies or choose a different destination.')
    expect(wrapper.text()).not.toContain('A score alone does not establish destination identity automatically.')
    expect(wrapper.text()).toContain('Why review is needed')
    expect(wrapper.text()).toContain('Declared policy intent supports Movies.')
    expect(wrapper.text()).toContain('Similar items already associated with Movies support this match.')
    expect(wrapper.findAll('button').some(node => node.text() === 'Confirm Movies')).toBe(true)
    expect(wrapper.text()).toContain('Review 1 alternative candidate')
    expect(wrapper.find('details').element.open).toBe(false)

    const confirmButton = wrapper.findAll('button').find(node => node.text() === 'Confirm Movies')
    await confirmButton.trigger('click')
    await flushPromises()

    expect(apiMock.resolvePendingClassification).toHaveBeenCalledWith(251, {
      contract_version: 'policy.runtime_question_answer.v1',
      contract_fingerprint: 'deep-water-contract-fingerprint',
      action_id: 'confirm_destination',
      destination_library_id: 8,
    })
  })

  it('shows routing error when manual change resolves but routing fails', async () => {
    apiMock.resolvePendingClassification.mockResolvedValueOnce({
      data: { routed: false, routingError: 'Sonarr API connection failed' },
    })

    const wrapper = await mountCommandCenter()
    const changeButton = wrapper.findAll('button')
      .find((node) => node.text() === 'Choose a different destination')

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

    expect(apiMock.resolvePendingClassification).toHaveBeenCalledWith(201, {
      contract_version: 'policy.runtime_question_answer.v1',
      contract_fingerprint: 'current-contract-fingerprint',
      action_id: 'change_destination',
      destination_library_id: 10,
    })
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
            policy_question_answer: createPolicyQuestionAnswer(),
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
            policy_question_answer: createPolicyQuestionAnswer({
              fingerprint: 'movie-contract-fingerprint',
              destinations: [{ library_id: 8, library_name: 'Movies' }],
            }),
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

  it('skips questions without a current confirm action when confirming all', async () => {
    apiMock.getPendingClassifications.mockResolvedValueOnce({
      items: [
        {
          id: 207,
          title: 'Legacy Review',
          media_type: 'tv',
          confidence: 55,
          policy_question: {
            question: 'Does this belong in TV Shows?',
            options: [{ label: 'Yes', value: 'yes', library_id: 10 }],
          },
          policy_question_answer: createPolicyQuestionAnswer(),
        },
        {
          id: 208,
          title: 'Native Review',
          media_type: 'tv',
          confidence: 55,
          policy_question: createNativePendingQuestion(),
        },
      ],
    })
    apiMock.resolvePendingClassification.mockResolvedValueOnce({ data: { routed: true } })

    const wrapper = await mountCommandCenter()
    const confirmAllButton = wrapper.findAll('button').find(node => node.text() === 'Confirm All')
    await confirmAllButton.trigger('click')
    await flushPromises()

    expect(apiMock.resolvePendingClassification).toHaveBeenCalledTimes(1)
    expect(apiMock.resolvePendingClassification).toHaveBeenCalledWith(207, {
      contract_version: 'policy.runtime_question_answer.v1',
      contract_fingerprint: 'current-contract-fingerprint',
      action_id: 'confirm_destination',
      destination_library_id: 10,
    })
    expect(wrapper.text()).toContain('Confirm All skipped 1 item without a current leading recommendation')
  })

  it('retries a single needs-attention classification', async () => {
    const wrapper = await mountCommandCenter()
    const retryButton = wrapper.findAll('button').find((node) => node.text() === 'Retry Classification')

    expect(retryButton).toBeTruthy()
    await retryButton.trigger('click')
    await flushPromises()

    expect(apiMock.retryClassifications).toHaveBeenCalledWith([201])
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

    expect(apiMock.retryClassifications).toHaveBeenCalledWith([201, 202])
  })
})
