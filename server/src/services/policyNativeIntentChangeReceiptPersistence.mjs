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
  normalizePolicyNativeIntentChangeReceiptRow,
  POLICY_NATIVE_INTENT_CHANGE_RECEIPT_TABLE,
} from './policyNativeIntentChangeReceiptContract.mjs';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

export async function tryLockNativeIntentChangeIdempotencyKey({ client, lockKey }) {
  const result = await client.query(
    'SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired',
    [lockKey],
  );

  return firstRow(result)?.acquired === true;
}

export async function lockPolicyNativeIntentChangeReceipt({ client, idempotencyKey }) {
  const result = await client.query(
    `SELECT
       id,
       receipt_version,
       policy_id,
       actor_id,
       idempotency_key,
       command_fingerprint,
       source_intent_version,
       target_intent_id,
       target_intent_version,
       migration_event_id,
       applied_command_ids,
       result_status_id,
       created_at
     FROM ${POLICY_NATIVE_INTENT_CHANGE_RECEIPT_TABLE}
     WHERE idempotency_key = $1
     FOR UPDATE`,
    [idempotencyKey],
  );

  return normalizePolicyNativeIntentChangeReceiptRow(firstRow(result));
}

export async function insertPolicyNativeIntentChangeReceipt({ client, receipt }) {
  const result = await client.query(
    `INSERT INTO ${POLICY_NATIVE_INTENT_CHANGE_RECEIPT_TABLE} (
       receipt_version,
       policy_id,
       actor_id,
       idempotency_key,
       command_fingerprint,
       source_intent_version,
       target_intent_id,
       target_intent_version,
       migration_event_id,
       applied_command_ids,
       result_status_id,
       created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
     RETURNING
       id,
       receipt_version,
       policy_id,
       actor_id,
       idempotency_key,
       command_fingerprint,
       source_intent_version,
       target_intent_id,
       target_intent_version,
       migration_event_id,
       applied_command_ids,
       result_status_id,
       created_at`,
    [
      receipt.receiptVersion,
      receipt.policyId,
      receipt.actorId,
      receipt.idempotencyKey,
      receipt.commandFingerprint,
      receipt.sourceIntentVersion,
      receipt.targetIntentId,
      receipt.targetIntentVersion,
      receipt.migrationEventId,
      JSON.stringify(receipt.appliedCommandIds),
      receipt.resultStatusId,
      receipt.createdAt,
    ],
  );

  return normalizePolicyNativeIntentChangeReceiptRow(firstRow(result));
}
