/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RETRY_CANDIDATE_SQL, RETRY_ITEM_ELIGIBILITY_SQL, retryCandidateParameters } from './enrichmentRetryCandidates.mjs';
import { RETRY_CREDENTIALS_BLOCKED_SQL } from './enrichmentRetryCredentialGate.mjs';

export const RETRY_READINESS_PAGE_SIZE = 50;

/** Limit before joins/guards; no whole-backlog count and no mutable queue stats. */
export async function readRetryReadinessPage(db, type) {
  if (!['web_search', 'tavily'].includes(type)) throw new TypeError('unsupported_readiness_type');
  const { rows } = await db.query(`WITH pending AS MATERIALIZED (
      SELECT * FROM enrichment_retry_queue WHERE status = 'pending' AND enrichment_type = $1
      ORDER BY priority,created_at,id LIMIT $5
    ) SELECT erq.id AS queue_id, msi.title, msi.year, msi.media_type, msi.tmdb_id, msi.imdb_id,
      (${RETRY_ITEM_ELIGIBILITY_SQL}) IS TRUE AS item_eligible,
      (${RETRY_CANDIDATE_SQL}) IS TRUE AS candidate,
      (${RETRY_CREDENTIALS_BLOCKED_SQL}) IS TRUE AS credentials_blocked,
      erq.next_attempt_at, cooldown.next_attempt_at AS cooldown_until,
      CASE WHEN erq.enrichment_type = 'tavily' AND erq.reason = $3
        AND date_trunc('month',COALESCE(erq.last_attempt_at,erq.created_at) AT TIME ZONE 'UTC')
          >= date_trunc('month',statement_timestamp() AT TIME ZONE 'UTC')
        THEN (date_trunc('month',statement_timestamp() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'
        ELSE NULL END AS monthly_due_at
    FROM pending erq LEFT JOIN media_server_items msi ON msi.id = erq.media_item_id
    LEFT JOIN enrichment_retry_cooldowns cooldown ON cooldown.dependency = 'web_search'
    ORDER BY erq.priority,erq.created_at,erq.id`,
  [...retryCandidateParameters(type), RETRY_READINESS_PAGE_SIZE + 1]);
  return { rows: rows.slice(0, RETRY_READINESS_PAGE_SIZE), hasMore: rows.length > RETRY_READINESS_PAGE_SIZE };
}
