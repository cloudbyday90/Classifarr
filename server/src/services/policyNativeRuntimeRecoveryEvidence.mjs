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

import {
  buildNativeIntentAuthoritySqlPredicate,
} from './policyNativeIntentAuthorityEligibility.mjs';

const POLICY_NATIVE_RUNTIME_RECOVERY_EVIDENCE_VERSION =
  'policy.native_runtime_recovery_evidence.v1';
const MAX_UNAVAILABLE_POLICY_ID_SAMPLES = 10;

const POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS = Object.freeze({
  ROLLBACK_AVAILABLE: 'rollback_available',
  BLOCKED_BY_ROLLBACK: 'blocked_by_rollback',
  INVALID_EVIDENCE: 'invalid_evidence',
});

const POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS = Object.freeze({
  INVALID_POLICY_ID: 'invalid_policy_id',
  DUPLICATE_POLICY_ID: 'duplicate_policy_id',
  ROLLBACK_SNAPSHOT_UNAVAILABLE: 'rollback_snapshot_unavailable',
  UNKNOWN_STATUS: 'unknown_status',
  ROLLBACK_AVAILABILITY_MISMATCH: 'rollback_availability_mismatch',
  RECOVERY_COUNT_MISMATCH: 'recovery_count_mismatch',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value !== 'string' || !value.trim()) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function resolveEvaluationTime(value) {
  return normalizeTimestamp(value) || new Date().toISOString();
}

function isRollbackSnapshotAvailable(record = {}, evaluatedAt = new Date()) {
  const snapshotId = normalizePositiveInteger(record.rollback_snapshot_id);
  const expiresAt = normalizeTimestamp(record.rollback_expires_at);
  const evaluationTime = new Date(evaluatedAt).getTime();
  const expiryTime = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;

  return snapshotId !== null &&
    record.rollback_payload_redacted !== true &&
    !normalizeTimestamp(record.rollback_restored_at) &&
    Number.isFinite(expiryTime) &&
    expiryTime > evaluationTime;
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function buildPolicyNativeRuntimeRecoveryEvidence({
  records = [],
  generatedAt = null,
} = {}) {
  const evaluatedAt = resolveEvaluationTime(generatedAt);
  const policyIds = new Set();
  const unavailablePolicyIds = [];
  const risks = [];

  asArray(records).forEach(record => {
    const policyId = normalizePositiveInteger(record?.policy_id ?? record?.policyId);

    if (policyId === null) {
      risks.push(buildRisk(
        POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS.INVALID_POLICY_ID,
        'Recovery evidence must identify every assessed native policy with a positive policy ID.'
      ));
      return;
    }

    if (policyIds.has(policyId)) {
      risks.push(buildRisk(
        POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS.DUPLICATE_POLICY_ID,
        'Recovery evidence must assess each native policy once.',
        { policyId }
      ));
      return;
    }

    policyIds.add(policyId);
    if (!isRollbackSnapshotAvailable(record, evaluatedAt)) {
      unavailablePolicyIds.push(policyId);
      risks.push(buildRisk(
        POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS.ROLLBACK_SNAPSHOT_UNAVAILABLE,
        'An enabled native policy does not have a current rollback snapshot available.',
        { policyId }
      ));
    }
  });

  const assessedNativePolicyCount = policyIds.size;
  const unavailablePolicyCount = unavailablePolicyIds.length;
  const rollbackAvailablePolicyCount = assessedNativePolicyCount - unavailablePolicyCount;
  const rollbackAvailable = risks.length === 0;
  const statusId = risks.some(risk => [
    POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS.INVALID_POLICY_ID,
    POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS.DUPLICATE_POLICY_ID,
  ].includes(risk.riskId))
    ? POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS.INVALID_EVIDENCE
    : rollbackAvailable
      ? POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS.ROLLBACK_AVAILABLE
      : POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS.BLOCKED_BY_ROLLBACK;

  const evidence = {
    version: POLICY_NATIVE_RUNTIME_RECOVERY_EVIDENCE_VERSION,
    generatedAt: evaluatedAt,
    statusId,
    rollbackAvailable,
    recovery: {
      assessedNativePolicyCount,
      rollbackAvailablePolicyCount,
      unavailablePolicyCount,
      sampleUnavailablePolicyIds: unavailablePolicyIds
        .sort((left, right) => left - right)
        .slice(0, MAX_UNAVAILABLE_POLICY_ID_SAMPLES),
      rawSnapshotPayloadExposed: false,
    },
    riskCount: risks.length,
    risks,
    sideEffects: {
      databaseMutated: false,
      rollbackSnapshotsWritten: false,
      snapshotPayloadReadIntoReport: false,
    },
  };

  return {
    ...evidence,
    validation: validatePolicyNativeRuntimeRecoveryEvidence(evidence),
  };
}

function validatePolicyNativeRuntimeRecoveryEvidence(evidence = {}) {
  const issues = [];
  const recovery = evidence.recovery || {};
  const assessedNativePolicyCount = Number(recovery.assessedNativePolicyCount);
  const rollbackAvailablePolicyCount = Number(recovery.rollbackAvailablePolicyCount);
  const unavailablePolicyCount = Number(recovery.unavailablePolicyCount);
  const expectedStatusId = evidence.rollbackAvailable === true
    ? POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS.ROLLBACK_AVAILABLE
    : POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS.BLOCKED_BY_ROLLBACK;

  if (!Object.values(POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS).includes(evidence.statusId)) {
    issues.push(buildRisk(
      POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS.UNKNOWN_STATUS,
      'Recovery evidence status must be known.'
    ));
  }

  if (
    evidence.statusId !== POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS.INVALID_EVIDENCE &&
    evidence.statusId !== expectedStatusId
  ) {
    issues.push(buildRisk(
      POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS.ROLLBACK_AVAILABILITY_MISMATCH,
      'Recovery evidence status must agree with measured rollback availability.'
    ));
  }

  if (
    !Number.isInteger(assessedNativePolicyCount) || assessedNativePolicyCount < 0 ||
    !Number.isInteger(rollbackAvailablePolicyCount) || rollbackAvailablePolicyCount < 0 ||
    !Number.isInteger(unavailablePolicyCount) || unavailablePolicyCount < 0 ||
    assessedNativePolicyCount !== rollbackAvailablePolicyCount + unavailablePolicyCount
  ) {
    issues.push(buildRisk(
      POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS.RECOVERY_COUNT_MISMATCH,
      'Recovery evidence counts must describe one bounded native-policy assessment.'
    ));
  }

  Object.entries(evidence.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Recovery evidence cannot perform side effect "${key}".`
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

async function fetchPolicyNativeRuntimeRecoveryRecords(dbClient) {
  if (!dbClient || typeof dbClient.query !== 'function') {
    throw new TypeError('A database client with query(text) is required.');
  }

  const authoritativeNativeIntentPredicate = buildNativeIntentAuthoritySqlPredicate({
    intentAlias: 'native_intent',
  });
  const result = await dbClient.query(`
    WITH active_intent_counts AS (
      SELECT
        policy_id,
        COUNT(*)::int AS active_intent_count
      FROM policy_intents
      WHERE active = TRUE
      GROUP BY policy_id
    )
    SELECT
      policy.id AS policy_id,
      native_intent.id AS native_intent_id,
      rollback_snapshot.id AS rollback_snapshot_id,
      rollback_snapshot.payload_redacted AS rollback_payload_redacted,
      rollback_snapshot.restored_at AS rollback_restored_at,
      rollback_snapshot.expires_at AS rollback_expires_at
    FROM library_policies policy
    INNER JOIN active_intent_counts active_intent_counts
      ON active_intent_counts.policy_id = policy.id
      AND active_intent_counts.active_intent_count = 1
    INNER JOIN policy_intents native_intent
      ON native_intent.policy_id = policy.id
      AND ${authoritativeNativeIntentPredicate}
    LEFT JOIN LATERAL (
      SELECT
        snapshot.id,
        snapshot.payload_redacted,
        snapshot.restored_at,
        snapshot.expires_at
      FROM policy_intent_rollback_snapshots snapshot
      WHERE snapshot.policy_id = policy.id
        AND snapshot.intent_id = native_intent.id
      ORDER BY snapshot.created_at DESC, snapshot.id DESC
      LIMIT 1
    ) rollback_snapshot ON TRUE
    WHERE policy.enabled = TRUE
    ORDER BY policy.id ASC
  `);

  return asArray(result?.rows);
}

async function loadPolicyNativeRuntimeRecoveryEvidence(dbClient, {
  generatedAt = null,
} = {}) {
  const records = await fetchPolicyNativeRuntimeRecoveryRecords(dbClient);

  return buildPolicyNativeRuntimeRecoveryEvidence({ records, generatedAt });
}

export {
  MAX_UNAVAILABLE_POLICY_ID_SAMPLES,
  POLICY_NATIVE_RUNTIME_RECOVERY_EVIDENCE_VERSION,
  POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS,
  POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS,
  buildPolicyNativeRuntimeRecoveryEvidence,
  fetchPolicyNativeRuntimeRecoveryRecords,
  isRollbackSnapshotAvailable,
  loadPolicyNativeRuntimeRecoveryEvidence,
  validatePolicyNativeRuntimeRecoveryEvidence,
};
