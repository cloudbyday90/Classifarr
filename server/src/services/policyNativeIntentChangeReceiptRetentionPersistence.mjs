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
  POLICY_NATIVE_INTENT_CHANGE_RECEIPT_TABLE,
} from './policyNativeIntentChangeReceiptContract.mjs';
import {
  normalizeReceiptCount,
} from './policyNativeIntentChangeReceiptRetentionContract.mjs';

const RETENTION_MAINTENANCE_SETTING =
  'classifarr.policy_native_intent_change_receipt_maintenance';
const RETENTION_MAINTENANCE_PERMIT = 'retention_cleanup';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || {} : {};
}

export async function tryLockPolicyNativeIntentChangeReceiptRetention(client, lockKey) {
  const result = await client.query(
    'SELECT pg_try_advisory_xact_lock($1) AS acquired',
    [lockKey],
  );
  return firstRow(result).acquired === true;
}

export async function loadPolicyNativeIntentChangeReceiptRetentionSummary({ client, cutoff }) {
  const result = await client.query(
    `SELECT
       COUNT(*)::integer AS total_receipt_count,
       COUNT(*) FILTER (
         WHERE created_at < $1::timestamptz
       )::integer AS expired_receipt_count
     FROM ${POLICY_NATIVE_INTENT_CHANGE_RECEIPT_TABLE}`,
    [cutoff],
  );
  const row = firstRow(result);
  return {
    totalReceiptCount: normalizeReceiptCount(row.total_receipt_count),
    expiredReceiptCount: normalizeReceiptCount(row.expired_receipt_count),
  };
}

export async function grantPolicyNativeIntentChangeReceiptRetentionPermit(client) {
  await client.query(
    `SELECT set_config('${RETENTION_MAINTENANCE_SETTING}', $1, true)`,
    [RETENTION_MAINTENANCE_PERMIT],
  );
}

export async function deleteExpiredPolicyNativeIntentChangeReceipts({ client, cutoff, limit }) {
  const result = await client.query(
    `WITH expired_receipts AS MATERIALIZED (
       SELECT id
       FROM ${POLICY_NATIVE_INTENT_CHANGE_RECEIPT_TABLE}
       WHERE created_at < $1::timestamptz
       ORDER BY created_at ASC, id ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     ),
     deleted_receipts AS (
       DELETE FROM ${POLICY_NATIVE_INTENT_CHANGE_RECEIPT_TABLE} AS receipt
       USING expired_receipts
       WHERE receipt.id = expired_receipts.id
       RETURNING 1
     )
     SELECT COUNT(*)::integer AS deleted_receipt_count
     FROM deleted_receipts`,
    [cutoff, limit],
  );
  return normalizeReceiptCount(firstRow(result).deleted_receipt_count);
}

export {
  RETENTION_MAINTENANCE_PERMIT,
  RETENTION_MAINTENANCE_SETTING,
};
