/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_NATIVE_INTENT_CHANGE_RESULT_VERSION =
  'policy.native_intent_change_result.v1';

const POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS = Object.freeze({
  APPLIED: 'applied',
  STALE_REVISION: 'stale_revision',
  POLICY_REPLACED: 'policy_replaced',
  RECOVERY_REQUIRED: 'recovery_required',
  AUTHORIZATION_REJECTED: 'authorization_rejected',
  UNAVAILABLE_AUTHORITY: 'unavailable_authority',
  UNKNOWN_COMMAND: 'unknown_command',
  IDEMPOTENCY_KEY_IN_PROGRESS: 'idempotency_key_in_progress',
  IDEMPOTENCY_KEY_REUSED: 'idempotency_key_reused',
  RETRYABLE: 'retryable',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
  BLOCKED_BY_TRANSACTION_BOUNDARY: 'blocked_by_transaction_boundary',
});

const POLICY_NATIVE_INTENT_CHANGE_RESULT_RISK_IDS = Object.freeze({
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  TRANSACTION_FAILED: 'transaction_failed',
  REVISION_MISMATCH_AFTER_LOCK: 'revision_mismatch_after_lock',
  NO_ACTIVE_INTENT_AFTER_LOCK: 'no_active_intent_after_lock',
  POLICY_NOT_FOUND: 'policy_not_found',
  IDEMPOTENCY_KEY_IN_PROGRESS: 'idempotency_key_in_progress',
  IDEMPOTENCY_KEY_REUSED: 'idempotency_key_reused',
});

function buildPolicyNativeIntentChangeResult({
  statusId,
  policyId,
  actorId,
  expectedRevision,
  currentRevision,
  newIntentId = null,
  newIntentVersion = null,
  appliedCommandIds = [],
  migrationEventId = null,
  replayed = false,
  receiptVersion = null,
  risks = [],
  evaluatedAt = new Date().toISOString(),
} = {}) {
  const applied = statusId ===
    POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED;

  return {
    version: POLICY_NATIVE_INTENT_CHANGE_RESULT_VERSION,
    statusId,
    evaluatedAt,
    policyId: policyId ?? null,
    actorId: actorId ?? null,
    expectedRevision: expectedRevision ?? null,
    currentRevision: currentRevision ?? null,
    change: {
      applied,
      newIntentId,
      newIntentVersion,
      appliedCommandIds,
      migrationEventId,
      replayed: applied && replayed === true,
      rawPayloadExposed: false,
    },
    risks,
    sideEffects: {
      policyStorageMutated: applied && replayed !== true,
      routingWritten: false,
      learningWritten: false,
      providerAccessed: false,
      databaseWritten: applied && replayed !== true,
    },
    retry: {
      mode: 'durable_idempotency_receipt',
      receiptPersisted: applied,
      replayed: applied && replayed === true,
      receiptVersion: applied ? receiptVersion : null,
      idempotencyKeyExposed: false,
    },
    validation: { ok: true, issueCount: 0, issues: [] },
  };
}

export {
  POLICY_NATIVE_INTENT_CHANGE_RESULT_RISK_IDS,
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
  POLICY_NATIVE_INTENT_CHANGE_RESULT_VERSION,
  buildPolicyNativeIntentChangeResult,
};
