/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS,
  NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS,
} from './nativeIntentReconciliationControlContract.mjs';

const NATIVE_INTENT_RECONCILIATION_STATUS_VERSION = 'native_intent_reconciliation.status.v1';
const MAX_NATIVE_INTENT_RECONCILIATION_STATUS_COUNT = 1_000_000;
const MAX_NATIVE_INTENT_RECONCILIATION_BLOCKER_REASON_GROUPS = 12;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9_:-]{0,79}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const NATIVE_INTENT_RECONCILIATION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  ATTENTION_REQUIRED: 'attention_required',
  AUTOMATION_PAUSED: 'automation_paused',
  CIRCUIT_OPEN: 'circuit_open',
  CONTROL_UNAVAILABLE: 'control_unavailable',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSafeId(value, fallback = null) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SAFE_ID_PATTERN.test(normalized) ? normalized : fallback;
}

function normalizeCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.min(MAX_NATIVE_INTENT_RECONCILIATION_STATUS_COUNT, Math.floor(numeric));
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeCorrelationId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function normalizeControl(value) {
  const source = asObject(value);
  const available = source.available !== false;
  const circuitState = normalizeSafeId(source.circuitState, NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.CLOSED);
  const recoveryRequirement = normalizeSafeId(
    source.recoveryRequirement,
    NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.NONE,
  );

  return {
    available,
    automationEnabled: source.automationEnabled !== false,
    circuitState,
    recoveryRequirement,
    failureCount: normalizeCount(source.failureCount),
    lastFailureCategory: normalizeSafeId(source.lastFailureCategory),
    openedAt: normalizeTimestamp(source.openedAt),
    recoveryProbeStartedAt: normalizeTimestamp(source.recoveryProbeStartedAt),
    manualDisabledAt: normalizeTimestamp(source.manualDisabledAt),
    manualDisabledReasonId: normalizeSafeId(source.manualDisabledReasonId),
    rawPayloadExposed: false,
  };
}

function normalizeLatestRun(value) {
  if (!value) return null;
  const source = asObject(value);
  const correlationId = normalizeCorrelationId(source.run_key ?? source.runKey);
  const stateId = normalizeSafeId(source.run_state ?? source.runState);
  const statusId = normalizeSafeId(source.source_status_id ?? source.sourceStatusId);
  const reasonId = normalizeSafeId(source.reason_id ?? source.reasonId);
  const completedAt = normalizeTimestamp(source.finished_at ?? source.finishedAt);

  if (!correlationId || !stateId || !statusId || !reasonId || !completedAt) return null;

  return {
    correlationId,
    stateId,
    statusId,
    reasonId,
    completedAt,
    counts: {
      candidateCount: normalizeCount(source.candidate_count ?? source.candidateCount),
      convertedCount: normalizeCount(source.converted_count ?? source.convertedCount),
      alreadyNativeCount: normalizeCount(source.already_native_count ?? source.alreadyNativeCount),
      deferredCount: normalizeCount(source.deferred_count ?? source.deferredCount),
      blockedCount: normalizeCount(source.blocked_count ?? source.blockedCount),
      failedCount: normalizeCount(source.failed_count ?? source.failedCount),
    },
    rawPayloadExposed: false,
  };
}

function normalizeInventory(value) {
  const source = asObject(value);
  return {
    unresolvedCount: normalizeCount(source.unresolved_count ?? source.unresolvedCount),
    deferredRetryCount: normalizeCount(source.deferred_retry_count ?? source.deferredRetryCount),
    blockedCurrentStateCount: normalizeCount(
      source.blocked_current_state_count ?? source.blockedCurrentStateCount,
    ),
    requiresMaintenanceCount: normalizeCount(
      source.requires_maintenance_count ?? source.requiresMaintenanceCount,
    ),
    systemFailureCount: normalizeCount(source.system_failure_count ?? source.systemFailureCount),
    oldestUnresolvedAt: normalizeTimestamp(source.oldest_unresolved_at ?? source.oldestUnresolvedAt),
    rawPayloadExposed: false,
  };
}

function normalizeBlockerReasonGroups(value) {
  const seen = new Set();
  return asArray(value)
    .map(row => {
      const source = asObject(row);
      const outcomeState = normalizeSafeId(source.outcome_state ?? source.outcomeState);
      const reasonId = normalizeSafeId(source.reason_id ?? source.reasonId);
      if (!outcomeState || !reasonId) return null;
      const key = `${outcomeState}:${reasonId}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        outcomeState,
        reasonId,
        policyCount: normalizeCount(source.policy_count ?? source.policyCount),
        rawPayloadExposed: false,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_NATIVE_INTENT_RECONCILIATION_BLOCKER_REASON_GROUPS);
}

function getStatusId({ control, inventory, recentFailedRunCount }) {
  if (!control.available) return NATIVE_INTENT_RECONCILIATION_STATUS_IDS.CONTROL_UNAVAILABLE;
  if (!control.automationEnabled) return NATIVE_INTENT_RECONCILIATION_STATUS_IDS.AUTOMATION_PAUSED;
  if (control.circuitState !== NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.CLOSED) {
    return NATIVE_INTENT_RECONCILIATION_STATUS_IDS.CIRCUIT_OPEN;
  }
  if (inventory.unresolvedCount > 0 || recentFailedRunCount > 0) {
    return NATIVE_INTENT_RECONCILIATION_STATUS_IDS.ATTENTION_REQUIRED;
  }
  return NATIVE_INTENT_RECONCILIATION_STATUS_IDS.READY;
}

function buildNativeIntentReconciliationStatus({
  evaluatedAt = new Date(),
  nextScheduledAttemptAt = null,
  control,
  latestRun,
  inventory,
  blockerReasonGroups,
  recentFailedRunCount,
} = {}) {
  const normalizedControl = normalizeControl(control);
  const normalizedInventory = normalizeInventory(inventory);
  const normalizedRecentFailedRunCount = normalizeCount(recentFailedRunCount);

  return {
    version: NATIVE_INTENT_RECONCILIATION_STATUS_VERSION,
    statusId: getStatusId({
      control: normalizedControl,
      inventory: normalizedInventory,
      recentFailedRunCount: normalizedRecentFailedRunCount,
    }),
    evaluatedAt: normalizeTimestamp(evaluatedAt),
    nextScheduledAttemptAt: normalizeTimestamp(nextScheduledAttemptAt),
    control: normalizedControl,
    latestRun: normalizeLatestRun(latestRun),
    inventory: normalizedInventory,
    blockerReasonGroups: normalizeBlockerReasonGroups(blockerReasonGroups),
    recentFailedRunCount: normalizedRecentFailedRunCount,
    reasonGroupLimit: MAX_NATIVE_INTENT_RECONCILIATION_BLOCKER_REASON_GROUPS,
    rawPayloadExposed: false,
  };
}

export {
  MAX_NATIVE_INTENT_RECONCILIATION_BLOCKER_REASON_GROUPS,
  NATIVE_INTENT_RECONCILIATION_STATUS_IDS,
  NATIVE_INTENT_RECONCILIATION_STATUS_VERSION,
  buildNativeIntentReconciliationStatus,
};
