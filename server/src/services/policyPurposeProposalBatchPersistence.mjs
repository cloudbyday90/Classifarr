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

function asArray(value) {
  return Array.isArray(value?.rows) ? value.rows : [];
}

/**
 * Reads only the receipt identity needed to distinguish a completed batch
 * retry from an impossible partial batch. It intentionally returns no change
 * payload, policy terms, or receipt metadata.
 */
export async function loadPolicyPurposeProposalBatchReplayReceipts({
  client,
  actorId,
  idempotencyKeys,
} = {}) {
  if (!Array.isArray(idempotencyKeys) || idempotencyKeys.length === 0) return [];

  const result = await client.query(
    `SELECT policy_id, idempotency_key
       FROM ${POLICY_NATIVE_INTENT_CHANGE_RECEIPT_TABLE}
      WHERE actor_id = $1
        AND idempotency_key = ANY($2::text[])`,
    [actorId, idempotencyKeys],
  );

  return asArray(result)
    .map(row => ({
      policyId: Number(row.policy_id),
      idempotencyKey: typeof row.idempotency_key === 'string' ? row.idempotency_key : null,
    }))
    .filter(row => Number.isInteger(row.policyId) && row.policyId > 0 && row.idempotencyKey);
}
