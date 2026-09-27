/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';

export function createMediaSyncOwnershipRepository(db, libraryId) {
  let runId;
  const updateOwned = async (sql, values) => {
    const result = await db.query(sql, [libraryId, runId, ...values]);
    if (result.rowCount !== 1) throw new Error('ingestion_ownership_changed');
  };
  return {
    async assertSource(source) {
      // Inside finalization this locks configuration until the pruning commit.
      // Between pages it is a short, read-only revalidation, not a network-spanning transaction.
      const result = await db.query(`SELECT l.id FROM libraries l JOIN media_server ms ON ms.id=l.media_server_id
        WHERE l.id=$1 AND l.is_active AND ms.is_active AND l.media_server_id=$2
          AND l.external_id=$3 AND l.media_type=$4 AND ms.type=$5 AND ms.url=$6 AND ms.api_key=$7
        FOR SHARE OF l,ms`,
      [libraryId, source.media_server_id, source.external_id, source.media_type, source.type, source.url, source.api_key]);
      if (result.rows.length !== 1) throw new Error('ingestion_source_changed');
    },
    async claim() {
      return db.withTransaction(async client => {
        const { rows: [previous] } = await client.query('SELECT * FROM library_ingestion_state WHERE library_id=$1 FOR UPDATE', [libraryId]);
        const { rows: [foreign] } = await client.query(`SELECT
          EXISTS (SELECT 1 FROM media_server_sync_status WHERE library_id=$1 AND status IN ('pending','running')
            AND id IS DISTINCT FROM $2::integer) OR
          EXISTS (SELECT 1 FROM media_source_capture_state WHERE library_id=$1 AND phase='collecting'
            AND (generation IS DISTINCT FROM $3::bigint OR source<>'media_sync')) AS present`,
        [libraryId, previous?.sync_status_id ?? null, previous?.capture_generation ?? null]);
        if (foreign.present) return { reason: 'legacy_owner_unknown' };
        if (previous && previous.phase !== 'complete') {
          const { rows: [clock] } = await client.query('SELECT $1::timestamptz>clock_timestamp() AS cooling', [previous.retry_after]);
          if (clock.cooling) return { reason: 'retry_wait' };
          await client.query(`UPDATE media_server_sync_status SET status='failed',completed_at=clock_timestamp(),
            error_message='Interrupted ingestion; automatic full replay scheduled' WHERE id=$1 AND status IN ('pending','running')`, [previous.sync_status_id]);
          await client.query(`UPDATE media_source_capture_state SET phase='failed',completed_at=clock_timestamp()
            WHERE library_id=$1 AND generation=$2 AND source='media_sync' AND phase='collecting'`, [libraryId, previous.capture_generation]);
        }
        runId = randomUUID();
        const replay = Boolean(previous && previous.phase !== 'complete');
        await client.query(`INSERT INTO library_ingestion_state(library_id,run_id,phase,retry_after)
          VALUES ($1,$2,'running',clock_timestamp()+interval '1 minute')
          ON CONFLICT(library_id) DO UPDATE SET run_id=EXCLUDED.run_id,phase='running',sync_status_id=NULL,capture_generation=NULL,
            attempt_count=CASE WHEN $3 THEN LEAST(library_ingestion_state.attempt_count+1,1000000) ELSE 1 END,
            restart_count=library_ingestion_state.restart_count+CASE WHEN $3 THEN 1 ELSE 0 END,
            pages_processed=0,items_processed=0,items_total=NULL,updated_at=clock_timestamp(),
            retry_after=clock_timestamp()+make_interval(secs=>CASE WHEN $3
              THEN LEAST(3600,30*power(2,LEAST(library_ingestion_state.attempt_count,7))) ELSE 60 END+random()*30)`,
        [libraryId, runId, replay]);
        return { replay };
      });
    },
    async attach(syncId, capture = null) {
      await updateOwned(`UPDATE library_ingestion_state SET sync_status_id=$3,capture_generation=$4,updated_at=clock_timestamp()
        WHERE library_id=$1 AND run_id=$2`, [syncId, capture?.generation ?? null]);
    },
    async checkpoint(items, total = null) {
      await updateOwned(`UPDATE library_ingestion_state SET pages_processed=pages_processed+1,items_processed=$3,items_total=$4,updated_at=clock_timestamp()
        WHERE library_id=$1 AND run_id=$2`, [items, total]);
    },
    async finish(success, items = null) {
      await updateOwned(`UPDATE library_ingestion_state SET phase=$3,items_processed=COALESCE($4::integer,items_processed),updated_at=clock_timestamp(),
        retry_after=CASE WHEN $3='complete' THEN NULL ELSE GREATEST(retry_after,clock_timestamp()+interval '1 minute') END
        WHERE library_id=$1 AND run_id=$2`, [success ? 'complete' : 'retry_wait', items]);
    },
  };
}
