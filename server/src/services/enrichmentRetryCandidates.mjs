/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceConflictAuthorityExclusionForMediaServerItem, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';
import { RETRY_CREDENTIALS_BLOCKED_SQL } from './enrichmentRetryCredentialGate.mjs';
import { TAVILY_MONTHLY_DEFERRED_REASON } from '../utils/enrichmentState.mjs';

// Fixed SQL shared by read-only planning and the authoritative atomic claim.
export const RETRY_CANDIDATE_SQL = `erq.status = 'pending' AND erq.enrichment_type = $1
  AND erq.next_attempt_at <= statement_timestamp()
  AND NOT ${RETRY_CREDENTIALS_BLOCKED_SQL}
  AND NOT EXISTS (SELECT 1 FROM enrichment_retry_cooldowns cooldown
    WHERE cooldown.dependency = CASE WHEN $1 = 'omdb' THEN 'omdb' ELSE 'web_search' END
      AND cooldown.next_attempt_at > statement_timestamp())
  AND erq.attempts < erq.max_attempts AND NOT (erq.id = ANY($2::integer[]))
  AND msi.media_type IN ('movie', 'tv')
  AND EXISTS (SELECT 1 FROM libraries l WHERE l.id = msi.library_id AND l.is_active = true AND l.media_type IN ('movie', 'tv'))
  AND ${sourceConflictAuthorityExclusionForMediaServerItem('$4')}
  AND (erq.enrichment_type <> 'omdb' OR msi.metadata->'omdb' IS NULL)
  AND (erq.enrichment_type NOT IN ('tavily', 'web_search') OR (
    msi.metadata->'tavily_imdb' IS NULL AND msi.metadata->'tavily_advisory' IS NULL
    AND msi.metadata->'web_search_imdb' IS NULL AND msi.metadata->'web_search_advisory' IS NULL
    AND msi.metadata->'omdb' IS NULL))
  AND (erq.enrichment_type <> 'tavily' OR erq.reason IS DISTINCT FROM $3
    OR date_trunc('month', COALESCE(erq.last_attempt_at, erq.created_at) AT TIME ZONE 'UTC')
      < date_trunc('month', statement_timestamp() AT TIME ZONE 'UTC'))`;

export function retryCandidateParameters(type, visited = []) {
  if (!['omdb', 'web_search', 'tavily'].includes(type)) throw new TypeError('unsupported_retry_type');
  return [type, visited, TAVILY_MONTHLY_DEFERRED_REASON, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS];
}

export async function readEnrichmentRetryPage(db, type, cursor, limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new TypeError('invalid_retry_page');
  const { rows } = await db.query(`SELECT erq.id AS queue_id, erq.priority,
    COALESCE(erq.created_at,'infinity'::timestamptz)::text AS retry_created_at,
    msi.title, msi.year, msi.media_type, msi.tmdb_id, msi.imdb_id
    FROM enrichment_retry_queue erq JOIN media_server_items msi ON msi.id = erq.media_item_id
    WHERE ${RETRY_CANDIDATE_SQL}
      AND ($5::integer IS NULL OR (erq.priority,COALESCE(erq.created_at,'infinity'::timestamptz),erq.id)>($5,$6::timestamptz,$7::integer))
    ORDER BY erq.priority,erq.created_at,erq.id LIMIT $8`,
  [...retryCandidateParameters(type), cursor?.priority ?? null, cursor?.retry_created_at ?? null, cursor?.queue_id ?? null, limit]);
  return rows;
}
