/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RETRY_CANDIDATE_SQL, retryCandidateParameters } from '../../services/enrichmentRetryCandidatePolicy.mjs';

/** Pre-refactor page shape (b28e3549), offline comparison only. Shares current authority rules. */
export function baselineRetryPage(type, cursor = null) {
  return { sql: `SELECT erq.id AS queue_id, erq.priority,
    COALESCE(erq.created_at,'infinity'::timestamptz)::text AS retry_created_at,
    msi.title, msi.year, msi.media_type, msi.tmdb_id, msi.imdb_id
    FROM enrichment_retry_queue erq JOIN media_server_items msi ON msi.id = erq.media_item_id
    WHERE ${RETRY_CANDIDATE_SQL}
      AND ($5::integer IS NULL OR (erq.priority,COALESCE(erq.created_at,'infinity'::timestamptz),erq.id)>($5,$6::timestamptz,$7::integer))
    ORDER BY erq.priority,erq.created_at,erq.id LIMIT $8`,
  params: [...retryCandidateParameters(type), cursor?.priority ?? null,
    cursor?.retry_created_at ?? null, cursor?.queue_id ?? null, 50] };
}
