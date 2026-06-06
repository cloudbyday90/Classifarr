/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import History from '@/views/History.vue'

const { apiMock, librariesStoreMock, showLockdownNotificationMock } = vi.hoisted(() => ({
  apiMock: {
    getHistory: vi.fn(),
    submitCorrection: vi.fn(),
  },
  librariesStoreMock: {
    libraries: [
      { id: 1, name: 'TV Shows', media_type: 'tv' },
      { id: 2, name: '4K Movies', media_type: 'movie' },
    ],
    fetchLibraries: vi.fn(),
  },
  showLockdownNotificationMock: vi.fn(),
}))

vi.mock('@/api', () => ({
  default: apiMock,
}))

vi.mock('@/stores/libraries', () => ({
  useLibrariesStore: () => librariesStoreMock,
}))

vi.mock('@/composables/useServiceRequirements', () => ({
  useServiceRequirements: () => ({
    canUseFeature: ref(true),
    lockdownTooltip: ref(null),
    firstUnavailableService: ref(null),
  }),
}))

vi.mock('@/composables/useServiceLockdownToast', () => ({
  useServiceLockdownDialog: () => ({
    showLockdownNotification: showLockdownNotificationMock,
  }),
}))

const baseHistoryRows = [
  {
    id: 101,
    title: 'The Bear S03',
    year: 2024,
    media_type: 'tv',
    library_id: 1,
    library_name: 'TV Shows',
    method: 'policy_engine',
    confidence: 92,
    created_at: '2026-02-13T10:00:00.000Z',
    history_event_count: 3,
    history_events: [
      {
        id: 99,
        method: 'policy_recheck',
        status: 'reclassified',
        confidence: 72,
        library_name: null,
        reason: 'Policy re-check upgraded confidence',
        created_at: '2026-02-13T09:45:00.000Z',
        is_final: false,
      },
      {
        id: 101,
        method: 'policy_engine',
        status: 'routed',
        confidence: 92,
        library_name: 'TV Shows',
        reason: 'Final policy outcome',
        created_at: '2026-02-13T10:00:00.000Z',
        is_final: true,
      },
      {
        id: 102,
        method: 'source_library',
        status: 'completed',
        confidence: 100,
        library_name: 'TV Shows',
        reason: 'Already in library: TV Shows',
        created_at: '2026-02-13T11:00:00.000Z',
        is_final: false,
      },
    ],
    metadata: {
      classification_details: {
        candidate_diagnostics: {
          primary_viability: 'multi_source_support',
          profile_scoring: {
            schema_version: 1,
            available: true,
            media_type: 'tv',
            raw_score: 45,
            final_score: 95,
            rating: {
              input: '16',
              normalized: 'TV-MA',
              distribution_percent: 72,
              score_delta: 30,
              matched: true,
            },
            genres: {
              input_count: 2,
              matched: [
                { value: 'Comedy', distribution_percent: 30, score_delta: 9 },
              ],
              unmatched: ['Workplace'],
            },
            keywords: {
              input_count: 1,
              matched: [
                { value: 'office', distribution_percent: 18, score_delta: 5 },
              ],
              unmatched: [],
            },
            exclusions: {
              ratings: [],
              genres: [],
              keywords: [],
            },
          },
        },
        rag_loop_trace: {
          mode: 'apply',
          ran: true,
          trace_context: {
            schema_version: 1,
            trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
            root_span_id: '00f067aa0ba902b7',
            trace_flags: '00',
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00',
            correlation_id: '95f95cb5-fce5-4d84-9ac4-5f2838f307f4',
          },
          trigger: 'ai_low_confidence',
          strategy: 'hybrid',
          diagnostics: {
            pass1: { top_similarity: 0.62 },
            pass2: { top_similarity: 0.81 }
          },
          decision: {
            outcome: 'pass2',
            reason: 'policy_upgrade'
          },
          events: [
            { stage: 'gate', outcome: 'run', reason_code: 'ai_low_confidence' },
            { stage: 'retrieval_pass2', outcome: 'applied', reason_code: 'hybrid' }
          ]
        },
        decision_trace: {
          schema_version: 1,
          trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
          root_span_id: '00f067aa0ba902b7',
          trace_flags: '00',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00',
          correlation_id: '95f95cb5-fce5-4d84-9ac4-5f2838f307f4',
          stages: [
            { name: 'classification', outcome: 'completed', reason_code: 'policy_engine', duration_ms: 1600 },
            { name: 'rag_loop', outcome: 'pass2', reason_code: 'policy_upgrade', duration_ms: 1400 },
          ],
          spans: [
            {
              name: 'retrieval_pass2',
              span_id: '1111111111111111',
              parent_span_id: '00f067aa0ba902b7',
              duration_ms: 405,
              outcome: 'applied',
              reason_code: 'hybrid',
            },
            {
              name: 'policy_recheck',
              span_id: '2222222222222222',
              parent_span_id: '00f067aa0ba902b7',
              duration_ms: 1200,
              outcome: 'accepted',
              reason_code: 'policy_upgrade',
            },
          ],
        },
        rag_evidence: {
          schema_version: 1,
          pass1: [
            {
              title: 'Original Neighbor',
              year: 2023,
              library_id: 1,
              library_name: 'TV Shows',
              similarity: 0.62
            }
          ],
          pass2: [
            {
              title: 'Improved Neighbor',
              year: 2024,
              library_id: 1,
              library_name: 'TV Shows',
              similarity: 0.81
            }
          ],
          library_counts: {
            pass1: [{ library_id: 1, library_name: 'TV Shows', count: 1, max_similarity: 0.62 }],
            pass2: [{ library_id: 1, library_name: 'TV Shows', count: 1, max_similarity: 0.81 }]
          }
        },
        outcome_link: {
          type: 'verified',
          source: 'discord_verification',
          actor: 'mod-user',
          final_library_name: 'TV Shows',
          recorded_at: '2026-02-13T10:15:00.000Z',
          updated_at: '2026-02-13T10:15:00.000Z'
        },
        outcome_path: {
          first_type: 'retried',
          latest_type: 'verified',
          first_source: 'manual_retry',
          latest_source: 'discord_verification',
          first_recorded_at: '2026-02-13T10:05:00.000Z',
          latest_updated_at: '2026-02-13T10:15:00.000Z',
          transition_count: 2
        }
      }
    },
  },
  {
    id: 202,
    title: 'Oppenheimer',
    year: 2023,
    media_type: 'movie',
    library_id: 2,
    library_name: '4K Movies',
    method: 'manual_classification',
    confidence: 71,
    created_at: '2026-02-13T09:30:00.000Z',
    metadata: {},
  },
]

