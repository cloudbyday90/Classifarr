/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { normalizeDatabaseBigintId } from './databaseIntegerValues.mjs';

/** A legacy large foreign key can differ from the identity selected at capture. */
export async function hasPolicyLibraryRebuildCaptureProof({ client, execution }) {
  const intentId = normalizeDatabaseBigintId(execution.intent_id);
  const verificationRunId = normalizeDatabaseBigintId(execution.verification_run_id);
  if (intentId === null || verificationRunId === null) return false;
  if (typeof intentId === 'number' && typeof verificationRunId === 'number') return true;

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
       AND metadata -> 'verificationRunId' = $6::jsonb
       AND metadata ->> 'verificationRunFingerprint' = $7
       AND ($8::boolean OR metadata -> 'originalIntentId' = to_jsonb($3::bigint::text))
     FOR SHARE`,
    [
      migrationEventId,
      execution.policy_id,
      intentId,
      JSON.stringify(snapshotId),
      execution.transition_fingerprint,
      JSON.stringify(verificationRunId),
      execution.verification_run_fingerprint,
      typeof intentId === 'number',
    ],
  );
  return normalizeDatabaseBigintId(result.rows[0]?.id) === migrationEventId;
}
