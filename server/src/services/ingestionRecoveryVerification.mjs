/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { MEDIA_SYNC_OWNER_LOCK } from './mediaSyncLockKeys.mjs';
import { INGESTION_UNFINISHED_MARKERS_SQL } from './libraryIngestionPredicates.mjs';
import { readRecoveryMetadata } from './ingestionRecoveryMetadata.mjs';
import { RECOVERY_SOURCE_MATCH_SQL } from './ingestionRecoverySource.mjs';

// Configuration changes or a different scan cannot verify the old recovery.
const eligible = `r.stage='backfilling' AND s.phase='complete' AND s.run_id=r.run_id
  AND s.backfill_run_id=s.run_id AND s.backfill_completed_at IS NOT NULL
  AND l.is_active AND l.archived_at IS NULL AND ms.is_active
  AND NULLIF(btrim(ms.url),'') IS NOT NULL AND NULLIF(btrim(ms.api_key),'') IS NOT NULL
  AND ${RECOVERY_SOURCE_MATCH_SQL}`;
const source = `FROM ingestion_recovery_progress r JOIN library_ingestion_state s ON s.library_id=r.library_id
  JOIN libraries l ON l.id=r.library_id JOIN media_server ms ON ms.id=l.media_server_id`;
// Fixed SQL fragments only. Runtime identifiers remain positional parameters.
const dueRecoverySql = `SELECT r.audit_id,r.library_id,r.run_id ${source}
  WHERE ${eligible} AND r.next_check_at<=clock_timestamp()
  ORDER BY r.next_check_at,r.audit_id LIMIT 1 FOR UPDATE OF r SKIP LOCKED`;
const currentRecoverySql = `SELECT r.audit_id ${source}
  WHERE r.audit_id=$1 AND r.run_id=$2 AND ${eligible}
    AND NOT ${INGESTION_UNFINISHED_MARKERS_SQL}
    AND EXISTS (SELECT 1 FROM media_source_capture_state c WHERE c.library_id=l.id
      AND c.media_server_id=ms.id AND c.generation=s.capture_generation AND c.source='media_sync'
      AND c.mode='full' AND c.phase='complete' AND c.rejected_count=0 AND c.uncapturable_count=0 AND c.omitted_count=0)
    AND NOT EXISTS (SELECT 1 FROM media_source_observations o WHERE o.library_id=l.id)
  FOR UPDATE OF s,r FOR SHARE OF l,ms`;
async function bounds(db) {
  await db.query("SET LOCAL statement_timeout='3s'");
  await db.query("SET LOCAL lock_timeout='250ms'");
}

/** One due operation per existing refill call. A failed check keeps its durable cooldown. */
export async function verifyNextIngestionRecovery({ db, logger }) {
  try {
    const candidate = await db.withTransaction(async client => {
      await bounds(client);
      const { rows: [row] } = await client.query(dueRecoverySql);
      if (!row) return null;
      await client.query(`UPDATE ingestion_recovery_progress SET next_check_at=clock_timestamp()+interval '60 seconds'
        WHERE audit_id=$1`, [row.audit_id]);
      return row;
    });
    if (!candidate) return { status: 'idle' };
    return await db.withTransaction(async client => {
      await bounds(client);
      const { rows: [owner] } = await client.query('SELECT pg_try_advisory_xact_lock($1::integer,$2::integer) AS acquired',
        [MEDIA_SYNC_OWNER_LOCK, candidate.library_id]);
      if (!owner.acquired) return { status: 'deferred' };
      const { rows: [current] } = await client.query(currentRecoverySql, [candidate.audit_id, candidate.run_id]);
      if (!current) return { status: 'deferred' };
      const counts = await readRecoveryMetadata(client, candidate.library_id);
      const complete = counts.total === counts.ready && counts.pending === 0 && counts.blocked === 0;
      const result = await client.query(`UPDATE ingestion_recovery_progress SET metadata_total=$3,metadata_ready=$4,
        metadata_pending=$5,metadata_blocked=$6,checked_at=$7,
        stage=CASE WHEN $8 THEN 'completed' ELSE 'backfilling' END,
        verified_at=CASE WHEN $8 THEN $7::timestamptz ELSE NULL END
        WHERE audit_id=$1 AND run_id=$2 AND stage='backfilling'`,
      [candidate.audit_id, candidate.run_id, counts.total, counts.ready, counts.pending, counts.blocked, counts.checked_at, complete]);
      if (result.rowCount !== 1) throw new Error('ingestion_recovery_verification_changed');
      return { status: complete ? 'completed' : 'backfilling' };
    });
  } catch {
    logger?.warn?.('Recovery completion could not be verified; normal refill remains available',
      { reason: 'verification_unavailable' }, { dedupeKey: 'ingestion-recovery-verification', dedupeWindowMs: 3600000 });
    return { status: 'unavailable' };
  }
}
