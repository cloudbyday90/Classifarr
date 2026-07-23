/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  LOADING: 'loading',
  WORKFLOW_UNAVAILABLE: 'workflow_unavailable',
  PROFILE_UNAVAILABLE: 'profile_unavailable',
  PROFILE_NEEDS_REFRESH: 'profile_needs_refresh',
  NO_USABLE_CANDIDATES: 'no_usable_candidates',
  REFRESH_FAILED: 'refresh_failed',
  READY: 'ready',
})

export const POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS = Object.freeze({
  REFRESH_PROFILE: 'refresh_profile',
  RELOAD_WORKFLOW: 'reload_workflow',
})

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function buildRecovery({
  statusId,
  heading,
  message,
  actionId = null,
  actionLabel = '',
  tone = 'warning',
} = {}) {
  return {
    statusId,
    heading,
    message,
    actionId,
    actionLabel,
    tone,
    requiresAction: Boolean(actionId),
    canSelectObservedCandidates: statusId === POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.READY,
  }
}

function isRefreshFailure(refreshResult) {
  return refreshResult?.status === 'error'
}

export function buildPolicyNativeEvidenceRecovery({
  selectionEnabled = false,
  workflowRead = null,
  loading = false,
  error = '',
  refreshResult = null,
} = {}) {
  if (!selectionEnabled) {
    return buildRecovery({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.NOT_APPLICABLE,
      heading: '',
      message: '',
      tone: 'info',
    })
  }

  if (loading) {
    return buildRecovery({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.LOADING,
      heading: 'Checking library evidence',
      message: 'Classifarr is checking the current library profile before offering destination values.',
      tone: 'info',
    })
  }

  if (error || !workflowRead) {
    return buildRecovery({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.WORKFLOW_UNAVAILABLE,
      heading: 'Library evidence is unavailable',
      message: 'Classifarr could not verify current destination values. Try the evidence check again before creating this policy.',
      actionId: POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.RELOAD_WORKFLOW,
      actionLabel: 'Try evidence check again',
    })
  }

  const observedProfile = workflowRead.observedProfile || {}
  const baseRefreshRecovery = {
    actionId: POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.REFRESH_PROFILE,
    actionLabel: 'Refresh library profile',
  }

  if (isRefreshFailure(refreshResult)) {
    return buildRecovery({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.REFRESH_FAILED,
      heading: 'Library profile refresh did not complete',
      message: 'Classifarr could not refresh current library evidence. Check the connected library and try again when it is available.',
      ...baseRefreshRecovery,
    })
  }

  if (observedProfile.available !== true) {
    return buildRecovery({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.PROFILE_UNAVAILABLE,
      heading: 'A current library profile is needed',
      message: 'Refresh the library profile so Classifarr can offer observed destination values. No policy rules will be created by the refresh.',
      ...baseRefreshRecovery,
    })
  }

  if (observedProfile.current !== true) {
    return buildRecovery({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.PROFILE_NEEDS_REFRESH,
      heading: 'Library evidence needs a refresh',
      message: 'Refresh the library profile before using observed values to define this destination.',
      ...baseRefreshRecovery,
    })
  }

  const selectableOptions = asArray(observedProfile.intentSignalProjection?.options)
    .filter(option => option?.selectable === true)

  if (selectableOptions.length === 0) {
    return buildRecovery({
      statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.NO_USABLE_CANDIDATES,
      heading: 'No destination values are ready yet',
      message: 'Classifarr could not find reusable current library values for this destination. Refresh after the library has synced more media, or defer this policy for now.',
      ...baseRefreshRecovery,
    })
  }

  return buildRecovery({
    statusId: POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.READY,
    heading: 'Library evidence ready',
    message: 'Observed destination values are ready for explicit acceptance.',
    tone: 'success',
  })
}
