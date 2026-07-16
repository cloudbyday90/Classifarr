/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const NATIVE_INTENT_RECONCILIATION_CONTROL_VERSION =
  'native_intent_reconciliation.control.v1';
const NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_THRESHOLD = 3;
const NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const NATIVE_INTENT_RECONCILIATION_RECOVERY_PROBE_STALE_MS = 60 * 1000;

const NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS = Object.freeze({
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open',
});

const NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS = Object.freeze({
  NONE: 'none',
  HEALTHY_EVALUATION: 'healthy_evaluation',
  ADMIN_RESET: 'admin_reset',
});

const NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS = Object.freeze({
  ADMIN_RESET_APPROVED: 'admin_reset_approved',
  AUTOMATIC_RECOVERY: 'automatic_recovery',
  CIRCUIT_OPEN: 'circuit_open',
  CONTROL_UNAVAILABLE: 'reconciliation_control_unavailable',
  EMERGENCY_STOP: 'emergency_stop',
  EMERGENCY_STOP_RESUMED: 'emergency_stop_resumed',
  RECOVERY_PROBE_FAILED: 'recovery_probe_failed',
  RECOVERY_PROBE_IN_PROGRESS: 'recovery_probe_in_progress',
  RECOVERY_PROBE_REQUIRED: 'recovery_probe_required',
  STARTUP_READY: 'startup_ready',
});

const NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS = Object.freeze({
  NATIVE_AUTHORITY_INTEGRITY_FAILED: 'native_authority_integrity_failed',
  SCHEMA_INCOMPATIBLE: 'schema_incompatible',
  TRANSIENT_DATABASE: 'transient_database',
});

const NATIVE_INTENT_RECONCILIATION_CONTROL_EVENT_TYPE_IDS = Object.freeze({
  AUTOMATION_DISABLED: 'automation_disabled',
  AUTOMATION_ENABLED: 'automation_enabled',
  CIRCUIT_OPENED: 'circuit_opened',
  CIRCUIT_RECOVERED: 'circuit_recovered',
  CIRCUIT_RESET: 'circuit_reset',
});

const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9_:-]{0,79}$/u;
const TRANSIENT_DATABASE_ERROR_CODES = new Set([
  '40001', '40P01', '55P03',
  '08000', '08001', '08003', '08004', '08006', '08007', '08P01',
  'ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH',
  'ENETUNREACH', 'EPIPE', 'ETIMEDOUT',
]);
const SCHEMA_INCOMPATIBLE_ERROR_CODES = new Set([
  '0A000', '42P01', '42703', '42704', '42804',
]);

function normalizeSafeId(value, fallback = null) {
  const normalizedValue = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SAFE_ID_PATTERN.test(normalizedValue) ? normalizedValue : fallback;
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeFailureCount(value) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 0) return 0;
  return Math.min(numericValue, NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_THRESHOLD);
}

function normalizeCircuitState(value) {
  return Object.values(NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS).includes(value)
    ? value
    : NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.OPEN;
}

function normalizeRecoveryRequirement(value) {
  return Object.values(NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS).includes(value)
    ? value
    : NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.ADMIN_RESET;
}

function buildUnavailableControl() {
  return {
    version: NATIVE_INTENT_RECONCILIATION_CONTROL_VERSION,
    available: false,
    automationEnabled: false,
    circuitState: NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.OPEN,
    recoveryRequirement: NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.ADMIN_RESET,
    failureCount: 0,
    failureWindowStartedAt: null,
    lastFailureCategory: null,
    openedAt: null,
    recoveryProbeStartedAt: null,
    recoveredAt: null,
    manualDisabledAt: null,
    manualDisabledReasonId: null,
    rawPayloadExposed: false,
  };
}

function normalizeControl(row = null) {
  if (!row || typeof row !== 'object') {
    return buildUnavailableControl();
  }

  const circuitState = normalizeCircuitState(row.circuitState ?? row.circuit_state);
  const recoveryRequirement = normalizeRecoveryRequirement(
    row.recoveryRequirement ?? row.recovery_requirement,
  );

  return {
    version: NATIVE_INTENT_RECONCILIATION_CONTROL_VERSION,
    available: true,
    automationEnabled: (row.automationEnabled ?? row.automation_enabled) === true,
    circuitState,
    recoveryRequirement,
    failureCount: normalizeFailureCount(row.failureCount ?? row.failure_count),
    failureWindowStartedAt: normalizeTimestamp(
      row.failureWindowStartedAt ?? row.failure_window_started_at,
    ),
    lastFailureCategory: normalizeSafeId(
      row.lastFailureCategory ?? row.last_failure_category,
    ),
    openedAt: normalizeTimestamp(row.openedAt ?? row.opened_at),
    recoveryProbeStartedAt: normalizeTimestamp(
      row.recoveryProbeStartedAt ?? row.recovery_probe_started_at,
    ),
    recoveredAt: normalizeTimestamp(row.recoveredAt ?? row.recovered_at),
    manualDisabledAt: normalizeTimestamp(row.manualDisabledAt ?? row.manual_disabled_at),
    manualDisabledReasonId: normalizeSafeId(
      row.manualDisabledReasonId ?? row.manual_disabled_reason_id,
    ),
    rawPayloadExposed: false,
  };
}

