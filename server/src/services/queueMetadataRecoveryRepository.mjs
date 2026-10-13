/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { REQUEST_IDENTITY_WHITESPACE_SQL as WHITESPACE } from './requestIdentitySqlWhitespace.mjs';
import { randomUUID } from 'node:crypto';

// Fixed SQL shared by enrollment, claim and completion; never supplied by callers.
const ELIGIBLE = `t.task_type='classification' AND t.status='failed'
  AND t.current_stage='metadata_fetch' AND t.error_message='task_metadata_not_found'
  AND t.claim_token IS NULL AND t.routing_classification_id IS NULL
  AND t.attempts >= 1 AND t.attempts < t.max_attempts AND t.max_attempts <= 5
  AND t.payload->>'media_type' IN ('movie','tv')
  AND NOT (t.payload ?| ARRAY['media','extra','tmdbId','mediaType'])
  AND CASE WHEN t.payload->>'tmdb_id' ~ '^[1-9][0-9]{0,9}$'
    THEN (t.payload->>'tmdb_id')::bigint <= 2147483647 ELSE false END
  AND NOT (t.payload ? 'result')
  AND NOT EXISTS (SELECT 1 FROM queue_identity_repair_receipts repair WHERE repair.task_id=t.id)
  AND NOT EXISTS (SELECT 1 FROM classification_intake_receipts r
    WHERE r.queue_task_id=t.id AND r.classification_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM task_queue newer
    WHERE newer.task_type='classification' AND newer.id>t.id
      AND t.payload->>'media_type' IN (lower(btrim(newer.payload->>'media_type',${WHITESPACE}) COLLATE "C"),
        lower(btrim(newer.payload->>'mediaType',${WHITESPACE}) COLLATE "C"), lower(btrim(newer.payload#>>'{media,media_type}',${WHITESPACE}) COLLATE "C"),
        lower(btrim(newer.payload#>>'{media,mediaType}',${WHITESPACE}) COLLATE "C"))
      AND EXISTS (SELECT 1 FROM (
        SELECT value FROM (VALUES (newer.payload->>'tmdb_id'),(newer.payload->>'tmdbId'),
          (newer.payload#>>'{media,tmdbId}'),(newer.payload#>>'{media,tmdb_id}')) AS declared(value)
        UNION ALL SELECT entry->>'value' FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(newer.payload->'extra')='array' THEN newer.payload->'extra' ELSE '[]'::jsonb END) entry
          WHERE lower(entry->>'name') LIKE '%tmdb%'
      ) AS ids WHERE regexp_replace(btrim(value,${WHITESPACE}),'^0+','')=t.payload->>'tmdb_id'))
  AND NOT EXISTS (SELECT 1 FROM classification_history h
    WHERE h.tmdb_id::text=t.payload->>'tmdb_id' AND h.media_type=t.payload->>'media_type'
      AND h.created_at >= t.created_at)`;

export function createQueueMetadataRecoveryRepository(db) {
  return {
    async claim() {
      // Commit FK enrollment before taking task update locks in the claim transaction.
      // sql-interpolation: ELIGIBLE is fixed module-owned SQL; all values are bound.
      await db.query(`INSERT INTO queue_metadata_recovery(task_id)
          SELECT t.id FROM task_queue t WHERE ${ELIGIBLE}
            AND NOT EXISTS (SELECT 1 FROM queue_metadata_recovery r WHERE r.task_id=t.id)
          ORDER BY t.id LIMIT 100 ON CONFLICT DO NOTHING`);
      return db.withTransaction(async tx => {
        // Task lock is always acquired before its recovery row, matching FK deletion order.
        // sql-interpolation: ELIGIBLE is fixed module-owned SQL.
        const { rows } = await tx.query(`SELECT t.id, t.xmin::text AS revision,
          t.payload->>'tmdb_id' AS tmdb_id, t.payload->>'media_type' AS media_type
          FROM task_queue t JOIN queue_metadata_recovery r ON r.task_id=t.id
          WHERE ${ELIGIBLE} AND r.recovered_at IS NULL AND r.probe_count<6
            AND r.next_probe_at<=clock_timestamp()
          ORDER BY r.next_probe_at,t.id LIMIT 1 FOR UPDATE OF t SKIP LOCKED`);
        const task = rows[0];
        if (!task) return null;
        const token = randomUUID();
        const result = await tx.query(`UPDATE queue_metadata_recovery
          SET probe_count=probe_count+1, lease_token=$2, last_outcome='checking',
            next_probe_at=clock_timestamp() +
              (ARRAY[6,24,72,168,336,336])[probe_count+1] * interval '1 hour'
          WHERE task_id=$1 AND recovered_at IS NULL AND probe_count<6
            AND next_probe_at<=clock_timestamp() RETURNING task_id`, [task.id, token]);
        return result.rowCount === 1 ? { ...task, token } : null;
      });
    },
    async finish(claim, outcome, validateConfiguration, { signal = null, retryAfterMs = 0 } = {}) {
      return db.withTransaction(async tx => {
        const { rows } = await tx.query('SELECT id,xmin::text AS revision FROM task_queue WHERE id=$1 FOR UPDATE', [claim.id]);
        if (!rows[0] || rows[0].revision !== claim.revision) return false;
        const lease = await tx.query(`SELECT task_id FROM queue_metadata_recovery
          WHERE task_id=$1 AND lease_token=$2 AND recovered_at IS NULL
            AND last_outcome='checking' FOR UPDATE`, [claim.id, claim.token]);
        if (lease.rowCount !== 1) return false;
        let recovered = false;
        if (outcome === 'available') {
          signal?.throwIfAborted();
          // Serialize current settings only during admission, never during provider I/O.
          await tx.query('LOCK TABLE tmdb_config IN SHARE MODE');
          if (!await validateConfiguration(tx)) outcome = 'configuration_changed';
          else {
            // sql-interpolation: ELIGIBLE is fixed module-owned SQL; task ID is bound.
            const update = await tx.query(`UPDATE task_queue t SET status='pending',
              error_message=NULL, next_retry_at=clock_timestamp(), completed_at=NULL, started_at=NULL
              WHERE t.id=$1 AND ${ELIGIBLE} RETURNING t.id`, [claim.id]);
            recovered = update.rowCount === 1;
            if (recovered) await tx.query(`UPDATE classification_intake_receipts
              SET status_id='retry_scheduled', finished_at=NULL, updated_at=clock_timestamp()
              WHERE queue_task_id=$1 AND classification_id IS NULL AND status_id='failed'`, [claim.id]);
            else outcome = 'source_changed';
          }
        }
        const retryDelay = Number.isFinite(retryAfterMs) ? Math.min(30 * 86400000, Math.max(0, retryAfterMs)) : 0;
        await tx.query(`UPDATE queue_metadata_recovery SET last_outcome=$3,
          checked_at=clock_timestamp(), recovered_at=CASE WHEN $4 THEN clock_timestamp() ELSE recovered_at END,
          next_probe_at=GREATEST(next_probe_at, clock_timestamp()+$5 * interval '1 millisecond')
          WHERE task_id=$1 AND lease_token=$2`, [claim.id, claim.token, recovered ? 'requeued' : outcome, recovered, retryDelay]);
        if (recovered) signal?.throwIfAborted();
        return recovered;
      });
    },
  };
}
