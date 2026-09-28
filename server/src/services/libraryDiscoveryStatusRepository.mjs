/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { CATALOG_CONTRACTS, libraryDiscoveryFailure } from './libraryDiscoveryFailure.mjs';
import { CATALOG_REFRESH_MS, catalogRecoveryPlan } from './libraryCatalogRecoveryPolicy.mjs';
import { catalogRetryAfter } from './libraryCatalogRetryAfter.mjs';

export function createLibraryDiscoveryStatusRepository(db) {
  return {
    async begin(source, { automatic = false } = {}) {
      const attemptId = randomUUID();
      const { rows } = await db.query(`INSERT INTO media_server_catalog_status AS previous
        (media_server_id,source_revision,attempt_id,started_at,reason,contract,automatic_attempts,recovery_state,next_attempt_at)
        SELECT id,catalog_revision,$3,clock_timestamp(),'checking','unknown',1,'scheduled',
          clock_timestamp()+$5*INTERVAL '1 millisecond' FROM media_server
        WHERE id=$1 AND catalog_revision=$2 AND is_active=true
        ON CONFLICT(media_server_id) DO UPDATE SET source_revision=EXCLUDED.source_revision,
          attempt_id=EXCLUDED.attempt_id,started_at=EXCLUDED.started_at,finished_at=NULL,
          reason='checking',contract='unknown',http_status=NULL,
          automatic_attempts=CASE WHEN $4 AND previous.source_revision=EXCLUDED.source_revision
            THEN LEAST(previous.automatic_attempts+1,5) ELSE 1 END,
          recovery_state=CASE WHEN $4 AND previous.source_revision=EXCLUDED.source_revision AND previous.automatic_attempts>=4
            THEN 'cooldown' ELSE 'scheduled' END,next_attempt_at=EXCLUDED.next_attempt_at,
          last_success_at=CASE WHEN previous.source_revision=EXCLUDED.source_revision THEN previous.last_success_at END,
          last_success_count=CASE WHEN previous.source_revision=EXCLUDED.source_revision THEN previous.last_success_count END
        WHERE previous.source_revision<=EXCLUDED.source_revision RETURNING attempt_id,automatic_attempts`,
      [source.id, source.catalog_revision, attemptId, automatic, CATALOG_REFRESH_MS]);
      return rows.length ? { sourceId: source.id, attemptId, attempts: rows[0].automatic_attempts ?? 1 } : null;
    },
    async finish(attempt, { error = null, contract = 'unknown', count = null } = {}) {
      if (!attempt) return;
      const { reason, httpStatus } = error ? libraryDiscoveryFailure(error) : { reason: 'complete', httpStatus: null };
      if (!error && (!Number.isSafeInteger(count) || count < 0 || count > 1000)) throw new Error('library_discovery_count_invalid');
      const recovery = catalogRecoveryPlan({ reason, httpStatus, attempts: attempt.attempts, retryAfter: catalogRetryAfter(error) });
      await db.query(`UPDATE media_server_catalog_status AS status SET finished_at=clock_timestamp(),
        reason=$3,contract=$4,http_status=$5,
        recovery_state=$7,next_attempt_at=clock_timestamp()+$8*INTERVAL '1 millisecond',
        automatic_attempts=CASE WHEN $3='complete' THEN 0 ELSE status.automatic_attempts END,
        last_success_at=CASE WHEN $3='complete' THEN clock_timestamp() ELSE status.last_success_at END,
        last_success_count=CASE WHEN $3='complete' THEN $6 ELSE status.last_success_count END
        FROM media_server AS source WHERE status.media_server_id=$1 AND status.attempt_id=$2
          AND status.finished_at IS NULL AND source.id=status.media_server_id AND source.is_active=true
          AND source.catalog_revision=status.source_revision`,
      [attempt.sourceId, attempt.attemptId, reason, CATALOG_CONTRACTS.includes(contract) ? contract : 'unknown', httpStatus, error ? null : count, recovery.state, recovery.delayMs]);
    },
    async read() {
      const { rows } = await db.query(`SELECT source.type AS provider,source.catalog_revision AS current_revision,
        status.source_revision,status.started_at,status.finished_at,status.reason,status.contract,status.http_status,
        status.last_success_at,status.last_success_count,
        status.automatic_attempts,status.recovery_state,status.next_attempt_at,clock_timestamp() AS observed_at,
        (length(btrim(source.url))>0 AND length(btrim(source.api_key))>0) AS configured,
        (status.finished_at IS NULL AND status.started_at < clock_timestamp()-INTERVAL '2 minutes') AS outcome_unrecorded
        FROM media_server AS source LEFT JOIN media_server_catalog_status AS status ON status.media_server_id=source.id
        WHERE source.is_active=true ORDER BY source.id LIMIT 1`);
      return rows[0] ?? null;
    },
  };
}
