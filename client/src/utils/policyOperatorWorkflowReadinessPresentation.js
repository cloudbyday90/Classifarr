/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_VERSION =
  'policy.operator_workflow_readiness_presentation.v1'

const OWNER_ACTION = 'owner_action'
const AUTOMATED_GUIDANCE = 'automated_guidance'

const OWNER_IDS = new Set([
  'policy_builder_footer_actions',
  'intent_signal_picker',
  'review_trigger_control',
  'hard_limit_control',
  'destination_empty_state_notice',
  'observed_profile_summary',
])

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isApprovedResolution(resolution) {
  if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) return false
  if (!isNonEmptyString(resolution.stateId) || !OWNER_IDS.has(resolution.ownerId)) return false

  if (resolution.kind === OWNER_ACTION) {
    return isNonEmptyString(resolution.actionId)
  }

  return resolution.kind === AUTOMATED_GUIDANCE &&
    resolution.actionId === null &&
    isNonEmptyString(resolution.message)
}

export function isApprovedPolicyOperatorWorkflowReadinessPresentation({
  presentation,
  readiness,
} = {}) {
  if (!presentation || typeof presentation !== 'object' || Array.isArray(presentation)) return false
  if (presentation.version !== POLICY_OPERATOR_WORKFLOW_READINESS_PRESENTATION_VERSION) return false
  if (presentation.rawPayloadExposed !== false) return false
  if (!isApprovedResolution(presentation.primary)) return false
  if (!isNonEmptyString(readiness?.stateId) || presentation.primary.stateId !== readiness.stateId) return false

  return Array.isArray(presentation.issues) && presentation.issues.some(resolution => (
    isApprovedResolution(resolution) &&
    resolution.stateId === presentation.primary.stateId
  ))
}
