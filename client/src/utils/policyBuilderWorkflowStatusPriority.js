/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_BUILDER_WORKFLOW_STATUS_IDS = Object.freeze({
  WORKFLOW_ERROR: 'policy-builder-workflow-error-status',
  WORKFLOW_LOADING: 'policy-builder-workflow-loading-status',
  EMPTY_STATE_ACTION: 'policy-builder-empty-state-action-status',
  LIBRARY_PROFILE_REFRESH: 'policy-builder-library-profile-refresh-status',
  PROFILE_REFRESH_RESULT: 'policy-builder-profile-refresh-result-status',
})

const WORKFLOW_LOADING_MESSAGE = 'Loading the current library workflow.'
const PROFILE_REFRESHING_MESSAGE = 'Classifarr is refreshing library evidence.'

function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function joinMessage(...parts) {
  return parts
    .map(asText)
    .filter(Boolean)
    .join(' ')
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
  error = '',
  refreshing = false,
  activeEmptyStateActionId = '',
  activeEmptyStateActionMessage = '',
  refreshResult = null,
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

  if (refreshing) {
    return buildStatus({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.LIBRARY_PROFILE_REFRESH,
      message: activeActionMessage || PROFILE_REFRESHING_MESSAGE,
      busy: true,
    })
  }

  const refreshMessage = joinMessage(
    refreshResult?.label ? `${asText(refreshResult.label)}:` : '',
    refreshResult?.message,
  )
  if (refreshMessage) {
    return buildStatus({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.PROFILE_REFRESH_RESULT,
      role: refreshResult?.status === 'error' ? 'alert' : 'status',
      tone: refreshResult?.tone || 'info',
      message: refreshMessage,
    })
  }

  return null
}
