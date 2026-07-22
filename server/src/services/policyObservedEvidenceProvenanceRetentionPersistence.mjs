/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

async function tryLockObservedEvidenceProvenanceRetention(client, lockKey) {
  const result = await client.query(
    'SELECT pg_try_advisory_xact_lock($1) AS acquired',
    [lockKey]
  );

  return firstRow(result)?.acquired === true;
}

async function lockExpiredObservedEvidenceProvenanceSnapshots({ client, now, limit }) {
  const result = await client.query(
    `SELECT
       id,
       establishment_id,
       policy_id,
       library_id,
       intent_id,
       snapshot_version,
       source_id,
       capture_state,
       capture_reason_id,
       profile_freshness_state,
       source_profile_generated_at,
       source_profile_updated_at,
       evidence_fingerprint,
       snapshot_payload,
       expires_at,
       created_at
     FROM policy_observed_evidence_provenance_snapshots
     WHERE payload_redacted = FALSE
       AND expires_at <= $1::timestamptz
     ORDER BY expires_at ASC, id ASC
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    [now, limit]
  );

  return Array.isArray(result?.rows) ? result.rows : [];
}

async function redactObservedEvidenceProvenanceSnapshot({ client, snapshotId, now, marker }) {
  const result = await client.query(
    `UPDATE policy_observed_evidence_provenance_snapshots
     SET snapshot_payload = $2::jsonb,
         payload_redacted = TRUE,
         redacted_at = $3::timestamptz
     WHERE id = $1
       AND payload_redacted = FALSE
       AND expires_at <= $3::timestamptz
     RETURNING id`,
    [snapshotId, JSON.stringify(marker), now]
  );

  return firstRow(result)?.id ?? null;
}

export {
  lockExpiredObservedEvidenceProvenanceSnapshots,
  redactObservedEvidenceProvenanceSnapshot,
  tryLockObservedEvidenceProvenanceRetention,
};
