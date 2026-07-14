/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from './policyConversionActorSources.mjs';
import {
  POLICY_ROLLBACK_PAYLOAD_SECTION_IDS,
} from './policyRollbackSnapshotWindow.mjs';

const POLICY_NATIVE_INTENT_REVERSION_VERSION = 'policy.native_intent_reversion.v1';

const POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS = Object.freeze({
  APPLIED_TO_COMPATIBILITY: 'applied_to_compatibility',
  APPLIED_TO_PREVIOUS_NATIVE_INTENT: 'applied_to_previous_native_intent',
  ALREADY_REVERTED: 'already_reverted',
  BLOCKED_BY_ACTION: 'blocked_by_action',
  BLOCKED_BY_AUTHORITY: 'blocked_by_authority',
  BLOCKED_BY_SNAPSHOT: 'blocked_by_snapshot',
  BLOCKED_BY_TRANSACTION_BOUNDARY: 'blocked_by_transaction_boundary',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
});

const POLICY_NATIVE_INTENT_REVERSION_RISK_IDS = Object.freeze({
  ACTION_ACTOR_INVALID: 'action_actor_invalid',
  ACTION_NOT_ALLOWED: 'action_not_allowed',
  ACTION_REASON_INVALID: 'action_reason_invalid',
  AUTHORITY_MISMATCH: 'authority_mismatch',
  MULTIPLE_ACTIVE_INTENTS: 'multiple_active_intents',
  POLICY_NOT_FOUND: 'policy_not_found',
  SNAPSHOT_EXPIRED: 'snapshot_expired',
  SNAPSHOT_MANIFEST_INVALID: 'snapshot_manifest_invalid',
  SNAPSHOT_NOT_FOUND: 'snapshot_not_found',
  SNAPSHOT_NOT_RESTORABLE: 'snapshot_not_restorable',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  TRANSACTION_FAILED: 'transaction_failed',
});

const POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS = Object.freeze({
  COMPATIBILITY_BRIDGE: 'compatibility_bridge',
  PREVIOUS_NATIVE_INTENT: 'previous_native_intent',
});

const APPROVED_ACTOR_SOURCE_IDS = new Set([
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.POST_UPGRADE_APPLY,
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.TEST_FIXTURE,
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.MAINTAINER_MIGRATION_TOOL,
]);

const ACTOR_TYPE_BY_SOURCE_ID = Object.freeze({
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR]: 'operator',
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.POST_UPGRADE_APPLY]: 'post_upgrade',
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.TEST_FIXTURE]: 'test_fixture',
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.MAINTAINER_MIGRATION_TOOL]: 'maintainer',
});

const REQUIRED_RESTORE_SECTION_IDS = Object.freeze(
  Object.values(POLICY_ROLLBACK_PAYLOAD_SECTION_IDS)
);

const REASON_CODE_PATTERN = /^[a-z0-9][a-z0-9_:-]{0,79}$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isObjectRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Native intent reversion requires a valid server execution time.');
  }

  return date;
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    return asObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeReversionAction(action = {}) {
  const actorSourceId = normalizeString(action.actorSourceId ?? action.actor_source_id);
  const reasonCode = normalizeString(action.reasonCode ?? action.reason_code);

  return {
    actorSourceId,
    actorType: ACTOR_TYPE_BY_SOURCE_ID[actorSourceId] || null,
    actorId: normalizePositiveInteger(action.actorId ?? action.actor_id),
    reasonCode,
  };
}

function validateReversionAction(action = {}) {
  const normalizedAction = normalizeReversionAction(action);

  if (!APPROVED_ACTOR_SOURCE_IDS.has(normalizedAction.actorSourceId)) {
    return {
      ok: false,
      normalizedAction,
      riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.ACTION_NOT_ALLOWED,
      message: 'Native authority reversion requires an approved server-side actor source.',
    };
  }

  if (
    normalizedAction.actorSourceId === POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR &&
    !normalizedAction.actorId
  ) {
    return {
      ok: false,
      normalizedAction,
      riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.ACTION_ACTOR_INVALID,
      message: 'Manual native authority reversion requires a verified operator identity.',
    };
  }

  if (!REASON_CODE_PATTERN.test(normalizedAction.reasonCode)) {
    return {
      ok: false,
      normalizedAction,
      riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.ACTION_REASON_INVALID,
      message: 'Native authority reversion requires a bounded server-side reason code.',
    };
  }

  return {
    ok: true,
    normalizedAction,
  };
}

function isSnapshotExpired(snapshot, now) {
  const expiresAt = new Date(snapshot?.expires_at).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
}