function isSystemFailureCategory(value) {
  return Object.values(NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS).includes(value);
}

function classifyErrorFailureCategory(error = {}) {
  const explicitCategory = normalizeSafeId(
    error.failureCategory ?? error.failure_category ?? error.operatorErrorId ?? error.operator_error_id,
  );
  if (isSystemFailureCategory(explicitCategory)) return explicitCategory;

  const code = typeof error.code === 'string' ? error.code.trim().toUpperCase() : '';
  if (TRANSIENT_DATABASE_ERROR_CODES.has(code)) {
    return NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS.TRANSIENT_DATABASE;
  }
  if (SCHEMA_INCOMPATIBLE_ERROR_CODES.has(code)) {
    return NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS.SCHEMA_INCOMPATIBLE;
  }

  return null;
}

function classifyApplyGateSystemFailure(applyGate = {}) {
  if (applyGate?.statusId !== 'failed_rolled_back') return null;

  const failureCategory = normalizeSafeId(
    applyGate.failureCategory ?? applyGate.failure_category,
  );
  return isSystemFailureCategory(failureCategory) ? failureCategory : null;
}

function requiresAdminReset(failureCategory) {
  return [
    NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS.SCHEMA_INCOMPATIBLE,
    NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS.NATIVE_AUTHORITY_INTEGRITY_FAILED,
  ].includes(failureCategory);
}

function isFailureWindowCurrent({ control, now }) {
  const startedAt = new Date(control?.failureWindowStartedAt || 0).getTime();
  const evaluatedAt = new Date(now).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(evaluatedAt) || startedAt <= 0) {
    return false;
  }

  return evaluatedAt - startedAt <= NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_WINDOW_MS;
}

function buildSystemFailureTransition({ control, failureCategory, now }) {
  const normalizedControl = normalizeControl(control);
  const normalizedFailureCategory = isSystemFailureCategory(failureCategory)
    ? failureCategory
    : null;
  const evaluatedAt = normalizeTimestamp(now);

  if (!normalizedFailureCategory || !evaluatedAt) {
    return {
      changed: false,
      opened: false,
      control: normalizedControl,
    };
  }

  const sameFailureCategory = normalizedControl.lastFailureCategory === normalizedFailureCategory;
  const withinCurrentWindow = sameFailureCategory && isFailureWindowCurrent({
    control: normalizedControl,
    now: evaluatedAt,
  });
  const failureCount = withinCurrentWindow
    ? Math.min(
      normalizedControl.failureCount + 1,
      NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_THRESHOLD,
    )
    : 1;
  const opened = failureCount >= NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_THRESHOLD;

  return {
    changed: true,
    opened,
    failureCategory: normalizedFailureCategory,
    control: {
      ...normalizedControl,
      circuitState: opened
        ? NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.OPEN
        : NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.CLOSED,
      recoveryRequirement: opened
        ? (requiresAdminReset(normalizedFailureCategory)
          ? NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.ADMIN_RESET
          : NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.HEALTHY_EVALUATION)
        : NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.NONE,
      failureCount,
      failureWindowStartedAt: withinCurrentWindow
        ? normalizedControl.failureWindowStartedAt
        : evaluatedAt,
      lastFailureCategory: normalizedFailureCategory,
      openedAt: opened ? evaluatedAt : null,
      recoveryProbeStartedAt: null,
      recoveredAt: null,
    },
  };
}

function buildSuccessfulEvaluationTransition({ control, now }) {
  const normalizedControl = normalizeControl(control);
  if (
    normalizedControl.circuitState !== NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.CLOSED ||
    normalizedControl.failureCount === 0
  ) {
    return { changed: false, control: normalizedControl };
  }

  return {
    changed: true,
    control: {
      ...normalizedControl,
      failureCount: 0,
      failureWindowStartedAt: null,
      lastFailureCategory: null,
      recoveredAt: normalizeTimestamp(now),
    },
  };
}

function validateOperatorAction(action = {}) {
  const actorId = normalizePositiveInteger(action.actorId ?? action.actor_id);
  const reasonId = normalizeSafeId(action.reasonId ?? action.reason_id ?? action.reasonCode ?? action.reason_code);

  if (!actorId || !reasonId) {
    return { ok: false, actorId, reasonId, reason: 'control_action_invalid' };
  }

  return { ok: true, actorId, reasonId };
}

export {
  NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS,
  NATIVE_INTENT_RECONCILIATION_CONTROL_EVENT_TYPE_IDS,
  NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS,
  NATIVE_INTENT_RECONCILIATION_CONTROL_VERSION,
  NATIVE_INTENT_RECONCILIATION_RECOVERY_PROBE_STALE_MS,
  NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS,
  NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS,
  NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_THRESHOLD,
  NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_WINDOW_MS,
  buildSuccessfulEvaluationTransition,
  buildSystemFailureTransition,
  buildUnavailableControl,
  classifyApplyGateSystemFailure,
  classifyErrorFailureCategory,
  isSystemFailureCategory,
  normalizeControl,
  normalizePositiveInteger,
  normalizeSafeId,
  normalizeTimestamp,
  requiresAdminReset,
  validateOperatorAction,
};
