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

async function lockPolicyForNativeIntentReversion(client, policyId) {
  const result = await client.query(
    `SELECT id, library_id
     FROM library_policies
     WHERE id = $1
     FOR UPDATE`,
    [policyId]
  );

  return firstRow(result);
}

async function lockRollbackSnapshotForNativeIntentReversion(client, { snapshotId, policyId }) {
  const result = await client.query(
    `SELECT
       id,
       intent_id,
       policy_id,
       snapshot_version,
       snapshot_payload,
       payload_redacted,
       restore_path,
       expires_at,
       created_at,
       restored_at
     FROM policy_intent_rollback_snapshots
     WHERE id = $1
       AND policy_id = $2
     FOR UPDATE`,
    [snapshotId, policyId]
  );

  return firstRow(result);
}

async function lockPolicyNativeIntentsForReversion(client, { policyId, libraryId }) {
  const result = await client.query(
    `SELECT
       id,
       policy_id,
       library_id,
       intent_version,
       active,
       replaced_by_intent_id
     FROM policy_intents
     WHERE policy_id = $1
       AND library_id = $2
     ORDER BY id
     FOR UPDATE`,
    [policyId, libraryId]
  );

  return Array.isArray(result?.rows) ? result.rows : [];
}

async function deactivateNativeIntentForReversion({
  client,
  intentId,
  policyId,
  libraryId,
  restoredAt,
}) {
  const result = await client.query(
    `UPDATE policy_intents
     SET active = FALSE,
         updated_at = $2
     WHERE id = $1
       AND policy_id = $3
       AND library_id = $4
       AND active = TRUE`,
    [intentId, restoredAt, policyId, libraryId]
  );

  return result?.rowCount === 1;
}

async function reactivatePreviousNativeIntentForReversion({
  client,
  intentId,
  replacementIntentId,
  policyId,
  libraryId,
  restoredAt,
}) {
  const result = await client.query(
    `UPDATE policy_intents
     SET active = TRUE,
         replaced_by_intent_id = NULL,
         updated_at = $2
     WHERE id = $1
       AND policy_id = $3
       AND library_id = $4
       AND active = FALSE
       AND replaced_by_intent_id = $5`,
    [intentId, restoredAt, policyId, libraryId, replacementIntentId]
  );

  return result?.rowCount === 1;
}

async function markRollbackSnapshotRestored({ client, snapshotId, policyId, restoredAt }) {
  const result = await client.query(
    `UPDATE policy_intent_rollback_snapshots
     SET restored_at = $3
     WHERE id = $1
       AND policy_id = $2
       AND restored_at IS NULL
     RETURNING id`,
    [snapshotId, policyId, restoredAt]
  );

  return firstRow(result)?.id ?? null;
}

async function insertNativeIntentReversionEvent({
  client,
  intentId,
  policyId,
  actorType,
  actorId,
  sourceVersion,
  targetVersion,
  reasonCode,
  summary,
  metadata,
}) {
  const result = await client.query(
    `INSERT INTO policy_intent_migration_events (
       intent_id,
       policy_id,
       event_type,
       actor_type,
       actor_id,
       source_version,
       target_version,
       reason_code,
       summary,
       metadata
     )
     VALUES ($1, $2, 'rollback_applied', $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id`,
    [
      intentId,
      policyId,
      actorType,
      actorId,
      sourceVersion,
      targetVersion,
      reasonCode,
      summary,
      JSON.stringify(metadata),
    ]
  );

  return firstRow(result)?.id ?? null;
}

export {
  deactivateNativeIntentForReversion,
  insertNativeIntentReversionEvent,
  lockPolicyForNativeIntentReversion,
  lockPolicyNativeIntentsForReversion,
  lockRollbackSnapshotForNativeIntentReversion,
  markRollbackSnapshotRestored,
  reactivatePreviousNativeIntentForReversion,
};
