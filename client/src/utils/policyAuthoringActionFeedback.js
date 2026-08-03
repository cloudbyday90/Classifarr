/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_AUTHORING_ACTION_IDS = Object.freeze({
  CREATE_NATIVE_POLICY: 'create_native_policy',
  VALIDATE_CUSTOM_INTENT_SIGNAL: 'validate_custom_intent_signal',
  OPEN_LIBRARY_MAPPING: 'open_library_mapping',
  SAVE_COMPATIBILITY_POLICY: 'save_compatibility_policy',
})

export const POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS = Object.freeze({
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  REJECTED: 'rejected',
  STALE: 'stale',
  RETRYABLE_ERROR: 'retryable_error',
  UNAVAILABLE: 'unavailable',
})

function getActionCopy(actionId) {
  switch (actionId) {
    case POLICY_AUTHORING_ACTION_IDS.VALIDATE_CUSTOM_INTENT_SIGNAL:
      return {
        verb: 'validate that custom destination value',
        noun: 'custom destination value',
      }
    case POLICY_AUTHORING_ACTION_IDS.OPEN_LIBRARY_MAPPING:
      return {
        verb: 'open library mapping',
        noun: 'library mapping',
      }
    case POLICY_AUTHORING_ACTION_IDS.SAVE_COMPATIBILITY_POLICY:
      return {
        verb: 'save this policy',
        noun: 'policy',
      }
    default:
      return {
        verb: 'create this policy',
        noun: 'policy',
      }
  }
}

function normalizeStatusCode(value) {
  const status = Number(value)
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null
}

function normalizeCode(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function statusMessage({ statusId, actionId, message }) {
  const action = getActionCopy(actionId)
  if (typeof message === 'string' && message.trim()) return message.trim()

  switch (statusId) {
    case POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.PENDING:
      return `Classifarr is working to ${action.verb}.`
    case POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.SUCCEEDED:
      return `Classifarr ${actionId === POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY ? 'created the policy' : 'completed the action'}.`
    case POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.REJECTED:
      return `Classifarr could not accept this ${action.noun}. Review the current destination details and try again.`
    case POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.STALE:
      return `This ${action.noun} request is no longer current or is still being processed. Review the latest policy state before trying again.`
    case POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE:
      return `Classifarr cannot ${action.verb} in this browser right now.`
    default:
      return `Classifarr could not ${action.verb} right now. Try again.`
  }
}

export function buildPolicyAuthoringActionFeedback({
  actionId = POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
  statusId = POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
  message = '',
} = {}) {
  const validStatusId = Object.values(POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS)
    .includes(statusId)
    ? statusId
    : POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR

  return Object.freeze({
    actionId,
    statusId: validStatusId,
    message: statusMessage({ statusId: validStatusId, actionId, message }),
    retryable: validStatusId === POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
  })
}

export function buildPolicyAuthoringActionFailureFeedback({
  actionId = POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
  error = null,
} = {}) {
  const status = normalizeStatusCode(error?.response?.status ?? error?.status)
  const code = normalizeCode(error?.response?.data?.code ?? error?.code)

  if (code === 'POLICY_NATIVE_INTENT_CREATE_IDEMPOTENCY_KEY_IN_PROGRESS' || status === 409) {
    return buildPolicyAuthoringActionFeedback({
      actionId,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.STALE,
    })
  }

  if (status === 401) {
    return buildPolicyAuthoringActionFeedback({
      actionId,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE,
      message: 'Your session is no longer active. Sign in again before trying this action.',
    })
  }

  if (status === 403) {
    return buildPolicyAuthoringActionFeedback({
      actionId,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.REJECTED,
      message: 'Your account is not allowed to perform this action for the selected library.',
    })
  }

  if (status === 404) {
    return buildPolicyAuthoringActionFeedback({
      actionId,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.STALE,
      message: 'The selected library or policy is no longer available. Close this dialog and review the latest policies.',
    })
  }

  if (status !== null && status >= 400 && status < 500) {
    return buildPolicyAuthoringActionFeedback({
      actionId,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.REJECTED,
    })
  }

  return buildPolicyAuthoringActionFeedback({
    actionId,
    statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
  })
}