function validateSnapshotManifest({ snapshot, policy }) {
  if (snapshot?.payload_redacted !== false) {
    return {
      ok: false,
      riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.SNAPSHOT_NOT_RESTORABLE,
      message: 'Rollback snapshot payload is unavailable for safe reversion.',
    };
  }

  const payload = parseJsonObject(snapshot.snapshot_payload);
  const restoreSections = new Set(asArray(payload.restore_sections).map(normalizeString));
  const hasRequiredSections = REQUIRED_RESTORE_SECTION_IDS
    .every(sectionId => restoreSections.has(sectionId));
  const policyMatches = normalizePositiveInteger(payload.policy_id) === Number(policy.id);
  const libraryMatches = normalizePositiveInteger(payload.library_id) === Number(policy.library_id);
  const validShape = isObjectRecord(payload.legacy_policy) &&
    Array.isArray(payload.presets) &&
    hasOwn(payload, 'routing_target');

  if (!hasRequiredSections || !policyMatches || !libraryMatches || !validShape) {
    return {
      ok: false,
      riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.SNAPSHOT_MANIFEST_INVALID,
      message: 'Rollback snapshot manifest is incomplete or does not belong to the current policy authority.',
    };
  }

  return { ok: true };
}

function determineReversionTarget({ snapshot, intents = [] } = {}) {
  const snapshotIntentId = Number(snapshot?.intent_id);
  const snapshotIntent = asArray(intents).find(intent => Number(intent.id) === snapshotIntentId) || null;
  const activeIntents = asArray(intents).filter(intent => intent.active === true);

  if (!snapshotIntent || Number(snapshot?.snapshot_version) !== Number(snapshotIntent.intent_version)) {
    return {
      ok: false,
      riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.AUTHORITY_MISMATCH,
      message: 'Rollback snapshot does not match a current native intent version.',
    };
  }

  if (activeIntents.length > 1) {
    return {
      ok: false,
      riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.MULTIPLE_ACTIVE_INTENTS,
      message: 'Native authority is ambiguous and cannot be reverted automatically.',
    };
  }

  if (snapshotIntent.active === true && activeIntents.length === 1 && Number(activeIntents[0].id) === snapshotIntentId) {
    return {
      ok: true,
      targetId: POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS.COMPATIBILITY_BRIDGE,
      snapshotIntent,
      activeIntent: snapshotIntent,
    };
  }

  const activeIntent = activeIntents[0] || null;
  if (
    snapshotIntent.active === false &&
    activeIntent &&
    Number(snapshotIntent.replaced_by_intent_id) === Number(activeIntent.id)
  ) {
    return {
      ok: true,
      targetId: POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS.PREVIOUS_NATIVE_INTENT,
      snapshotIntent,
      activeIntent,
    };
  }

  return {
    ok: false,
    riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.AUTHORITY_MISMATCH,
    message: 'Current native authority is not the direct successor of the rollback snapshot.',
  };
}

function buildPolicyNativeIntentReversionResult({
  statusId,
  evaluatedAt,
  policyId = null,
  snapshotId = null,
  targetId = null,
  applied = false,
  eventWritten = false,
  snapshotMarkedRestored = false,
  riskId = null,
  message = null,
}) {
  const blocked = applied !== true && statusId !== POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.ALREADY_REVERTED;

  return {
    version: POLICY_NATIVE_INTENT_REVERSION_VERSION,
    statusId,
    evaluatedAt,
    policyId,
    snapshotId,
    reversion: {
      applied,
      targetId,
      rawSnapshotExposed: false,
      legacyRowsChanged: false,
    },
    sideEffects: {
      nativeAuthorityChanged: applied,
      rollbackSnapshotMarkedRestored: snapshotMarkedRestored,
      migrationEventWritten: eventWritten,
      legacyRowsChanged: false,
    },
    validation: blocked
      ? {
        ok: false,
        issueCount: 1,
        issues: [{ riskId, message }],
      }
      : {
        ok: true,
        issueCount: 0,
        issues: [],
      },
  };
}

function buildAppliedSummary(targetId) {
  return targetId === POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS.PREVIOUS_NATIVE_INTENT
    ? 'Rollback restored the direct prior native intent authority.'
    : 'Rollback deactivated native authority and restored compatibility authority.';
}

export {
  POLICY_NATIVE_INTENT_REVERSION_RISK_IDS,
  POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS,
  POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS,
  POLICY_NATIVE_INTENT_REVERSION_VERSION,
  buildAppliedSummary,
  buildPolicyNativeIntentReversionResult,
  determineReversionTarget,
  isSnapshotExpired,
  normalizePositiveInteger,
  normalizeString,
  normalizeTimestamp,
  validateReversionAction,
  validateSnapshotManifest,
};
