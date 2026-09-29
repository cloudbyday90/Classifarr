/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const RETRY_MAINTENANCE_BATCH_SIZE = 50;

const policy = `WITH policy AS (SELECT $1::text AS type, $2::text AS monthly_reason, $3::text AS monthly_message)`;
const scope = `(p.type IS NULL OR erq.enrichment_type = p.type)
  AND erq.claim_token IS NULL AND erq.claim_until IS NULL`;
const monthlyDate = `(date_trunc('month', COALESCE(erq.last_attempt_at, erq.created_at)
  AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'`;
const monthlyReason = `(erq.reason = p.monthly_reason OR erq.error_message ILIKE '%status code 432%'
  OR erq.error_message ILIKE '%monthly quota%' OR erq.error_message ILIKE '%quota reached%')`;
const hasEvidence = `((erq.enrichment_type = 'omdb' AND msi.metadata->'omdb' IS NOT NULL)
  OR (erq.enrichment_type IN ('tavily', 'web_search') AND (
    msi.metadata->'tavily_imdb' IS NOT NULL OR msi.metadata->'tavily_advisory' IS NOT NULL
    OR msi.metadata->'web_search_imdb' IS NOT NULL OR msi.metadata->'web_search_advisory' IS NOT NULL
    OR msi.metadata->'omdb' IS NOT NULL))
  OR (erq.enrichment_type = 'tmdb' AND msi.metadata->'tmdb' IS NOT NULL))`;

// Only fixed internal SQL fragments enter this builder. Values remain parameters.
function operation(predicate, assignments) {
  return Object.freeze({
    select: `${policy} SELECT erq.id, erq.media_item_id FROM enrichment_retry_queue erq
      JOIN media_server_items msi ON msi.id = erq.media_item_id CROSS JOIN policy p
      WHERE ${scope} AND ${predicate}
      ORDER BY erq.media_item_id, erq.id LIMIT 50 FOR UPDATE OF erq SKIP LOCKED`,
    update: `${policy} UPDATE enrichment_retry_queue erq SET ${assignments}
      FROM media_server_items msi CROSS JOIN policy p
      WHERE erq.id = ANY($4::integer[]) AND msi.id = ANY($5::integer[])
        AND erq.media_item_id = msi.id AND ${scope} AND ${predicate}
      RETURNING erq.id, erq.media_item_id`,
  });
}

export const RETRY_MAINTENANCE_OPERATIONS = Object.freeze({
  exhausted: operation(`erq.status = 'pending' AND erq.attempts >= erq.max_attempts
    AND NOT ${hasEvidence}
    AND NOT (erq.enrichment_type = 'tavily' AND COALESCE(${monthlyReason}, false))`,
  `status = 'failed', completed_at = NOW(),
    error_message = COALESCE(erq.error_message, 'Max attempts reached while pending')`),
  completed: operation(`erq.status = 'pending' AND ${hasEvidence}`,
  `status = 'completed', completed_at = COALESCE(erq.completed_at, NOW()),
    error_message = COALESCE(erq.error_message, 'Auto-resolved: required enrichment metadata already present')`),
  monthly: operation(`erq.enrichment_type = 'tavily' AND ${monthlyReason}
    AND COALESCE(erq.last_attempt_at, erq.created_at) IS NOT NULL
    AND (erq.status IN ('failed', 'skipped') OR (erq.status = 'pending' AND erq.attempts >= erq.max_attempts))
    AND (erq.status IS DISTINCT FROM 'pending' OR erq.reason IS DISTINCT FROM p.monthly_reason
      OR erq.attempts IS DISTINCT FROM 0 OR erq.completed_at IS NOT NULL
      OR erq.next_attempt_at IS DISTINCT FROM ${monthlyDate}
      OR erq.error_message IS DISTINCT FROM p.monthly_message)`,
  `status = 'pending', reason = p.monthly_reason, attempts = 0, completed_at = NULL,
    next_attempt_at = ${monthlyDate}, error_message = p.monthly_message`),
});