const mountHistory = async () => {
  const wrapper = mount(History, {
    global: {
      stubs: {
        Card: { template: '<div><slot /></div>' },
        Badge: { template: '<span><slot /></span>' },
        Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        BatchReclassifyModal: { template: '<div />' },
        LibraryProfilePanel: { template: '<div />' },
        SignalRow: { template: '<div />' },
      },
    },
  })

  await flushPromises()
  await flushPromises()
  return wrapper
}

describe('History enhancements behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    librariesStoreMock.fetchLibraries.mockResolvedValue()
    apiMock.getHistory.mockResolvedValue({
      data: baseHistoryRows,
      pagination: {
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      },
    })
  })

  it('applies stacked filters in history request params', async () => {
    const wrapper = await mountHistory()

    await wrapper.find('input[placeholder="Search title..."]').setValue('Bear')
    await wrapper.find('select').setValue('tv')

    const allSelects = wrapper.findAll('select')
    await allSelects[1].setValue('1')
    await allSelects[2].setValue('policy_engine')
    const datesButton = wrapper.findAll('button').find((node) => node.text() === 'Dates')
    expect(datesButton).toBeDefined()
    await datesButton.trigger('click')
    await flushPromises()

    const dateInputs = wrapper.findAll('input[type="date"]')
    expect(dateInputs.length).toBe(2)
    await dateInputs[0].setValue('2026-02-10')
    await dateInputs[1].setValue('2026-02-12')

    const applyButton = wrapper.findAll('button').find((node) => node.text() === 'Apply')
    expect(applyButton).toBeDefined()
    await applyButton.trigger('click')
    await flushPromises()

    expect(apiMock.getHistory).toHaveBeenLastCalledWith({
      page: 1,
      limit: 50,
      search: 'Bear',
      media_type: 'tv',
      library_id: '1',
      method: 'policy_engine',
      date_from: '2026-02-10',
      date_to: '2026-02-12',
    })
  })

  it('switches selection action label between Reclassify and Batch Reclassify', async () => {
    const wrapper = await mountHistory()

    const rowCheckboxes = wrapper.findAll('tbody input[type="checkbox"]')
    expect(rowCheckboxes.length).toBe(2)

    await rowCheckboxes[0].setValue(true)
    await flushPromises()
    expect(wrapper.text()).toContain('Reclassify')
    expect(wrapper.text()).not.toContain('Batch Reclassify')

    await rowCheckboxes[1].setValue(true)
    await flushPromises()
    expect(wrapper.text()).toContain('Batch Reclassify')
  })

  it('shows second-pass trace and linked outcome in the detail modal', async () => {
    const wrapper = await mountHistory()

    const firstTitleCell = wrapper.find('tbody tr td:nth-child(2)')
    await firstTitleCell.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Targeted Re-check Trace')
    expect(wrapper.text()).toContain('Decision Trace')
    expect(wrapper.text()).toContain('4bf92f3577...0e4736')
    expect(wrapper.text()).toContain('95f95cb5-f...f307f4')
    expect(wrapper.text()).toContain('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00')
    expect(wrapper.text()).toContain('classification: completed')
    expect(wrapper.text()).toContain('Child spans')
    expect(wrapper.text()).toContain('retrieval_pass2')
    expect(wrapper.text()).toContain('405ms')
    expect(wrapper.text()).toContain('1.20s')
    expect(wrapper.text()).toContain('RAG Evidence Snapshot')
    expect(wrapper.text()).toContain('Improved Neighbor')
    expect(wrapper.text()).toContain('max 81%')
    expect(wrapper.text()).toContain('Linked Outcome')
    expect(wrapper.text()).toContain('Discord Verification')
    expect(wrapper.text()).toContain('Verified')
    expect(wrapper.text()).toContain('TV Shows')
    expect(wrapper.text()).toContain('Recorded:')
    expect(wrapper.text()).toContain('Transitions: 2')
    expect(wrapper.text()).toContain('First:')
    expect(wrapper.text()).toContain('Manual Retry')
    expect(wrapper.text()).toContain('Profile Scoring Detail')
    expect(wrapper.text()).toContain('TV-MA')
    expect(wrapper.text()).toContain('Comedy 30% (+9)')
    expect(wrapper.text()).toContain('office 18% (+5)')
  })

  it('shows attempts and sync observations under the final outcome', async () => {
    const wrapper = await mountHistory()

    const firstTitleCell = wrapper.find('tbody tr td:nth-child(2)')
    await firstTitleCell.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Classification Lifecycle')
    expect(wrapper.text()).toContain('Policy Recheck')
    expect(wrapper.text()).toContain('Final outcome')
    expect(wrapper.text()).toContain('Source Library')
    expect(wrapper.text()).toContain('Already in library: TV Shows')
  })
})
