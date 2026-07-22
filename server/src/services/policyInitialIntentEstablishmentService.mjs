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
  POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_VERSION,
  PolicyInitialIntentEstablishmentRequestError,
  buildInitialIntentRequestFingerprint,
  buildInitialPolicyIntentContract,
  validatePolicyInitialIntentEstablishmentRequest,
} from './policyInitialIntentEstablishmentContract.mjs';
import {
  buildObservedEvidenceProvenanceSnapshot,
} from './policyObservedEvidenceProvenanceContract.mjs';
import {
  insertObservedEvidenceProvenanceSnapshot,
  readStoredLibraryProfileForProvenance,
} from './policyObservedEvidenceProvenancePersistence.mjs';
import {
  clearInitialEstablishmentReconciliationState,
  completeInitialEstablishment,
  insertInitialIntentMigrationEvent,
  insertInitialIntentRollbackSnapshot,
  insertInitialIntentRoutingTarget,
  insertInitialIntentRules,
  insertInitialIntentValidationStatus,
  insertInitialNativeIntentHeader,
  lockInitialEstablishmentByIdempotencyKey,
  lockInitialEstablishmentByPolicyId,
  lockLegacyPolicyConfiguration,
  lockLibraryRoutingTarget,
  lockNativeIntentHistory,
  lockPolicyForInitialIntentEstablishment,
  reserveInitialEstablishment,
} from './policyInitialIntentEstablishmentPersistence.mjs';

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Initial native intent establishment requires a valid server execution time.');
  }

  return date;
}

