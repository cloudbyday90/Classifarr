/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { isQueueClaimToken } from './queueTaskAcknowledgementService.mjs';
import { QueueClaimWriteError, claimNotOwned } from './queueClaimWriteGuard.mjs';
import { ENRICHMENT_SOURCE_SQL, encodeEnrichmentSource } from './queueEnrichmentSourceGuard.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';
import { TAVILY_MONTHLY_DEFERRED_REASON } from '../utils/enrichmentState.mjs';

const configuredLease = Number(process.env.ENRICHMENT_RETRY_STALE_MS);
export const ENRICHMENT_RETRY_STALE_MS = Number.isSafeInteger(configuredLease) && configuredLease > 0
  ? Math.min(configuredLease, 60 * 60 * 1000) : 20 * 60 * 1000;

export async function claimEnrichmentRetry(db, enrichmentType, visited = []) {
  if (typeof db?.withTransaction !== 'function') throw new QueueClaimWriteError();
  if (!['omdb', 'web_search', 'tavily'].includes(enrichmentType)) throw new TypeError('unsupported_retry_type');
  const { rows: [item] } = await db.query(`WITH candidate AS (
    SELECT erq.id FROM enrichment_retry_queue erq
    JOIN media_server_items msi ON msi.id = erq.media_item_id
    WHERE erq.status = 'pending' AND erq.enrichment_type = $1
      AND erq.attempts < erq.max_attempts AND NOT (erq.id = ANY($2::integer[]))
      AND msi.media_type IN ('movie', 'tv')
      AND EXISTS (SELECT 1 FROM libraries l WHERE l.id = msi.library_id AND l.is_active = true AND l.media_type IN ('movie', 'tv'))
      AND ${sourceConflictAuthorityExclusionForMediaServerItem('$6')}
      AND (erq.enrichment_type <> 'omdb' OR msi.metadata->'omdb' IS NULL)
      AND (erq.enrichment_type NOT IN ('tavily', 'web_search') OR (
        msi.metadata->'tavily_imdb' IS NULL AND msi.metadata->'tavily_advisory' IS NULL
        AND msi.metadata->'web_search_imdb' IS NULL AND msi.metadata->'web_search_advisory' IS NULL
        AND msi.metadata->'omdb' IS NULL))
      AND (erq.enrichment_type <> 'tavily' OR erq.reason IS DISTINCT FROM $5
        OR date_trunc('month', COALESCE(erq.last_attempt_at, erq.created_at)) < date_trunc('month', NOW()))
    ORDER BY erq.priority, erq.created_at, erq.id LIMIT 1 FOR UPDATE OF erq SKIP LOCKED
  ), claimed AS (
    UPDATE enrichment_retry_queue erq SET status = 'processing', last_attempt_at = clock_timestamp(),
      claim_token = $3::uuid, claim_until = clock_timestamp() + ($4 * interval '1 millisecond')
    FROM candidate WHERE erq.id = candidate.id
    RETURNING erq.id AS queue_id, erq.media_item_id, erq.attempts, erq.max_attempts, erq.claim_token
  ) SELECT claimed.*, msi.media_server_id, msi.external_id, msi.library_id, msi.media_type,
      msi.title, msi.year, msi.imdb_id, msi.tvdb_id, msi.tmdb_id
    FROM claimed JOIN media_server_items msi ON msi.id = claimed.media_item_id`,
  [enrichmentType, visited, randomUUID(), ENRICHMENT_RETRY_STALE_MS,
    TAVILY_MONTHLY_DEFERRED_REASON, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
  return item ?? null;
}

/** Capture authority before provider calls; callbacks must be database-only. */
export function createEnrichmentRetryWriteGuard(db, item, enrichmentType) {
  const id = item?.queue_id, token = item?.claim_token, itemId = item?.media_item_id;
  const source = encodeEnrichmentSource(item, item?.media_type), tmdbId = item?.tmdb_id;
  return async work => {
    if (!isQueueClaimToken(token)) throw claimNotOwned();
    if (!source || tmdbId === undefined || typeof db?.withTransaction !== 'function') throw new QueueClaimWriteError();
    try {
      return await db.withTransaction(async client => {
        await client.query("SET LOCAL lock_timeout = '2s'");
        await client.query("SET LOCAL statement_timeout = '10s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
        await client.query("SET LOCAL transaction_timeout = '15s'");
        const { rows: [claim] } = await client.query(`SELECT claim_until::text AS deadline, attempts, max_attempts
          FROM enrichment_retry_queue WHERE id = $1 AND claim_token = $2::uuid
            AND status = 'processing' AND enrichment_type = $3 AND media_item_id = $4 FOR UPDATE`,
        [id, token, enrichmentType, itemId]);
        if (!claim?.deadline) throw claimNotOwned();
        const check = async () => {
          const { rows: [clock] } = await client.query('SELECT clock_timestamp() < $1::timestamptz AS live', [claim.deadline]);
          if (clock?.live !== true) throw claimNotOwned();
        };
        await check();
        const { rowCount } = await client.query(`SELECT msi.id FROM media_server_items msi
          WHERE msi.id = $1 AND ${ENRICHMENT_SOURCE_SQL} = $2::jsonb
            AND msi.tmdb_id IS NOT DISTINCT FROM $3::integer AND msi.media_type IN ('movie', 'tv')
            AND EXISTS (SELECT 1 FROM libraries l WHERE l.id = msi.library_id AND l.is_active = true
              AND l.media_type IN ('movie', 'tv') FOR SHARE)
            AND ${sourceConflictAuthorityExclusionForMediaServerItem('$4')}
          FOR UPDATE OF msi`, [itemId, source, tmdbId, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
        let active = true;
        const scoped = Object.freeze({ query: (...args) => active ? client.query(...args) : Promise.reject(claimNotOwned()) });
        try {
          const result = await work(scoped, claim, rowCount === 1);
          await check();
          return result;
        } finally { active = false; }
      });
    } catch (error) {
      if (error instanceof QueueClaimWriteError) throw error;
      throw new QueueClaimWriteError('queue_claim_write_failed', error);
    }
  };
}
