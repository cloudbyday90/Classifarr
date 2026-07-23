/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS,
  POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS,
  buildPolicyNativeEvidenceRecovery,
} from '@/utils/policyNativeEvidenceRecovery'

function buildWorkflowRead(overrides = {}) {
  return {
    observedProfile: {
      available: true,
      current: true,
      intentSignalProjection: {
        options: [{ candidateId: 'genre:Animation:purpose', selectable: true }],
      },
      ...overrides,
    },
  }
}

describe('policyNativeEvidenceRecovery', () => {
  it('does not affect the legacy editing path', () => {
    expect(buildPolicyNativeEvidenceRecovery({
      workflowRead: buildWorkflowRead(),
    })).toMatchObject({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.NOT_APPLICABLE,
      requiresAction: false,
      canSelectObservedCandidates: false,
    })
  })

  it('requires a side-effect-free workflow reload when the bounded read is unavailable', () => {
    expect(buildPolicyNativeEvidenceRecovery({
      selectionEnabled: true,
      error: 'ignored client error text',
    })).toMatchObject({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.WORKFLOW_UNAVAILABLE,
      actionId: POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.RELOAD_WORKFLOW,
      canSelectObservedCandidates: false,
    })
  })

  it.each([
    ['missing', { available: false, current: false }, POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.PROFILE_UNAVAILABLE],
    ['stale', { available: true, current: false }, POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.PROFILE_NEEDS_REFRESH],
    ['empty', { available: true, current: true, intentSignalProjection: { options: [] } }, POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.NO_USABLE_CANDIDATES],
  ])('requires a profile refresh for %s evidence', (_name, observedProfile, statusId) => {
    expect(buildPolicyNativeEvidenceRecovery({
      selectionEnabled: true,
      workflowRead: buildWorkflowRead(observedProfile),
    })).toMatchObject({
      statusId,
      actionId: POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.REFRESH_PROFILE,
      canSelectObservedCandidates: false,
    })
  })

  it('keeps a failed refresh bounded and retryable without exposing the server error', () => {
    const recovery = buildPolicyNativeEvidenceRecovery({
      selectionEnabled: true,
      workflowRead: buildWorkflowRead({ available: false, current: false }),
      refreshResult: {
        status: 'error',
        message: 'database stack trace should not be rendered here',
      },
    })

    expect(recovery).toMatchObject({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.REFRESH_FAILED,
      actionId: POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.REFRESH_PROFILE,
    })
    expect(recovery.message).not.toContain('stack trace')
  })

  it('permits selection only from a current profile with usable candidates', () => {
    expect(buildPolicyNativeEvidenceRecovery({
      selectionEnabled: true,
      workflowRead: buildWorkflowRead(),
    })).toMatchObject({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.READY,
      requiresAction: false,
      canSelectObservedCandidates: true,
    })
  })
})
