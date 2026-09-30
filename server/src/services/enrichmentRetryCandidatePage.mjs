/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RETRY_ITEM_BASE_ELIGIBILITY_SQL, RETRY_QUEUE_GATES_SQL, retryCandidateParameters } from './enrichmentRetryCandidatePolicy.mjs';
import { retryEffectiveDueSql } from './enrichmentRetryDuePolicy.mjs';
import { retryCredentialsBlockedSql } from './enrichmentRetryCredentialGate.mjs';
import { sourceConflictPageExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';
import { RETRY_MAY_HAVE_WORK_SQL } from './enrichmentRetryAvailability.mjs';

// NULL sorts after actual infinity. Keep the raw timestamp as text: JS Date loses microseconds.
const SEEK_SQL = `($5::integer IS NULL OR erq.priority > $5 OR (erq.priority = $5 AND (
  ($6::timestamptz IS NOT NULL AND ((erq.created_at,erq.id)>($6::timestamptz,$7::integer) OR erq.created_at IS NULL))
  OR ($6::timestamptz IS NULL AND erq.created_at IS NULL AND erq.id>$7::integer))))`;

const PAGE_SQL = `WITH retry_contexts AS MATERIALIZED (
    SELECT * FROM enrichment_retry_provider_contexts
  ), retry_credentials AS MATERIALIZED (
    SELECT * FROM enrichment_provider_credential_status
  )
  SELECT erq.id AS queue_id, erq.priority, erq.created_at::text AS retry_created_at,
    msi.title, msi.year, msi.media_type, msi.tmdb_id, msi.imdb_id
  FROM enrichment_retry_queue erq
  -- OFFSET 0 is a join-order boundary, not page skipping. The primary key bounds
  -- each item lookup to one row, after queue filtering instead of a full media scan.
  JOIN LATERAL (SELECT * FROM media_server_items WHERE id=erq.media_item_id OFFSET 0) msi ON TRUE
  WHERE ${RETRY_MAY_HAVE_WORK_SQL}
    AND ${RETRY_QUEUE_GATES_SQL} AND NOT ${retryCredentialsBlockedSql(true)}
    AND (${retryEffectiveDueSql(true)}) <= statement_timestamp()
    AND ${RETRY_ITEM_BASE_ELIGIBILITY_SQL}
    AND ${sourceConflictPageExclusionForMediaServerItem('$4')}
    AND ${SEEK_SQL}
  ORDER BY erq.priority, erq.created_at NULLS LAST, erq.id LIMIT $8`;

/** Read-only hints, never admission authority. Claims recheck all live gates by ID. */
export async function readEnrichmentRetryPage(db, type, cursor, limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new TypeError('invalid_retry_page');
  const { rows } = await db.query(PAGE_SQL, [...retryCandidateParameters(type),
    cursor?.priority ?? null, cursor?.retry_created_at ?? null, cursor?.queue_id ?? null, limit]);
  return rows;
}
