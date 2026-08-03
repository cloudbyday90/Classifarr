/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import {
  usePolicyAuthoringDestinationProposal,
} from '@/composables/usePolicyAuthoringDestinationProposal'
import {
  usePolicyAuthoringProposalAdmission,
} from '@/composables/usePolicyAuthoringProposalAdmission'
import {
  POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS,
} from '@/composables/usePolicyAuthoringProposalOutcomeRecovery'
import {
  POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS,
} from '@/utils/policyAuthoringActionFeedback'

const library = { id: 7, name: 'Anime Movies', media_type: 'movie' }
const admission = {
  libraryId: 7,
  reference: 'proposal_reference_123456789012345678',
  revision: 'a'.repeat(64),
}

function buildLifecycle(statusId = 'eligible_to_prepare_proposal') {
  const eligible = statusId === 'eligible_to_prepare_proposal'
  const recovery = statusId === 'profile_recovery_required'

  return {
    version: 'policy.authoring_proposal.v1',
    statusId,
    library: { id: 7, name: 'Anime Movies', mediaType: 'movie' },
    action: eligible
      ? { id: 'prepare_proposal', available: true }
      : recovery
        ? { id: 'refresh_profile', available: false }
        : { id: 'inspect_policy', available: false },
    policy: null,
    proposal: eligible
      ? { available: true, reasonId: 'current_profile_candidate_available' }
      : { available: false, reasonId: 'profile_not_current' },
  }
}

function buildPreparedProposal() {
  return {
    version: 'policy.authoring_proposal.v1',
    statusId: 'proposal_prepared',
    lifecycle: buildLifecycle(),
    proposal: {
      reference: admission.reference,
      revision: admission.revision,
      expiresAt: '2026-08-03T12:00:00.000Z',
      adjustment: {
        purposeGenres: [{ value: 'Animation', sourceId: 'current_library_profile' }],
        helpfulStudios: [],
      },
      summary: {
        title: 'Anime Movies Policy',
        purpose: [{ signalType: 'genres', operator: 'any_of', values: ['Animation'] }],
        helpfulHints: [],
        hardLimitCount: 0,
        avoidCount: 0,
      },
    },
  }
}

function buildAdmissionResponse(statusId = 'proposal_admission_created') {
  const succeeded = statusId === 'proposal_admission_created'
  return {
    version: 'policy.authoring_proposal.v1',
    statusId,
    policy: succeeded ? { id: 11, libraryId: 7, name: 'Anime Movies Policy' } : null,
    recovery: { lifecycleReloadRequired: !succeeded },
  }
}

describe('policy authoring proposal composables', () => {
  it('prepares a renderable proposal while treating workflow context as optional display data', async () => {
    const loadWorkflowRequest = vi.fn().mockRejectedValue(new Error('optional display unavailable'))
    const prepareProposalRequest = vi.fn().mockResolvedValue({ data: buildPreparedProposal() })
    const proposal = usePolicyAuthoringDestinationProposal({
      loadWorkflowRequest,
      prepareProposalRequest,
    })

    await expect(proposal.load(library)).resolves.toBe(true)

    expect(prepareProposalRequest).toHaveBeenCalledWith(7)
    expect(loadWorkflowRequest).toHaveBeenCalledWith(7)
    expect(proposal.presentation.value).toMatchObject({ title: 'Anime Movies Policy' })
    expect(proposal.presentation.value).not.toHaveProperty('reference')
    expect(proposal.admission.value).toEqual(admission)
    expect(proposal.loading.value).toBe(false)
  })

  it('renders a safe lifecycle outcome when prepare finds a changed state', async () => {
    const proposal = usePolicyAuthoringDestinationProposal({
      loadWorkflowRequest: vi.fn().mockRejectedValue(new Error('not needed')),
      prepareProposalRequest: vi.fn().mockResolvedValue(buildLifecycle('profile_recovery_required')),
    })

    await expect(proposal.load(library)).resolves.toBe(false)

    expect(proposal.presentation.value).toBeNull()
    expect(proposal.admission.value).toBeNull()
    expect(proposal.lifecycle.value).toMatchObject({
      statusId: 'profile_recovery_required',
      canSelect: false,
    })
    expect(proposal.error.value).toBe('')
  })

  it('uses one idempotency key for an unchanged proposal admission attempt', async () => {
    const admitProposalRequest = vi.fn()
      .mockRejectedValueOnce(new Error('temporary transport failure'))
      .mockResolvedValueOnce({ data: buildAdmissionResponse() })
    const createIdempotencyKey = vi.fn().mockReturnValue('6fe3d170-9390-4ec5-95f7-42ad6f8ec777')
    const action = usePolicyAuthoringProposalAdmission({
      admitProposalRequest,
      createIdempotencyKey,
    })

    await expect(action.admit(admission)).resolves.toBeNull()
    expect(action.feedback.value).toMatchObject({
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
      retryable: true,
    })
    expect(action.recovery.value).toEqual({
      libraryId: 7,
      reasonId: POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS.UNCERTAIN_ADMISSION,
    })

    await expect(action.admit(admission)).resolves.toMatchObject({
      policy: { id: 11, libraryId: 7 },
    })

    expect(createIdempotencyKey).toHaveBeenCalledTimes(1)
    expect(admitProposalRequest).toHaveBeenNthCalledWith(1, 7, admission.reference, admission.revision, {
      idempotencyKey: '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
      adjustmentCommands: [],
    })
    expect(admitProposalRequest).toHaveBeenNthCalledWith(2, 7, admission.reference, admission.revision, {
      idempotencyKey: '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
      adjustmentCommands: [],
    })
    expect(action.feedback.value).toMatchObject({
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.SUCCEEDED,
      retryable: false,
    })
  })

  it('does not treat a stale admission result as a successful create', async () => {
    const action = usePolicyAuthoringProposalAdmission({
      admitProposalRequest: vi.fn().mockResolvedValue({
        data: buildAdmissionResponse('proposal_stale'),
      }),
      createIdempotencyKey: () => '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
    })

    await expect(action.admit(admission)).resolves.toBeNull()

    expect(action.result.value).toBeNull()
    expect(action.feedback.value).toMatchObject({
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.STALE,
      retryable: false,
    })
    expect(action.feedback.value.message).not.toContain('proposal_stale')
    expect(action.recovery.value).toEqual({
      libraryId: 7,
      reasonId: POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS.ADMISSION_OUTCOME,
    })
  })

  it('uses a bounded conflict response as a lifecycle-reconciliation signal', async () => {
    const action = usePolicyAuthoringProposalAdmission({
      admitProposalRequest: vi.fn().mockRejectedValue({
        response: {
          status: 409,
          data: buildAdmissionResponse('existing_policy'),
        },
      }),
      createIdempotencyKey: () => '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
    })

    await expect(action.admit(admission)).resolves.toBeNull()

    expect(action.feedback.value).toMatchObject({
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.STALE,
      retryable: false,
    })
    expect(action.recovery.value).toEqual({
      libraryId: 7,
      reasonId: POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS.ADMISSION_OUTCOME,
    })
  })

  it.each([
    [401, POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE],
    [403, POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.REJECTED],
  ])('keeps authorization rejection feedback-only for HTTP %i', async (status, statusId) => {
    const action = usePolicyAuthoringProposalAdmission({
      admitProposalRequest: vi.fn().mockRejectedValue({ response: { status } }),
      createIdempotencyKey: () => '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
    })

    await expect(action.admit(admission)).resolves.toBeNull()

    expect(action.feedback.value).toMatchObject({ statusId, retryable: false })
    expect(action.recovery.value).toBeNull()
  })
})
