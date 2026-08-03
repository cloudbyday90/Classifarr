/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ref } from 'vue'
import { admitPolicyAuthoringProposal } from '@/api/policiesApi'
import {
  createNativePolicyCreateIdempotencyKey,
} from '@/utils/policyNativeCreateIdempotency'
import {
  adaptPolicyAuthoringProposalAdmission,
} from '@/utils/policyAuthoringProposalAdmission'
import {
  POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS,
} from '@/composables/usePolicyAuthoringProposalOutcomeRecovery'
import {
  POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS,
  POLICY_AUTHORING_ACTION_IDS,
  buildPolicyAuthoringActionFailureFeedback,
  buildPolicyAuthoringActionFeedback,
} from '@/utils/policyAuthoringActionFeedback'

const ACTION_ID = POLICY_AUTHORING_ACTION_IDS.ADMIT_POLICY_AUTHORING_PROPOSAL
const ADMISSION_CURRENT_STATE_MESSAGE = 'Classifarr could not create this policy because the destination proposal is no longer current. Return to library policy setup to review the current state.'

function normalizeAdmission(value) {
  const libraryId = Number(value?.libraryId)
  const reference = typeof value?.reference === 'string' ? value.reference : ''
  const revision = typeof value?.revision === 'string' ? value.revision : ''

  if (!Number.isInteger(libraryId) || libraryId <= 0 ||
    !/^[A-Za-z0-9_-]{32,96}$/.test(reference) ||
    !/^[a-f0-9]{64}$/.test(revision)) {
    return null
  }

  return { libraryId, reference, revision }
}

function unwrapResponse(response) {
  return response?.data ?? response
}

function normalizeResponseStatus(value) {
  const status = Number(value)
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null
}

function shouldReconcileAfterAdmissionFailure(error) {
  const status = normalizeResponseStatus(error?.response?.status ?? error?.status)

  return status === null || status === 404 || status === 408 || status === 409 ||
    status === 429 || status >= 500
}

function buildRecovery(libraryId, reasonId) {
  return Object.freeze({ libraryId, reasonId })
}

export function usePolicyAuthoringProposalAdmission({
  admitProposalRequest = admitPolicyAuthoringProposal,
  createIdempotencyKey = createNativePolicyCreateIdempotencyKey,
} = {}) {
  const loading = ref(false)
  const feedback = ref(null)
  const result = ref(null)
  const recovery = ref(null)
  let activeRequestId = 0
  let attemptFingerprint = null
  let attemptIdempotencyKey = null

  const clear = () => {
    activeRequestId += 1
    loading.value = false
    feedback.value = null
    result.value = null
    recovery.value = null
    attemptFingerprint = null
    attemptIdempotencyKey = null
  }

  const admit = async admissionValue => {
    const admission = normalizeAdmission(admissionValue)
    if (!admission || typeof admitProposalRequest !== 'function') {
      feedback.value = buildPolicyAuthoringActionFeedback({
        actionId: ACTION_ID,
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE,
      })
      return null
    }

    const fingerprint = `${admission.libraryId}:${admission.reference}:${admission.revision}`
    if (attemptFingerprint !== fingerprint) {
      attemptFingerprint = fingerprint
      attemptIdempotencyKey = null
      result.value = null
    }
    recovery.value = null

    try {
      attemptIdempotencyKey ||= createIdempotencyKey()
    } catch {
      feedback.value = buildPolicyAuthoringActionFeedback({
        actionId: ACTION_ID,
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE,
      })
      return null
    }

    const requestId = activeRequestId + 1
    activeRequestId = requestId
    loading.value = true
    feedback.value = buildPolicyAuthoringActionFeedback({
      actionId: ACTION_ID,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.PENDING,
    })

    try {
      const response = await admitProposalRequest(
        admission.libraryId,
        admission.reference,
        admission.revision,
        { idempotencyKey: attemptIdempotencyKey }
      )
      if (requestId !== activeRequestId) return null

      const admissionResult = adaptPolicyAuthoringProposalAdmission({
        response: unwrapResponse(response),
        expectedLibraryId: admission.libraryId,
      })
      if (!admissionResult.ok || !admissionResult.result.policy) {
        recovery.value = buildRecovery(
          admission.libraryId,
          admissionResult.ok
            ? POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS.ADMISSION_OUTCOME
            : POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS.UNCERTAIN_ADMISSION
        )
        feedback.value = buildPolicyAuthoringActionFeedback({
          actionId: ACTION_ID,
          statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.STALE,
          message: ADMISSION_CURRENT_STATE_MESSAGE,
        })
        return null
      }

      result.value = admissionResult.result
      feedback.value = buildPolicyAuthoringActionFeedback({
        actionId: ACTION_ID,
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.SUCCEEDED,
      })
      return admissionResult.result
    } catch (requestError) {
      if (requestId === activeRequestId) {
        const admissionResult = adaptPolicyAuthoringProposalAdmission({
          response: unwrapResponse(requestError?.response),
          expectedLibraryId: admission.libraryId,
        })
        if (admissionResult.ok && !admissionResult.result.policy) {
          recovery.value = buildRecovery(
            admission.libraryId,
            POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS.ADMISSION_OUTCOME
          )
          feedback.value = buildPolicyAuthoringActionFeedback({
            actionId: ACTION_ID,
            statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.STALE,
            message: ADMISSION_CURRENT_STATE_MESSAGE,
          })
          return null
        }

        feedback.value = buildPolicyAuthoringActionFailureFeedback({
          actionId: ACTION_ID,
          error: requestError,
        })
        if (shouldReconcileAfterAdmissionFailure(requestError)) {
          recovery.value = buildRecovery(
            admission.libraryId,
            POLICY_AUTHORING_PROPOSAL_RECOVERY_REASON_IDS.UNCERTAIN_ADMISSION
          )
        }
      }
      return null
    } finally {
      if (requestId === activeRequestId) {
        loading.value = false
      }
    }
  }

  return {
    loading,
    feedback,
    result,
    recovery,
    clear,
    admit,
  }
}
