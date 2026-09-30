/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceConflictAuthorityExclusionForMediaServerItem, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';
import { RETRY_CREDENTIALS_BLOCKED_SQL } from './enrichmentRetryCredentialGate.mjs';
import { TAVILY_MONTHLY_DEFERRED_REASON } from '../utils/enrichmentState.mjs';
import { RETRY_EFFECTIVE_DUE_SQL } from './enrichmentRetryDuePolicy.mjs';

// Fixed SQL shared by read-only preview/planning and the authoritative claim.
export const RETRY_ITEM_BASE_ELIGIBILITY_SQL = `erq.attempts < erq.max_attempts AND NOT (erq.id = ANY($2::integer[]))
  AND msi.media_type IN ('movie', 'tv')
  AND EXISTS (SELECT 1 FROM libraries l WHERE l.id = msi.library_id AND l.is_active = true AND l.media_type IN ('movie', 'tv'))
  AND (erq.enrichment_type <> 'omdb' OR msi.metadata->'omdb' IS NULL)
  AND (erq.enrichment_type NOT IN ('tavily', 'web_search') OR (
    msi.metadata->'tavily_imdb' IS NULL AND msi.metadata->'tavily_advisory' IS NULL
    AND msi.metadata->'web_search_imdb' IS NULL AND msi.metadata->'web_search_advisory' IS NULL
    AND msi.metadata->'omdb' IS NULL))`;

export const RETRY_ITEM_ELIGIBILITY_SQL = `${RETRY_ITEM_BASE_ELIGIBILITY_SQL}
  AND ${sourceConflictAuthorityExclusionForMediaServerItem('$4')}`;

export const RETRY_QUEUE_GATES_SQL = `erq.status = 'pending' AND erq.enrichment_type = $1
  AND NOT EXISTS (SELECT 1 FROM enrichment_retry_cooldowns cooldown
    WHERE cooldown.dependency = CASE WHEN $1 = 'omdb' THEN 'omdb' ELSE 'web_search' END
      AND cooldown.next_attempt_at > statement_timestamp())
  AND (erq.enrichment_type <> 'tavily' OR erq.reason IS DISTINCT FROM $3
    OR date_trunc('month', COALESCE(erq.last_attempt_at, erq.created_at) AT TIME ZONE 'UTC')
      < date_trunc('month', statement_timestamp() AT TIME ZONE 'UTC'))`;

export const RETRY_CANDIDATE_SQL = `${RETRY_QUEUE_GATES_SQL}
  AND (${RETRY_EFFECTIVE_DUE_SQL}) <= statement_timestamp()
  AND NOT ${RETRY_CREDENTIALS_BLOCKED_SQL}
  AND ${RETRY_ITEM_ELIGIBILITY_SQL}`;

export function retryCandidateParameters(type, visited = []) {
  if (!['omdb', 'web_search', 'tavily'].includes(type)) throw new TypeError('unsupported_retry_type');
  return [type, visited, TAVILY_MONTHLY_DEFERRED_REASON, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS];
}
