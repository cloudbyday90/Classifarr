/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import {
  POLICY_AUTHORING_PROPOSAL_RECOVERY_NOTICE_STATUS_IDS,
  POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS,
  usePolicyAuthoringProposalOutcomeRecovery,
} from '@/composables/usePolicyAuthoringProposalOutcomeRecovery'

const recovery = {
  libraryId: 7,
  reasonId: POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS.ADMISSION_OUTCOME,
}

describe('usePolicyAuthoringProposalOutcomeRecovery', () => {
  it('reconciles only the selected library lifecycle after a bounded admission outcome', async () => {
    const reloadLifecycle = vi.fn().mockResolvedValue('existing_native_policy')
    const outcomeRecovery = usePolicyAuthoringProposalOutcomeRecovery({ reloadLifecycle })

    await expect(outcomeRecovery.recover({ ...recovery, libraryId: '7' })).resolves.toEqual({
      libraryId: 7,
      lifecycleStatusId: 'existing_native_policy',
    })

    expect(reloadLifecycle).toHaveBeenCalledWith(7)
    expect(outcomeRecovery.loading.value).toBe(false)
    expect(outcomeRecovery.notice.value).toEqual({
      statusId: POLICY_AUTHORING_PROPOSAL_RECOVERY_NOTICE_STATUS_IDS.RECONCILED,
      message: 'Classifarr checked the current policy state. Review the latest destination guidance below.',
    })
  })

  it('does not expose a transport error when lifecycle reconciliation is unavailable', async () => {
    const outcomeRecovery = usePolicyAuthoringProposalOutcomeRecovery({
      reloadLifecycle: vi.fn().mockRejectedValue(new Error('private network detail')),
    })

    await expect(outcomeRecovery.recover({
      ...recovery,
      reasonId: POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS.UNCERTAIN_ADMISSION,
    })).resolves.toBeNull()

    expect(outcomeRecovery.notice.value).toMatchObject({
      statusId: POLICY_AUTHORING_PROPOSAL_RECOVERY_NOTICE_STATUS_IDS.UNAVAILABLE,
    })
    expect(outcomeRecovery.notice.value.message).not.toContain('private network detail')
  })

  it('fails closed without calling a lifecycle reader for invalid recovery input', async () => {
    const reloadLifecycle = vi.fn()
    const outcomeRecovery = usePolicyAuthoringProposalOutcomeRecovery({ reloadLifecycle })

    await expect(outcomeRecovery.recover({ libraryId: 0, reasonId: 'unknown' })).resolves.toBeNull()

    expect(reloadLifecycle).not.toHaveBeenCalled()
    expect(outcomeRecovery.notice.value?.statusId)
      .toBe(POLICY_AUTHORING_PROPOSAL_RECOVERY_NOTICE_STATUS_IDS.UNAVAILABLE)
  })
})
