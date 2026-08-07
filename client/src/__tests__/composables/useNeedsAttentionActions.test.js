/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/api', () => ({
  default: {
    resolvePendingClassification: vi.fn(),
    retryClassifications: vi.fn(),
  },
}))

import api from '@/api'
import { useNeedsAttentionActions } from '@/composables/useNeedsAttentionActions'

function createDeps(overrides = {}) {
  return {
    activeLibraries: ref([]),
    needsAttentionItems: ref([]),
    runActionWithBusy: vi.fn(async (_key, fn) => { await fn() }),
    setActionError: vi.fn(),
    ...overrides,
  }
}

function currentAnswerContract(destinationLibraryId = 5) {
  return {
    version: 'policy.runtime_question_answer.v1',
    fingerprint: 'current-contract-fingerprint',
    candidate_destinations: [{ library_id: destinationLibraryId, library_name: 'Movies' }],
    allowed_actions: [
      {
        id: 'confirm_destination',
        available: true,
        destination_required: true,
      },
    ],
  }
}

function currentItem(id, title, destinationLibraryId = 5) {
  return {
    id,
    title,
    policy_question_answer: currentAnswerContract(destinationLibraryId),
  }
}

describe('useNeedsAttentionActions composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an answer that does not contain a current contract destination', async () => {
    const deps = createDeps()
    const actions = useNeedsAttentionActions(deps)

    await actions.resolveWithOption(currentItem(1, 'Test Movie'), {
      actionId: 'confirm_destination',
      destinationLibraryId: null,
    })

    expect(deps.setActionError).toHaveBeenCalledWith(expect.stringContaining('no longer valid'))
    expect(api.resolvePendingClassification).not.toHaveBeenCalled()
  })

  it('resolveWithOption resolves and sets routing error on partial failure', async () => {
    const deps = createDeps()
    api.resolvePendingClassification.mockResolvedValueOnce({
      data: { routed: false, routingError: 'no_library' },
    })

    const actions = useNeedsAttentionActions(deps)
    await actions.resolveWithOption(
      currentItem(2, 'Inception'),
      { actionId: 'confirm_destination', destinationLibraryId: 5 },
    )

    expect(api.resolvePendingClassification).toHaveBeenCalledWith(2, {
      contract_version: 'policy.runtime_question_answer.v1',
      contract_fingerprint: 'current-contract-fingerprint',
      action_id: 'confirm_destination',
      destination_library_id: 5,
    })
    expect(deps.setActionError).toHaveBeenCalledWith(expect.stringContaining('routing did not complete'))
  })

  it('retryNeedsAttentionItem throws when result is not queued', async () => {
    const deps = createDeps({
      runActionWithBusy: vi.fn(async (_key, fn) => {
        await expect(fn()).rejects.toThrow('Retry not queued')
      }),
    })
    api.retryClassifications.mockResolvedValueOnce({
      data: { results: [{ queued: false, reasonCode: 'already_classified' }] },
    })

    const actions = useNeedsAttentionActions(deps)
    await actions.retryNeedsAttentionItem({ id: 10, title: 'Test' })

    expect(api.retryClassifications).toHaveBeenCalledWith([10])
  })

  it('retryAllNeedsAttention throws when zero items queued', async () => {
    const deps = createDeps({
      needsAttentionItems: ref([{ id: 1 }, { id: 2 }]),
      runActionWithBusy: vi.fn(async (_key, fn) => {
        await expect(fn()).rejects.toThrow('did not queue any items')
      }),
    })
    api.retryClassifications.mockResolvedValueOnce({
      data: { queued: 0, skipped: 2, failed: 0 },
    })

    const actions = useNeedsAttentionActions(deps)
    await actions.retryAllNeedsAttention()

    expect(api.retryClassifications).toHaveBeenCalledWith([1, 2])
  })

  it('retryAllNeedsAttention sets partial warning when some items skipped', async () => {
    const deps = createDeps({
      needsAttentionItems: ref([{ id: 1 }, { id: 2 }, { id: 3 }]),
    })
    api.retryClassifications.mockResolvedValueOnce({
      data: { queued: 2, skipped: 1, failed: 0 },
    })

    const actions = useNeedsAttentionActions(deps)
    await actions.retryAllNeedsAttention()

    expect(deps.setActionError).toHaveBeenCalledWith(expect.stringContaining('queued 2, skipped 1'))
  })

  it('confirmAllNeedsAttention sets error for multiple routing warnings', async () => {
    const deps = createDeps({
      needsAttentionItems: ref([
        currentItem(1, 'A'),
        currentItem(2, 'B'),
      ]),
    })
    api.resolvePendingClassification
      .mockResolvedValueOnce({ data: { routed: false, routingReason: 'timeout' } })
      .mockResolvedValueOnce({ data: { routed: false, routingReason: 'error' } })

    const actions = useNeedsAttentionActions(deps)
    await actions.confirmAllNeedsAttention()

    expect(deps.setActionError).toHaveBeenCalledWith(expect.stringContaining('2 items'))
  })
})
