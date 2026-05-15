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
    metadata: {
      classification_details: {
        rag_loop_trace: {
          mode: 'apply',
          ran: true,
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
    expect(wrapper.text()).toContain('Linked Outcome')
    expect(wrapper.text()).toContain('Discord Verification')
    expect(wrapper.text()).toContain('Verified')
    expect(wrapper.text()).toContain('TV Shows')
    expect(wrapper.text()).toContain('Recorded:')
    expect(wrapper.text()).toContain('Transitions: 2')
    expect(wrapper.text()).toContain('First:')
    expect(wrapper.text()).toContain('Manual Retry')
  })
})
