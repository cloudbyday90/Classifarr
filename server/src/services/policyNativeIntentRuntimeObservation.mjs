/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  attachActiveNativeIntentForPolicy,
} from './policyNativePolicyReadService.mjs';
import {
  POLICY_RUNTIME_READ_SOURCE_IDS,
  POLICY_RUNTIME_READ_STATUS_IDS,
  buildPolicyIntentRuntimeReadPath,
} from './policyIntentRuntimeReadPath.mjs';

const POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_VERSION =
  'policy.native_intent_runtime_observation.v1';
const MAX_POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_POLICIES = 25;

const POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS = Object.freeze({
  VERIFIED: 'verified',
  BLOCKED: 'blocked',
  UNAVAILABLE: 'unavailable',
});

const POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS = Object.freeze({
  INVALID_SELECTION: 'invalid_selection',
  POLICY_NOT_FOUND: 'policy_not_found',
  NATIVE_RUNTIME_READ_NOT_VERIFIED: 'native_runtime_read_not_verified',
  ROLLBACK_NOT_AVAILABLE: 'rollback_not_available',
  OBSERVATION_UNAVAILABLE: 'observation_unavailable',
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
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizePolicyIds(policyIds) {
  const normalizedPolicyIds = asArray(policyIds).map(normalizePositiveInteger);

  if (
    normalizedPolicyIds.length === 0 ||
    normalizedPolicyIds.some(policyId => !policyId) ||
    new Set(normalizedPolicyIds).size !== normalizedPolicyIds.length ||
    normalizedPolicyIds.length > MAX_POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_POLICIES
  ) {
    return [];
  }

  return normalizedPolicyIds;
}

function buildSideEffects() {
  return {
    policyStorageMutated: false,
    nativeRowsWritten: false,
    rollbackSnapshotsWritten: false,
    legacyPathsDeleted: false,
  };
}

function buildRisk(riskId, message, policyId = null) {
  return {
    riskId,
    message,
    ...(policyId ? { policyId } : {}),
  };
}

function buildObservation({
  observedAt,
  statusId,
  requestedPolicyIds,
  policies = [],
  risks = [],
} = {}) {
  const nativeReadVerifiedCount = asArray(policies)
    .filter(policy => policy.nativeRead?.verified === true)
    .length;
  const rollbackAvailableCount = asArray(policies)
    .filter(policy => policy.rollbackAvailable === true)
    .length;
  const observation = {
    version: POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_VERSION,
    observedAt,
    statusId,
    summary: {
      requestedPolicyCount: asArray(requestedPolicyIds).length,
      observedPolicyCount: asArray(policies).length,
      nativeReadVerifiedCount,
      rollbackAvailableCount,
    },
    policies: asArray(policies),
    riskCount: asArray(risks).length,
    risks: asArray(risks),
    sideEffects: buildSideEffects(),
    nextStep: {
      stepId: 'compatibility_path_deletion_readiness',
      label: 'Compatibility Path Deletion Readiness',
      reason: 'This observation proves only the selected policies now resolve through their live native read path; compatibility deletion remains separately gated.',
    },
  };

  return {
    ...observation,
    validation: validatePolicyNativeIntentRuntimeObservation(observation),
  };
}

async function loadObservationPolicies({ dbClient, policyIds }) {
  const result = await dbClient.query(`
    SELECT
      lp.id,
      lp.library_id,
      l.name AS library_name,
      l.media_type AS library_media_type
    FROM library_policies lp
    LEFT JOIN libraries l ON l.id = lp.library_id
    WHERE lp.id = ANY($1::integer[])
    ORDER BY lp.id ASC
  `, [policyIds]);

  return asArray(result.rows);
}

async function loadRollbackAvailability({ dbClient, policyIds, observedAt }) {
  const result = await dbClient.query(`
    SELECT DISTINCT ON (policy_id)
      policy_id
    FROM policy_intent_rollback_snapshots
    WHERE policy_id = ANY($1::integer[])
      AND expires_at > $2::timestamptz
      AND restored_at IS NULL
      AND payload_redacted = FALSE
    ORDER BY policy_id, expires_at DESC, id DESC
  `, [policyIds, observedAt]);

  return new Set(asArray(result.rows)
    .map(row => normalizePositiveInteger(row?.policy_id))
    .filter(Boolean));
}

function buildPolicyObservation({ policy, readPath, rollbackAvailable }) {
  const nativeReadVerified = (
    readPath.sourceId === POLICY_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT &&
    readPath.statusId === POLICY_RUNTIME_READ_STATUS_IDS.NATIVE_INTENT_ACTIVE &&
    readPath.validation?.ok === true &&
    readPath.policy_intent_contract?.validation?.valid === true &&
    readPath.dependsOnCustomSignals === false
  );

  return {
    policyId: policy.id,
    nativeRead: {
      verified: nativeReadVerified,
      sourceId: readPath.sourceId,
      statusId: readPath.statusId,
      validationOk: readPath.validation?.ok === true,
      authorityStateId:
        readPath.trace?.attributes?.['classifarr.policy.read.authority_state'] ?? null,
      activeIntentCount:
        readPath.trace?.attributes?.['classifarr.policy.read.active_intent_count'] ?? null,
    },
    rollbackAvailable,
  };
}

async function buildPolicyNativeIntentRuntimeObservation({
  dbClient,
  policyIds,
  now = null,
} = {}) {
  const observedAt = normalizeTimestamp(now);
  const requestedPolicyIds = normalizePolicyIds(policyIds);

  if (!dbClient || typeof dbClient.query !== 'function') {
    throw new TypeError('dbClient with query(sql, params) is required');
  }

  if (requestedPolicyIds.length === 0) {
    return buildObservation({
      observedAt,
      statusId: POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS.BLOCKED,
      requestedPolicyIds,
      risks: [buildRisk(
        POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS.INVALID_SELECTION,
        `Select between 1 and ${MAX_POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_POLICIES} unique policies for runtime observation.`
      )],
    });
  }

  try {
    const [storedPolicies, rollbackPolicyIds] = await Promise.all([
      loadObservationPolicies({ dbClient, policyIds: requestedPolicyIds }),
      loadRollbackAvailability({ dbClient, policyIds: requestedPolicyIds, observedAt }),
    ]);
    const policiesById = new Map(storedPolicies.map(policy => [Number(policy.id), policy]));
    const observations = [];
    const risks = [];

    for (const policyId of requestedPolicyIds) {
      const policy = policiesById.get(policyId);

      if (!policy) {
        risks.push(buildRisk(
          POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS.POLICY_NOT_FOUND,
          'Selected policy was not available for post-conversion runtime observation.',
          policyId
        ));
        continue;
      }

      const policyWithNativeIntent = await attachActiveNativeIntentForPolicy({
        dbClient,
        policy,
      });
      const readPath = buildPolicyIntentRuntimeReadPath({
        policy: policyWithNativeIntent,
      });
      const observation = buildPolicyObservation({
        policy,
        readPath,
        rollbackAvailable: rollbackPolicyIds.has(policyId),
      });
      observations.push(observation);

      if (!observation.nativeRead.verified) {
        risks.push(buildRisk(
          POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS.NATIVE_RUNTIME_READ_NOT_VERIFIED,
          'The selected policy did not resolve through a valid active native intent read path.',
          policyId
        ));
      }

      if (!observation.rollbackAvailable) {
        risks.push(buildRisk(
          POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS.ROLLBACK_NOT_AVAILABLE,
          'The selected policy does not have an active, unredacted rollback snapshot.',
          policyId
        ));
      }
    }

    return buildObservation({
      observedAt,
      statusId: risks.length === 0
        ? POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS.VERIFIED
        : POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS.BLOCKED,
      requestedPolicyIds,
      policies: observations,
      risks,
    });
  } catch {
    return buildObservation({
      observedAt,
      statusId: POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS.UNAVAILABLE,
      requestedPolicyIds,
      risks: [buildRisk(
        POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS.OBSERVATION_UNAVAILABLE,
        'Post-conversion runtime observation could not be completed. Conversion was not reversed automatically.'
      )],
    });
  }
}

function validatePolicyNativeIntentRuntimeObservation(observation = {}) {
  const issues = [];

  if (!Object.values(POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS)
    .includes(observation.statusId)) {
    issues.push({
      riskId: 'unknown_status',
      message: 'Native intent runtime observation status must be known.',
    });
  }

  if (observation.riskCount !== asArray(observation.risks).length) {
    issues.push({
      riskId: 'risk_count_mismatch',
      message: 'Runtime observation risk count must match the bounded risk list.',
    });
  }

  if (observation.summary?.observedPolicyCount !== asArray(observation.policies).length) {
    issues.push({
      riskId: 'observed_policy_count_mismatch',
      message: 'Runtime observation policy count must match the bounded policy list.',
    });
  }

  Object.entries(observation.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Native runtime observation cannot perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  MAX_POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_POLICIES,
  POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS,
  POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS,
  POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_VERSION,
  buildPolicyNativeIntentRuntimeObservation,
  validatePolicyNativeIntentRuntimeObservation,
};
