/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS } from './policyNativeEvidenceRecovery'

export const POLICY_BUILDER_WORKFLOW_STATUS_IDS = Object.freeze({
  WORKFLOW_ERROR: 'policy-builder-workflow-error-status',
  WORKFLOW_LOADING: 'policy-builder-workflow-loading-status',
  EMPTY_STATE_ACTION: 'policy-builder-empty-state-action-status',
  LIBRARY_PROFILE_REFRESH: 'policy-builder-library-profile-refresh-status',
  NATIVE_EVIDENCE_RECOVERY: 'policy-builder-native-evidence-recovery-status',
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

function isRefreshFailure(recovery) {
  return recovery?.statusId === POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.REFRESH_FAILED
}

export function buildPolicyBuilderWorkflowStatus({
  loading = false,
  error = '',
  refreshing = false,
  activeEmptyStateActionId = '',
  activeEmptyStateActionMessage = '',
  nativeEvidenceRecovery = null,
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

  if (isRefreshFailure(nativeEvidenceRecovery)) {
    return buildStatus({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.NATIVE_EVIDENCE_RECOVERY,
      role: 'alert',
      tone: 'warning',
      message: joinMessage(nativeEvidenceRecovery.heading, nativeEvidenceRecovery.message),
    })
  }

  if (nativeEvidenceRecovery?.requiresAction) {
    return buildStatus({
      id: POLICY_BUILDER_WORKFLOW_STATUS_IDS.NATIVE_EVIDENCE_RECOVERY,
      tone: nativeEvidenceRecovery.tone || 'warning',
      message: joinMessage(nativeEvidenceRecovery.heading, nativeEvidenceRecovery.message),
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
