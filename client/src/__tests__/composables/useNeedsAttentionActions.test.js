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
import { pendingReviewReference } from '../fixtures/pendingReviewReference'

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
    recommendation: {
      version: 'policy.runtime_question_recommendation_presentation.v1',
      status_id: 'leading_candidate_available',
      leading_destination: {
        library_id: destinationLibraryId,
        library_name: 'Movies',
        evidence_score: 75,
      },
      why_not_automatic: {
        reason_id: 'missing_identity_evidence',
        message: 'A score alone does not establish destination identity automatically.',
      },
    },
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

  it('keeps adjacent exact IDs distinct and stops Confirm All after a later failure', async () => {
    const ids = ['9007199254740992', '9007199254740993', '9223372036854775807']
    const items = ids.map(id => {
      const value = currentItem(id, `Pending ${id}`)
      value.policy_question_answer.candidate_item = { classification_id: id }
      return value
    })
    const deps = createDeps({ needsAttentionItems: ref(items) })
    api.resolvePendingClassification
      .mockResolvedValueOnce({ data: { classificationId: ids[0], routed: true } })
      .mockRejectedValueOnce(new Error('Answer changed'))

    await expect(useNeedsAttentionActions(deps).confirmAllNeedsAttention()).rejects.toThrow('Answer changed')
    expect(api.resolvePendingClassification).toHaveBeenCalledTimes(2)
    expect(api.resolvePendingClassification.mock.calls.map(([id]) => id)).toEqual(ids.slice(0, 2))
  })

  it('refuses to submit a copied card contract in single and bulk actions', async () => {
    const value = currentItem('9007199254740993', 'Pending')
    value.policy_question_answer.candidate_item = { classification_id: '9007199254740992' }
    const deps = createDeps({ needsAttentionItems: ref([value]) })
    const actions = useNeedsAttentionActions(deps)

    await actions.resolveWithOption(value, { actionId: 'confirm_destination', destinationLibraryId: 5 })
    await actions.confirmAllNeedsAttention()

    expect(api.resolvePendingClassification).not.toHaveBeenCalled()
    expect(deps.setActionError).toHaveBeenCalledWith(expect.stringContaining('Confirm All skipped 1 item'))
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

  it.each([2, '9007199254740993'])('resolves exact ID %s and reports an incomplete route', async id => {
    const deps = createDeps()
    api.resolvePendingClassification.mockResolvedValueOnce({
      data: { routed: false, routingError: 'no_library' },
    })

    const actions = useNeedsAttentionActions(deps)
    const value = currentItem(id, 'Inception')
    value.policy_question_answer.candidate_item = { classification_id: id }
    await actions.resolveWithOption(
      value,
      { actionId: 'confirm_destination', destinationLibraryId: 5 },
    )

    expect(api.resolvePendingClassification).toHaveBeenCalledWith(id, {
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

  it('treats an already-active retry as an idempotent refresh instead of an error', async () => {
    const deps = createDeps()
    api.retryClassifications.mockResolvedValueOnce({
      data: { results: [{ queued: false, reasonCode: 'duplicate_pending_task' }] },
    })

    const actions = useNeedsAttentionActions(deps)
    await expect(actions.retryNeedsAttentionItem({ id: 10, title: 'Test' })).resolves.toBeUndefined()

    expect(api.retryClassifications).toHaveBeenCalledWith([10])
    expect(deps.setActionError).not.toHaveBeenCalled()
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

  it('forwards both adjacent large History IDs in bulk', async () => {
    const ids = [4, '9007199254740992', '9007199254740993', '9223372036854775807']
    const actions = useNeedsAttentionActions(createDeps({ needsAttentionItems: ref(ids.map(id => ({ id }))) }))
    api.retryClassifications.mockResolvedValueOnce({ data: { queued: 4, skipped: 0, failed: 0 } })

    await actions.retryAllNeedsAttention()

    expect(api.retryClassifications).toHaveBeenCalledWith(ids)
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

  it('does not bulk-confirm an item without a current leading recommendation', async () => {
    const itemWithoutRecommendation = currentItem(3, 'Ambiguous')
    delete itemWithoutRecommendation.policy_question_answer.recommendation
    const deps = createDeps({
      needsAttentionItems: ref([itemWithoutRecommendation]),
    })
    const actions = useNeedsAttentionActions(deps)

    await actions.confirmAllNeedsAttention()

    expect(api.resolvePendingClassification).not.toHaveBeenCalled()
    expect(deps.setActionError).toHaveBeenCalledWith(expect.stringContaining('without a current leading recommendation'))
  })

  it('skips select-only technical evidence in bulk while accepting an explicit candidate choice', async () => {
    const answer = pendingReviewReference()
    answer.recommendation.advisory_destination = null
    answer.recommendation.why_not_automatic.reason_id = 'policy_destination_selection_required'
    answer.decision_summary.deterministic.status_id = 'destination_selection_required'
    const item = { id: 44, title: 'Select review', policy_question_answer: answer }
    const deps = createDeps({ needsAttentionItems: ref([item]) })
    const actions = useNeedsAttentionActions(deps)
    await actions.confirmAllNeedsAttention()
    expect(api.resolvePendingClassification).not.toHaveBeenCalled()
    api.resolvePendingClassification.mockResolvedValueOnce({ data: { routed: true } })
    await actions.resolveWithOption(item, { actionId: 'confirm_destination', destinationLibraryId: 7 })
    expect(api.resolvePendingClassification).toHaveBeenCalledWith(44, {
      contract_version: answer.version, contract_fingerprint: answer.fingerprint,
      action_id: 'confirm_destination', destination_library_id: 7,
    })
  })
})
