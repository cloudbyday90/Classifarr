/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { normalizeDatabaseBigintId } from './databaseIntegerValues.mjs';

/** A legacy large foreign key can be exact as stored but differ from the run capture selected. */
export async function hasPolicyLibraryRebuildCaptureRunProof({ client, execution }) {
  const verificationRunId = normalizeDatabaseBigintId(execution.verification_run_id);
  if (verificationRunId === null) return false;
  if (typeof verificationRunId === 'number') return true;

  const migrationEventId = normalizeDatabaseBigintId(execution.migration_event_id);
  const snapshotId = normalizeDatabaseBigintId(execution.rollback_snapshot_id);
  if (migrationEventId === null || snapshotId === null) return false;

  const result = await client.query(
    `SELECT id
     FROM policy_intent_migration_events
     WHERE id = $1
       AND policy_id = $2
       AND intent_id = $3
       AND event_type = 'rollback_snapshot_created'
       AND reason_code = 'library_rebuild_snapshot_persisted'
       AND metadata -> 'snapshotId' = $4::jsonb
       AND metadata ->> 'transitionFingerprint' = $5
       AND metadata -> 'verificationRunId' = to_jsonb($6::text)
       AND metadata ->> 'verificationRunFingerprint' = $7
     FOR SHARE`,
    [
      migrationEventId,
      execution.policy_id,
      execution.intent_id,
      JSON.stringify(snapshotId),
      execution.transition_fingerprint,
      verificationRunId,
      execution.verification_run_fingerprint,
    ],
  );
  return normalizeDatabaseBigintId(result.rows[0]?.id) === migrationEventId;
}
