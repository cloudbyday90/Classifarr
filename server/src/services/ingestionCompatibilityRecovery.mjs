/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { MEDIA_SYNC_OWNER_LOCK } from './mediaSyncLockKeys.mjs';
import { INGESTION_COMPATIBILITY_FENCE_SQL } from './ingestionCompatibilityFence.mjs';

/** Caller holds the library owner and transaction. No age-based or administrator attestation. */
export async function recoverCompatibleLegacyIngestion(db, libraryId, previous) {
  await db.query("SET LOCAL lock_timeout='500ms'");
  await db.query("SET LOCAL statement_timeout='5s'");
  // Keep trigger DDL excluded through the recovery commit, including partial batches.
  await db.query(`LOCK TABLE public.media_server_items,public.media_server_sync_status,
    public.media_source_capture_state,public.library_ingestion_state,
    public.media_source_observations,public.media_server_collections IN SHARE ROW EXCLUSIVE MODE`);
  const { rows: [fence] } = await db.query(`SELECT
    ${INGESTION_COMPATIBILITY_FENCE_SQL} AND
    EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=$1::oid AND objid=$2::oid
      AND objsubid=2 AND granted AND pid=pg_backend_pid()
      AND database=(SELECT oid FROM pg_database WHERE datname=current_database())) AS ready`,
  [MEDIA_SYNC_OWNER_LOCK, libraryId]);
  if (fence?.ready !== true) return null;
  const eligible = await db.query(`SELECT l.id FROM libraries l JOIN media_server ms ON ms.id=l.media_server_id
    WHERE l.id=$1 AND l.is_active AND l.archived_at IS NULL AND l.media_type IN ('movie','tv')
      AND ms.is_active AND ms.type IN ('plex','jellyfin','emby')
      AND NULLIF(btrim(ms.url),'') IS NOT NULL AND NULLIF(btrim(ms.api_key),'') IS NOT NULL FOR SHARE OF l,ms`, [libraryId]);
  if (eligible.rowCount !== 1) return null;
  const { rows: [current] } = await db.query(`SELECT
    EXISTS (SELECT 1 FROM media_server_sync_status WHERE library_id=$1 AND status IN ('pending','running')
      AND id IS DISTINCT FROM $2::integer AND ingestion_protocol<>0) OR
    EXISTS (SELECT 1 FROM media_source_capture_state WHERE library_id=$1 AND phase='collecting'
      AND (generation IS DISTINCT FROM $3::bigint OR source<>'media_sync') AND ingestion_protocol<>0) AS present`,
  [libraryId, previous?.sync_status_id ?? null, previous?.capture_generation ?? null]);
  if (current.present) return null; // A current external capture still needs explicit review.
  const { rows: markers } = await db.query(`SELECT id FROM media_server_sync_status
    WHERE library_id=$1 AND status IN ('pending','running') AND ingestion_protocol=0
      AND id IS DISTINCT FROM $2::integer ORDER BY id LIMIT 100 FOR UPDATE`, [libraryId, previous?.sync_status_id ?? null]);
  const { rows: captures } = await db.query(`SELECT generation,source FROM media_source_capture_state
    WHERE library_id=$1 AND phase='collecting' AND ingestion_protocol=0
      AND (generation IS DISTINCT FROM $2::bigint OR source<>'media_sync') FOR UPDATE`, [libraryId, previous?.capture_generation ?? null]);
  if (!markers.length && !captures.length) return null;
  const syncIds = markers.map(row => row.id);
  await db.query(`UPDATE media_server_sync_status SET status='failed',completed_at=clock_timestamp(),
    error_message='Pre-upgrade import fenced; automatic full replay required'
    WHERE library_id=$1 AND id=ANY($2::integer[])`, [libraryId, syncIds]);
  if (captures.length) await db.query(`UPDATE media_source_capture_state SET phase='failed',completed_at=clock_timestamp()
    WHERE library_id=$1 AND generation=$2`, [libraryId, captures[0].generation]);
  const { rows: [remaining] } = await db.query(`SELECT EXISTS(SELECT 1 FROM media_server_sync_status
    WHERE library_id=$1 AND status IN ('pending','running') AND id IS DISTINCT FROM $2::integer) AS present`,
  [libraryId, previous?.sync_status_id ?? null]);
  const requestId = randomUUID();
  const { rows: [audit] } = await db.query(`INSERT INTO audit_log(user_id,action,metadata)
    VALUES (NULL,'library_ingestion_compatibility_recovered',$1::jsonb) RETURNING id`, [JSON.stringify({
    version: 1, requestId, libraryId, syncIds, capture: captures[0] ?? null,
    verification: 'compatibility_protocol_1', moreBatches: remaining.present,
  })]);
  return { auditId: audit.id, requestId, moreBatches: remaining.present, markerCount: syncIds.length };
}
