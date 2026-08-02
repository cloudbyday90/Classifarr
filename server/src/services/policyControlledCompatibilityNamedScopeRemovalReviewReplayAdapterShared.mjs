/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_VERSION =
  'policy.controlled_compatibility_named_scope_removal_review_replay_adapter.v1';

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS =
  Object.freeze({
    READY_FOR_FUTURE_REMOVAL_ADMISSION: 'ready_for_future_removal_admission',
    BLOCKED_BY_CALLER_INPUT: 'blocked_by_caller_input',
    BLOCKED_BY_FRESH_DRY_RUN: 'blocked_by_fresh_dry_run',
    BLOCKED_BY_REVIEW_ARTIFACT: 'blocked_by_review_artifact',
  });

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS =
  Object.freeze({
    CALLER_SUPPLIED_DRY_RUN: 'caller_supplied_dry_run',
    FRESH_DRY_RUN_NOT_READY: 'fresh_dry_run_not_ready',
    FRESH_DRY_RUN_VALIDATION_FAILED: 'fresh_dry_run_validation_failed',
    REVIEW_ARTIFACT_REPLAY_FAILED: 'review_artifact_replay_failed',
    RISK_COUNT_MISMATCH: 'risk_count_mismatch',
    READY_STATE_MISMATCH: 'ready_state_mismatch',
    SIDE_EFFECT_PERFORMED: 'side_effect_performed',
    STATUS_MISMATCH: 'status_mismatch',
    UNKNOWN_STATUS: 'unknown_status',
  });

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterSideEffects() {
  return {
    filesArchived: false,
    filesDeleted: false,
    gitCommandsRun: false,
    manifestWritten: false,
    routesRemoved: false,
    sourceWritten: false,
    storageChanged: false,
    testsRemoved: false,
  };
}

function determinePolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterStatusId(
  risks = []
) {
  const riskIds = new Set(asArray(risks).map(risk => risk?.riskId));

  if (riskIds.has(
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
      .CALLER_SUPPLIED_DRY_RUN
  )) {
    return POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
      .BLOCKED_BY_CALLER_INPUT;
  }
  if (riskIds.has(
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
      .FRESH_DRY_RUN_NOT_READY
  ) || riskIds.has(
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
      .FRESH_DRY_RUN_VALIDATION_FAILED
  )) {
    return POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
      .BLOCKED_BY_FRESH_DRY_RUN;
  }

  return POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
    .BLOCKED_BY_REVIEW_ARTIFACT;
}

function buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterNextStep({
  readyForFutureRemovalAdmission,
} = {}) {
  return readyForFutureRemovalAdmission
    ? {
      stepId: 'scope_aware_removal_apply_design',
      label: 'Scope-Aware Removal Apply Design',
      reason:
        'The review artifact now matches a freshly server-derived dry run; a separate future component must still define any controlled mutation admission and authorization boundary.',
    }
    : {
      stepId: 'resolve_scope_aware_removal_replay_blocker',
      label: 'Resolve Scope-Aware Removal Replay Blocker',
      reason:
        'The reviewed scope no longer matches a fresh server-derived dry run. Refresh the review rather than reusing caller-supplied snapshot data.',
    };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_VERSION,
  asArray,
  asObject,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterNextStep,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterSideEffects,
  buildRisk,
  determinePolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterStatusId,
};