function buildResult({
  statusId,
  policyId = null,
  establishedAt,
  establishmentId = null,
  intentId = null,
  rollbackSnapshotId = null,
  applied = false,
  replayed = false,
  routingConfigured = false,
  reconciliationStateCleared = false,
  ruleCount = 0,
  riskId = null,
  message = null,
} = {}) {
  const blocked = applied !== true && replayed !== true;

  return {
    version: POLICY_INITIAL_INTENT_ESTABLISHMENT_VERSION,
    statusId,
    policyId,
    establishedAt,
    establishment: {
      id: establishmentId,
      intentId,
      rollbackSnapshotId,
      applied,
      replayed,
      authoritySourceId: 'operator_declared_intent',
      automationStarted: false,
    },
    sideEffects: {
      nativeAuthorityCreated: applied,
      rollbackSnapshotCreated: applied,
      routingConfigurationCopied: applied && routingConfigured,
      reconciliationStateCleared: applied && reconciliationStateCleared,
      automatedRoutingStarted: false,
      legacyRowsChanged: false,
    },
    summary: {
      ruleCount,
      routingConfigured,
      rawDeclaredIntentExposed: false,
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

function buildReplayResult({ existing, policyId, establishedAt }) {
  return buildResult({
    statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.REPLAYED,
    policyId,
    establishedAt,
    establishmentId: Number(existing.id),
    intentId: Number(existing.intent_id),
    rollbackSnapshotId: Number(existing.rollback_snapshot_id),
    replayed: true,
    routingConfigured: false,
    ruleCount: 0,
  });
}

function isMatchingReplay({ existing, policyId, actorId, requestFingerprint }) {
  return Number(existing.policy_id) === Number(policyId)
    && Number(existing.accepted_by) === Number(actorId)
    && existing.request_fingerprint === requestFingerprint
    && existing.state === 'established';
}

function hasLegacyConfiguration(configuration = {}) {
  return Number(configuration.presetCount) > 0 || Number(configuration.overrideCount) > 0;
}

function preparePolicyInitialIntentEstablishment({
  policyId,
  actorId,
  request,
  now = new Date(),
} = {}) {
  const establishedAt = normalizeTimestamp(now).toISOString();
  const normalizedPolicyId = normalizePositiveInteger(policyId);
  const normalizedActorId = normalizePositiveInteger(actorId);

  if (!normalizedActorId) {
    return {
      context: null,
      result: buildResult({
      statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_REQUEST,
      policyId: normalizedPolicyId,
      establishedAt,
      riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.ACTOR_REQUIRED,
      message: 'Initial native intent establishment requires a verified administrator identity.',
      }),
    };
  }

  let validatedRequest;
  try {
    validatedRequest = validatePolicyInitialIntentEstablishmentRequest(request);
  } catch (error) {
    const message = error instanceof PolicyInitialIntentEstablishmentRequestError
      ? error.message
      : 'Initial native intent establishment request is invalid.';

    return {
      context: null,
      result: buildResult({
      statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_REQUEST,
      policyId: normalizedPolicyId,
      establishedAt,
      riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.DECLARED_INTENT_INVALID,
      message,
      }),
    };
  }

  if (!normalizedPolicyId) {
    return {
      context: null,
      result: buildResult({
      statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_REQUEST,
      policyId: null,
      establishedAt,
      riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.POLICY_NOT_FOUND,
      message: 'Initial native intent establishment requires a positive policy identifier.',
      }),
    };
  }

  return {
    context: {
      establishedAt,
      normalizedActorId,
      normalizedPolicyId,
      requestFingerprint: buildInitialIntentRequestFingerprint(validatedRequest),
      validatedRequest,
    },
    result: null,
  };
}

async function establishPolicyInitialIntentWithClient({ client, context }) {
  const {
    establishedAt,
    normalizedActorId,
    normalizedPolicyId,
    requestFingerprint,
    validatedRequest,
  } = context;

  const policy = await lockPolicyForInitialIntentEstablishment(client, normalizedPolicyId);
      if (!policy) {
        return buildResult({
          statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_AUTHORITY,
          policyId: normalizedPolicyId,
          establishedAt,
          riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.POLICY_NOT_FOUND,
          message: 'The policy is no longer available for initial intent establishment.',
        });
      }

      const existingByKey = await lockInitialEstablishmentByIdempotencyKey(
        client,
        validatedRequest.idempotency_key
      );
      if (existingByKey) {
        if (isMatchingReplay({
          existing: existingByKey,
          policyId: policy.id,
          actorId: normalizedActorId,
          requestFingerprint,
        })) {
          return buildReplayResult({
            existing: existingByKey,
            policyId: Number(policy.id),
            establishedAt,
          });
        }

        return buildResult({
          statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_AUTHORITY,
          policyId: Number(policy.id),
          establishedAt,
          riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.IDEMPOTENCY_KEY_REUSED,
          message: 'The idempotency key is already bound to a different initial intent establishment.',
        });
      }

      const existingByPolicy = await lockInitialEstablishmentByPolicyId(client, policy.id);
      if (existingByPolicy) {
        return buildResult({
          statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_AUTHORITY,
          policyId: Number(policy.id),
          establishedAt,
          riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.EXISTING_ESTABLISHMENT,
          message: 'This policy already has a recorded initial native intent establishment.',
        });
      }

      const legacyConfiguration = await lockLegacyPolicyConfiguration(client, policy.id);
      if (hasLegacyConfiguration(legacyConfiguration)) {
        return buildResult({
          statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_AUTHORITY,
          policyId: Number(policy.id),
          establishedAt,
          riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.LEGACY_CONFIGURATION_PRESENT,
          message: 'Initial establishment is limited to policies with no legacy preset attachments or policy overrides.',
        });
      }

      const nativeIntentHistory = await lockNativeIntentHistory(client, policy.id);
      if (nativeIntentHistory.length > 0) {
        const riskId = nativeIntentHistory.some(intent => intent.active === true)
          ? POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.ACTIVE_NATIVE_INTENT
          : POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.NATIVE_INTENT_HISTORY_PRESENT;
        return buildResult({
          statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_AUTHORITY,
          policyId: Number(policy.id),
          establishedAt,
          riskId,
          message: 'Initial establishment is unavailable after native policy authority has been recorded.',
        });
      }

      const contract = buildInitialPolicyIntentContract({
        policy,
        declaredIntent: validatedRequest.declared_intent,
      });
      if (contract.validation.valid !== true || contract.purpose.length === 0) {
        return buildResult({
          statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_REQUEST,
          policyId: Number(policy.id),
          establishedAt,
          riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.DECLARED_INTENT_INVALID,
          message: 'The declared intent cannot be materialized as safe native policy authority.',
        });
      }

      const reservationId = await reserveInitialEstablishment({
        client,
        policyId: policy.id,
        libraryId: policy.library_id,
        idempotencyKey: validatedRequest.idempotency_key,
        requestFingerprint,
        actorId: normalizedActorId,
      });
      if (!reservationId) {
        const concurrent = await lockInitialEstablishmentByIdempotencyKey(
          client,
          validatedRequest.idempotency_key
        );
        if (concurrent && isMatchingReplay({
          existing: concurrent,
          policyId: policy.id,
          actorId: normalizedActorId,
          requestFingerprint,
        })) {
          return buildReplayResult({
            existing: concurrent,
            policyId: Number(policy.id),
            establishedAt,
          });
        }

        return buildResult({
          statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_AUTHORITY,
          policyId: Number(policy.id),
          establishedAt,
          riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.IDEMPOTENCY_KEY_REUSED,
          message: 'The idempotency key cannot be reused for this initial intent establishment.',
        });
      }

      const routingTarget = await lockLibraryRoutingTarget(client, policy.library_id);
      const intentId = await insertInitialNativeIntentHeader({
        client,
        policy,
        contract,
        actorId: normalizedActorId,
        establishedAt,
      });
      if (!intentId) {
        throw new Error('Initial native intent header did not return an identifier.');
      }

      // This captures only the already-stored, bounded library observation. It
      // cannot alter the operator-declared native authority created above.
      const storedLibraryProfile = await readStoredLibraryProfileForProvenance({
        client,
        libraryId: policy.library_id,
      });
      const observedEvidenceProvenance = buildObservedEvidenceProvenanceSnapshot({
        profile: storedLibraryProfile,
        now: establishedAt,
      });
      const observedEvidenceProvenanceSnapshotId =
        await insertObservedEvidenceProvenanceSnapshot({
          client,
          establishmentId: reservationId,
          policyId: policy.id,
          libraryId: policy.library_id,
          intentId,
          provenance: observedEvidenceProvenance,
        });
      if (!observedEvidenceProvenanceSnapshotId) {
        throw new Error('Observed evidence provenance snapshot did not return an identifier.');
      }

      const rulesInserted = await insertInitialIntentRules({ client, intentId, contract });
      const routingConfigured = await insertInitialIntentRoutingTarget({
        client,
        intentId,
        policy,
        routingTarget,
      });
      await insertInitialIntentValidationStatus({ client, intentId, contract });
      const migrationEventId = await insertInitialIntentMigrationEvent({
        client,
        intentId,
        policyId: policy.id,
        actorId: normalizedActorId,
        requestFingerprint,
      });
      const rollbackSnapshotId = await insertInitialIntentRollbackSnapshot({
        client,
        intentId,
        policy,
        routingTarget,
        establishedAt,
      });
      const completedId = await completeInitialEstablishment({
        client,
        establishmentId: reservationId,
        intentId,
        migrationEventId,
        rollbackSnapshotId,
        establishedAt,
      });
      if (!migrationEventId || !rollbackSnapshotId || !completedId) {
        throw new Error('Initial native intent establishment audit record was incomplete.');
      }
      const clearedReconciliationPolicyId = await clearInitialEstablishmentReconciliationState({
        client,
        policyId: policy.id,
      });

      return buildResult({
        statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.ESTABLISHED,
        policyId: Number(policy.id),
        establishedAt,
        establishmentId: Number(completedId),
        intentId: Number(intentId),
        rollbackSnapshotId: Number(rollbackSnapshotId),
        applied: true,
        routingConfigured,
        reconciliationStateCleared: Number(clearedReconciliationPolicyId) === Number(policy.id),
        ruleCount: rulesInserted,
      });
}

async function applyPolicyInitialIntentEstablishmentInTransaction({
  client,
  policyId,
  actorId,
  request,
  now = new Date(),
} = {}) {
  const prepared = preparePolicyInitialIntentEstablishment({
    policyId,
    actorId,
    request,
    now,
  });

  if (prepared.result) {
    return prepared.result;
  }

  if (typeof client?.query !== 'function') {
    return buildResult({
      statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY,
      policyId: prepared.context.normalizedPolicyId,
      establishedAt: prepared.context.establishedAt,
      riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.TRANSACTION_BOUNDARY_REQUIRED,
      message: 'Initial native intent establishment requires an atomic database transaction.',
    });
  }

  return establishPolicyInitialIntentWithClient({
    client,
    context: prepared.context,
  });
}

async function applyPolicyInitialIntentEstablishment({
  dbClient,
  policyId,
  actorId,
  request,
  now = new Date(),
} = {}) {
  const prepared = preparePolicyInitialIntentEstablishment({
    policyId,
    actorId,
    request,
    now,
  });

  if (prepared.result) {
    return prepared.result;
  }

  if (typeof dbClient?.withTransaction !== 'function') {
    return buildResult({
      statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY,
      policyId: prepared.context.normalizedPolicyId,
      establishedAt: prepared.context.establishedAt,
      riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.TRANSACTION_BOUNDARY_REQUIRED,
      message: 'Initial native intent establishment requires an atomic database transaction.',
    });
  }

  try {
    return await dbClient.withTransaction(client => establishPolicyInitialIntentWithClient({
      client,
      context: prepared.context,
    }));
  } catch {
    return buildResult({
      statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.FAILED_ROLLED_BACK,
      policyId: prepared.context.normalizedPolicyId,
      establishedAt: prepared.context.establishedAt,
      riskId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.TRANSACTION_FAILED,
      message: 'Initial native intent establishment failed and the transaction was rolled back.',
    });
  }
}

export {
  POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_VERSION,
  applyPolicyInitialIntentEstablishmentInTransaction,
  applyPolicyInitialIntentEstablishment,
};
