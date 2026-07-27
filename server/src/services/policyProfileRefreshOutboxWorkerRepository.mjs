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
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_TABLE,
  requireTransactionClient,
} from './policyProfileRefreshOutboxRepository.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS,
} from './policyProfileRefreshOutboxVocabulary.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS,
} from './policyProfileRefreshOutboxWorkerVocabulary.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeClaimToken(value) {
  const normalized = normalizeString(value, 36).toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new TypeError('Profile refresh outbox worker requires a UUID claim token.');
  }
  return normalized;
}

function normalizeFailureCode(value) {
  const normalized = normalizeString(value, 80);
  const knownCodes = Object.values(POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS);
  if (!knownCodes.includes(normalized)) {
    throw new TypeError('Profile refresh outbox worker requires a known failure code.');
  }
  return normalized;
}

function normalizeClaimedOutboxRow(row = {}) {
  return {
    id: normalizeIdentifier(row.id),
    libraryId: normalizeIdentifier(row.library_id),
    attemptCount: Number(row.attempt_count) || 0,
    requestType: normalizeString(row.request_type, 40),
  };
}

async function closeExpiredPolicyProfileRefreshOutboxClaims({
  client,
  maxAttempts = POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS,
  failureCode = POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.LEASE_EXPIRED,
} = {}) {
  requireTransactionClient(client);
  const result = await client.query(
    `UPDATE ${POLICY_PROFILE_REFRESH_OUTBOX_TABLE}
     SET processing_state = $1,
         claim_token = NULL,
         claimed_at = NULL,
         lease_expires_at = NULL,
         failure_code = $2,
         updated_at = NOW()
     WHERE processing_state = $3
       AND lease_expires_at <= NOW()
       AND attempt_count >= $4
     RETURNING id`,
    [
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.FAILED,
      normalizeFailureCode(failureCode),
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.PROCESSING,
      normalizePositiveInteger(maxAttempts, POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS),
    ],
  );

  return Array.isArray(result?.rows) ? result.rows.length : 0;
}

async function claimPolicyProfileRefreshOutboxBatch({
  client,
  claimToken,
  limit,
  leaseSeconds,
  maxAttempts = POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS,
} = {}) {
  requireTransactionClient(client);
  const result = await client.query(
    `WITH eligible AS (
       SELECT id
       FROM ${POLICY_PROFILE_REFRESH_OUTBOX_TABLE}
       WHERE request_type = ANY($1::text[])
         AND attempt_count < $2
         AND (
           (processing_state = $3 AND available_at <= NOW())
           OR
           (processing_state = $4 AND lease_expires_at <= NOW())
         )
       ORDER BY created_at ASC, id ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $5
     )
     UPDATE ${POLICY_PROFILE_REFRESH_OUTBOX_TABLE} AS outbox
     SET processing_state = $4,
         attempt_count = outbox.attempt_count + 1,
         claim_token = $6::uuid,
         claimed_at = NOW(),
         lease_expires_at = NOW() + ($7::integer * INTERVAL '1 second'),
         updated_at = NOW()
     FROM eligible
     WHERE outbox.id = eligible.id
     RETURNING outbox.id, outbox.library_id, outbox.attempt_count, outbox.request_type`,
    [
      Object.values(POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS),
      normalizePositiveInteger(maxAttempts, POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS),
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.PENDING,
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.PROCESSING,
      normalizePositiveInteger(limit, 1),
      normalizeClaimToken(claimToken),
      normalizePositiveInteger(leaseSeconds, 1),
    ],
  );

  return Array.isArray(result?.rows)
    ? result.rows.map(normalizeClaimedOutboxRow).filter(record => record.id && record.libraryId)
    : [];
}

async function completePolicyProfileRefreshOutboxClaim({
  client,
  outboxId,
  claimToken,
} = {}) {
  requireTransactionClient(client);
  const result = await client.query(
    `UPDATE ${POLICY_PROFILE_REFRESH_OUTBOX_TABLE}
     SET processing_state = $1,
         claim_token = NULL,
         claimed_at = NULL,
         lease_expires_at = NULL,
         completed_at = NOW(),
         failure_code = NULL,
         updated_at = NOW()
     WHERE id = $2
       AND processing_state = $3
       AND claim_token = $4::uuid
     RETURNING id`,
    [
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.COMPLETED,
      normalizeIdentifier(outboxId),
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.PROCESSING,
      normalizeClaimToken(claimToken),
    ],
  );

  return Boolean(firstRow(result)?.id);
}

async function failPolicyProfileRefreshOutboxClaim({
  client,
  outboxId,
  claimToken,
  maxAttempts = POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS,
  retryDelaySeconds,
  failureCode = POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.EXECUTION_FAILED,
} = {}) {
  requireTransactionClient(client);
  const result = await client.query(
    `UPDATE ${POLICY_PROFILE_REFRESH_OUTBOX_TABLE}
     SET processing_state = CASE
           WHEN attempt_count >= $1 THEN $2
           ELSE $3
         END,
         available_at = CASE
           WHEN attempt_count >= $1 THEN available_at
           ELSE NOW() + ($4::integer * INTERVAL '1 second')
         END,
         claim_token = NULL,
         claimed_at = NULL,
         lease_expires_at = NULL,
         failure_code = $5,
         updated_at = NOW()
     WHERE id = $6
       AND processing_state = $7
       AND claim_token = $8::uuid
     RETURNING id, processing_state, attempt_count`,
    [
      normalizePositiveInteger(maxAttempts, POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS),
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.FAILED,
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.PENDING,
      normalizePositiveInteger(retryDelaySeconds, 1),
      normalizeFailureCode(failureCode),
      normalizeIdentifier(outboxId),
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.PROCESSING,
      normalizeClaimToken(claimToken),
    ],
  );
  const record = firstRow(result);

  return {
    updated: Boolean(record?.id),
    terminal: record?.processing_state === POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.FAILED,
  };
}

const policyProfileRefreshOutboxWorkerRepository = Object.freeze({
  claimBatch: claimPolicyProfileRefreshOutboxBatch,
  closeExpiredClaims: closeExpiredPolicyProfileRefreshOutboxClaims,
  completeClaim: completePolicyProfileRefreshOutboxClaim,
  failClaim: failPolicyProfileRefreshOutboxClaim,
});

export {
  claimPolicyProfileRefreshOutboxBatch,
  closeExpiredPolicyProfileRefreshOutboxClaims,
  completePolicyProfileRefreshOutboxClaim,
  failPolicyProfileRefreshOutboxClaim,
  normalizeClaimedOutboxRow,
  normalizeClaimToken,
  policyProfileRefreshOutboxWorkerRepository,
};
