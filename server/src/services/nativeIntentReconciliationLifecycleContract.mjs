/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { POLICY_CONVERSION_ACTOR_SOURCE_IDS } from './policyConversionActorSources.mjs';

const NATIVE_INTENT_RECONCILIATION_LIFECYCLE_VERSION =
  'native_intent_reconciliation.lifecycle.v1';

const NATIVE_INTENT_RECONCILIATION_RESTORE_GATE_STATE_IDS = Object.freeze({
  READY: 'ready',
  RESTORE_IN_PROGRESS: 'restore_in_progress',
  REQUIRES_MAINTENANCE: 'requires_maintenance',
});

const NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS = Object.freeze({
  ACTIVE_NATIVE_AUTHORITY: 'active_native_authority',
  APPROVED_REENTRY: 'approved_reentry',
  RECONCILIATION_REENTRY_APPROVED: 'reconciliation_reentry_approved',
  RESTORE_IN_PROGRESS: 'restore_in_progress',
  RESTORE_SCHEMA_PARITY_FAILED: 'restore_schema_parity_failed',
  RESTORE_STATE_RESET_FAILED: 'restore_state_reset_failed',
  RESTORE_VALIDATION_FAILED: 'restore_validation_failed',
  RESTORE_VERIFIED: 'restore_verified',
  ROLLBACK_APPLIED: 'rollback_applied',
  ROLLBACK_RECONCILIATION_HOLD: 'rollback_reconciliation_hold',
  STARTUP_READY: 'startup_ready',
});

const APPROVED_REENTRY_ACTOR_SOURCE_IDS = new Set([
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.TEST_FIXTURE,
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.MAINTAINER_MIGRATION_TOOL,
]);

const ACTOR_TYPE_BY_SOURCE_ID = Object.freeze({
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR]: 'operator',
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.TEST_FIXTURE]: 'test_fixture',
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.MAINTAINER_MIGRATION_TOOL]: 'maintainer',
});

const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9_:-]{0,79}$/u;

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeSafeId(value, fallback = null) {
  const normalizedValue = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SAFE_ID_PATTERN.test(normalizedValue) ? normalizedValue : fallback;
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeRestoreGate(row = {}) {
  const gateState = normalizeSafeId(row.gateState ?? row.gate_state, null);
  if (!Object.values(NATIVE_INTENT_RECONCILIATION_RESTORE_GATE_STATE_IDS).includes(gateState)) {
    return {
      gateState: NATIVE_INTENT_RECONCILIATION_RESTORE_GATE_STATE_IDS.REQUIRES_MAINTENANCE,
      reasonId: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_VALIDATION_FAILED,
      restoreToken: null,
      restoreStartedAt: null,
      restoreFinishedAt: null,
      verifiedAt: null,
    };
  }

  return {
    gateState,
    reasonId: normalizeSafeId(
      row.reasonId ?? row.reason_id,
      NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_VALIDATION_FAILED,
    ),
    restoreToken: typeof (row.restoreToken ?? row.restore_token) === 'string'
      ? (row.restoreToken ?? row.restore_token)
      : null,
    restoreStartedAt: normalizeTimestamp(row.restoreStartedAt ?? row.restore_started_at),
    restoreFinishedAt: normalizeTimestamp(row.restoreFinishedAt ?? row.restore_finished_at),
    verifiedAt: normalizeTimestamp(row.verifiedAt ?? row.verified_at),
  };
}

function buildReconciliationExecutionEligibility(gate = {}) {
  const normalizedGate = normalizeRestoreGate(gate);
  const allowed = normalizedGate.gateState === NATIVE_INTENT_RECONCILIATION_RESTORE_GATE_STATE_IDS.READY;

  return {
    version: NATIVE_INTENT_RECONCILIATION_LIFECYCLE_VERSION,
    allowed,
    gateState: normalizedGate.gateState,
    reasonId: allowed
      ? normalizedGate.reasonId
      : normalizedGate.reasonId || NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS.RESTORE_IN_PROGRESS,
    rawPayloadExposed: false,
  };
}

function normalizeReentryAction(action = {}) {
  const actorSourceId = normalizeSafeId(action.actorSourceId ?? action.actor_source_id, null);
  const actorId = normalizePositiveInteger(action.actorId ?? action.actor_id);
  const reasonCode = normalizeSafeId(action.reasonCode ?? action.reason_code, null);

  return {
    actorSourceId,
    actorType: ACTOR_TYPE_BY_SOURCE_ID[actorSourceId] || null,
    actorId,
    reasonCode,
  };
}

function validateReentryAction(action = {}) {
  const normalizedAction = normalizeReentryAction(action);
  if (!APPROVED_REENTRY_ACTOR_SOURCE_IDS.has(normalizedAction.actorSourceId)) {
    return {
      ok: false,
      normalizedAction,
      reasonId: 'reentry_actor_not_allowed',
    };
  }
  if (
    normalizedAction.actorSourceId === POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR &&
    !normalizedAction.actorId
  ) {
    return {
      ok: false,
      normalizedAction,
      reasonId: 'reentry_actor_identity_required',
    };
  }
  if (!normalizedAction.reasonCode) {
    return {
      ok: false,
      normalizedAction,
      reasonId: 'reentry_reason_invalid',
    };
  }
  return { ok: true, normalizedAction };
}

export {
  APPROVED_REENTRY_ACTOR_SOURCE_IDS,
  NATIVE_INTENT_RECONCILIATION_LIFECYCLE_REASON_IDS,
  NATIVE_INTENT_RECONCILIATION_LIFECYCLE_VERSION,
  NATIVE_INTENT_RECONCILIATION_RESTORE_GATE_STATE_IDS,
  buildReconciliationExecutionEligibility,
  normalizePositiveInteger,
  normalizeRestoreGate,
  normalizeSafeId,
  normalizeTimestamp,
  validateReentryAction,
};
