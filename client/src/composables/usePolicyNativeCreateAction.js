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
import { createPolicy } from '@/api/policiesApi'
import {
  POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS,
  POLICY_AUTHORING_ACTION_IDS,
  buildPolicyAuthoringActionFailureFeedback,
  buildPolicyAuthoringActionFeedback,
} from '@/utils/policyAuthoringActionFeedback'
import {
  buildNativePolicyCreateAttemptFingerprint,
  createNativePolicyCreateIdempotencyKey,
} from '@/utils/policyNativeCreateIdempotency'
import { buildPolicyNativeCreateHandoff } from '@/utils/policyNativeCreateHandoff'

function isConfirmedNativeCreateResponse(response) {
  return Boolean(buildPolicyNativeCreateHandoff({ createResponse: response }))
}

function hasUsableIdempotencyKey(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function usePolicyNativeCreateAction({
  createPolicyRequest = createPolicy,
  createIdempotencyKey = createNativePolicyCreateIdempotencyKey,
  buildAttemptFingerprint = buildNativePolicyCreateAttemptFingerprint,
  isConfirmedResponse = isConfirmedNativeCreateResponse,
} = {}) {
  const pending = ref(false)
  const feedback = ref(null)
  let idempotencyKey = ''
  let attemptFingerprint = ''

  const reset = () => {
    feedback.value = null
  }

  const setFeedback = (nextFeedback) => {
    feedback.value = nextFeedback || null
  }

  const create = async (policyData) => {
    if (pending.value) {
      return {
        accepted: false,
        response: null,
        feedback: feedback.value,
      }
    }

    if (typeof createPolicyRequest !== 'function') {
      feedback.value = buildPolicyAuthoringActionFeedback({
        actionId: POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE,
        message: 'Policy creation is unavailable until Classifarr can reach its policy service.',
      })
      return {
        accepted: false,
        response: null,
        feedback: feedback.value,
      }
    }

    let nextAttemptFingerprint
    try {
      nextAttemptFingerprint = buildAttemptFingerprint(policyData)
      if (attemptFingerprint !== nextAttemptFingerprint) {
        attemptFingerprint = nextAttemptFingerprint
        idempotencyKey = ''
      }

      if (!idempotencyKey) {
        idempotencyKey = createIdempotencyKey()
      }

      if (!hasUsableIdempotencyKey(idempotencyKey)) {
        throw new Error('Native policy create requires an idempotency key.')
      }
    } catch {
      feedback.value = buildPolicyAuthoringActionFeedback({
        actionId: POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE,
        message: 'Policy creation requires a secure browser connection. Use a supported browser and try again.',
      })
      return {
        accepted: false,
        response: null,
        feedback: feedback.value,
      }
    }

    pending.value = true
    feedback.value = buildPolicyAuthoringActionFeedback({
      actionId: POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.PENDING,
    })

    try {
      const response = await createPolicyRequest(policyData, { idempotencyKey })
      if (!isConfirmedResponse(response)) {
        feedback.value = buildPolicyAuthoringActionFeedback({
          actionId: POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
          statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
          message: 'Classifarr could not confirm the policy result. Try again to safely check the saved result.',
        })
        return {
          accepted: false,
          response: null,
          feedback: feedback.value,
        }
      }

      feedback.value = buildPolicyAuthoringActionFeedback({
        actionId: POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.SUCCEEDED,
      })
      return {
        accepted: true,
        response,
        feedback: feedback.value,
      }
    } catch (error) {
      feedback.value = buildPolicyAuthoringActionFailureFeedback({
        actionId: POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
        error,
      })
      return {
        accepted: false,
        response: null,
        feedback: feedback.value,
      }
    } finally {
      pending.value = false
    }
  }

  return {
    pending,
    feedback,
    reset,
    setFeedback,
    create,
  }
}
