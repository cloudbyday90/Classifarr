/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

/**
 * Reads at most one recent applied receipt for the authenticated actor and
 * policy. Keep this projection separate from the write-replay reader: keys,
 * fingerprints, command values, receipt IDs, event IDs, and timestamps are
 * intentionally unavailable to this query and its callers.
 */
export async function loadPolicyNativeIntentChangeRecentReceiptDiscoveryContext({
  client,
  actorId,
  policyId,
  maxAgeSeconds,
}) {
  const result = await client.query(
    `SELECT
       result_status_id,
       source_intent_version,
       target_intent_version
     FROM policy_native_intent_change_receipts
     WHERE actor_id = $1
       AND policy_id = $2
       AND result_status_id = 'applied'
       AND created_at >= NOW() - ($3::integer * INTERVAL '1 second')
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [actorId, policyId, maxAgeSeconds],
  );

  return firstRow(result);
}
