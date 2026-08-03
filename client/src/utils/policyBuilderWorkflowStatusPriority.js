/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_BUILDER_WORKFLOW_STATUS_IDS = Object.freeze({
  WORKFLOW_ERROR: 'policy-builder-workflow-error-status',
  POLICY_SAVE: 'policy-builder-policy-save-status',
  WORKFLOW_LOADING: 'policy-builder-workflow-loading-status',
  EMPTY_STATE_ACTION: 'policy-builder-empty-state-action-status',
  AUTOMATIC_RECOVERY: 'policy-builder-automatic-recovery-status',
})

const WORKFLOW_LOADING_MESSAGE = 'Loading the current library workflow.'
const POLICY_SAVE_MESSAGE = 'Saving this policy.'

function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildStatus({ id, role = 'status', tone = 'info', message, busy = false }) {
  const normalizedMessage = asText(message)
  if (!normalizedMessage) return null

  return {
    id,
    role,
    tone,
    message: normalizedMessage,
    busy,
  }
}

export function buildPolicyBuilderWorkflowStatus({
  loading = false,
  saving = false,
  error = '',
  activeEmptyStateActionId = '',
  activeEmptyStateActionMessage = '',
  automaticRecoveryMessage = '',
} = {}) {
  const workflowError = asText(error)
  if (workflowError) {
    return buildStatus({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.WORKFLOW_ERROR,
      role: 'alert',
      tone: 'warning',
      message: workflowError,
    })
  }

  if (saving) {
    return buildStatus({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.POLICY_SAVE,
      message: POLICY_SAVE_MESSAGE,
      busy: true,
    })
  }

  if (loading) {
    return buildStatus({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.WORKFLOW_LOADING,
      message: WORKFLOW_LOADING_MESSAGE,
      busy: true,
    })
  }

  const activeActionId = asText(activeEmptyStateActionId)
  const activeActionMessage = asText(activeEmptyStateActionMessage)
  if (activeActionId && activeActionMessage) {
    return buildStatus({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.EMPTY_STATE_ACTION,
      message: activeActionMessage,
      busy: true,
    })
  }

  const recoveryMessage = asText(automaticRecoveryMessage)
  if (recoveryMessage) {
    return buildStatus({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.AUTOMATIC_RECOVERY,
      message: recoveryMessage,
    })
  }

  return null
}
