/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INGESTION_OWNER_ACTIVE_SQL, INGESTION_UNFINISHED_MARKERS_SQL } from './libraryIngestionPredicates.mjs';
import { sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

// Fixed identifiers only. Configuration values never become SQL or endpoint URLs.
const definitions = new Map([
  ['omdb', {
    lock: 'LOCK TABLE omdb_config IN SHARE ROW EXCLUSIVE MODE',
    select: `SELECT *, to_char(last_reset_date, 'YYYY-MM-DD') AS last_reset_date,
      to_char(statement_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS quota_day
      FROM omdb_config WHERE id=$1 AND is_active AND id=(SELECT id FROM omdb_config
        WHERE is_active ORDER BY id DESC LIMIT 1) FOR UPDATE SKIP LOCKED`,
    recover: `UPDATE omdb_config SET credential_generation=gen_random_uuid(), credential_rejected_at=NULL
      WHERE id=$1 AND credential_generation=$2 RETURNING id,credential_generation`,
  }],
  ['web_search', {
    select: 'SELECT * FROM web_search_provider_config WHERE id=$1 AND is_enabled FOR UPDATE SKIP LOCKED',
    recover: `UPDATE web_search_provider_config SET credential_generation=gen_random_uuid(), credential_rejected_at=NULL
      WHERE id=$1 AND credential_generation=$2 RETURNING id,credential_generation`,
  }],
  ['legacy_tavily', {
    lock: 'LOCK TABLE tavily_config IN SHARE ROW EXCLUSIVE MODE',
    select: `SELECT * FROM tavily_config WHERE id=$1 AND is_active
      AND id=(SELECT id FROM tavily_config WHERE is_active ORDER BY id DESC LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM web_search_provider_config WHERE provider_key='tavily')
      FOR UPDATE SKIP LOCKED`,
    recover: `UPDATE tavily_config SET credential_generation=gen_random_uuid(), credential_rejected_at=NULL
      WHERE id=$1 AND credential_generation=$2 RETURNING id,credential_generation`,
  }],
]);
export const probeDefinition = source => definitions.get(source);

export const PROBE_CANDIDATES_SQL = `WITH selected AS (
  SELECT 'omdb'::text AS source, id, 'omdb'::text AS provider_key, credential_generation, credential_rejected_at
    FROM (SELECT * FROM omdb_config WHERE is_active ORDER BY id DESC LIMIT 1) c WHERE length(btrim(api_key))>0
  UNION ALL SELECT 'web_search', id, provider_key, credential_generation, credential_rejected_at
    FROM web_search_provider_config WHERE is_enabled AND length(btrim(api_key))>0
      AND provider_key IN ('tavily','brave','serper')
  UNION ALL SELECT 'legacy_tavily', id, 'tavily', credential_generation, credential_rejected_at
    FROM (SELECT * FROM tavily_config WHERE is_active ORDER BY id DESC LIMIT 1) c
    WHERE length(btrim(api_key))>0 AND NOT EXISTS (
      SELECT 1 FROM web_search_provider_config WHERE provider_key='tavily')
) SELECT c.source,c.id,c.provider_key FROM selected c LEFT JOIN provider_credential_probes p
  ON p.source=c.source AND p.config_id=c.id AND p.generation=c.credential_generation
  WHERE c.credential_rejected_at IS NOT NULL
    AND COALESCE(p.next_probe_at,c.credential_rejected_at+interval '15 minutes')<=statement_timestamp()
    AND (p.lease_until IS NULL OR p.lease_until<=statement_timestamp())
  ORDER BY COALESCE(p.next_probe_at,c.credential_rejected_at),c.source,c.id LIMIT 4`;

/** Demand, not global background readiness: enrichment itself can unblock backfill. */
export const PROBE_DEMAND_SQL = `SELECT EXISTS (
  SELECT 1 FROM enrichment_retry_queue erq JOIN media_server_items msi ON msi.id=erq.media_item_id
  JOIN libraries l ON l.id=msi.library_id LEFT JOIN media_server ms ON ms.id=l.media_server_id
  WHERE erq.status='pending' AND erq.attempts<erq.max_attempts AND erq.next_attempt_at<=statement_timestamp()
    AND (($1='omdb' AND erq.enrichment_type='omdb' AND msi.metadata->'omdb' IS NULL)
      OR ($1='web_search' AND erq.enrichment_type IN ('web_search','tavily')
        AND msi.metadata->'omdb' IS NULL AND msi.metadata->'tavily_imdb' IS NULL
        AND msi.metadata->'tavily_advisory' IS NULL AND msi.metadata->'web_search_imdb' IS NULL
        AND msi.metadata->'web_search_advisory' IS NULL))
    AND msi.media_type IN ('movie','tv') AND l.media_type IN ('movie','tv') AND l.is_active
    AND (l.media_server_id IS NULL OR ms.is_active)
    AND NOT (${INGESTION_UNFINISHED_MARKERS_SQL} OR ${INGESTION_OWNER_ACTIVE_SQL})
    AND NOT EXISTS (SELECT 1 FROM library_ingestion_state s WHERE s.library_id=l.id AND s.phase<>'complete')
    AND (l.media_server_id IS NULL OR EXISTS (SELECT 1 FROM library_ingestion_state s WHERE s.library_id=l.id))
    AND ${sourceConflictAuthorityExclusionForMediaServerItem('$2')}
    AND NOT EXISTS (SELECT 1 FROM enrichment_retry_cooldowns c WHERE c.dependency=$1
      AND c.next_attempt_at>statement_timestamp())
    AND (erq.enrichment_type<>'tavily' OR erq.reason IS DISTINCT FROM $3
      OR date_trunc('month',COALESCE(erq.last_attempt_at,erq.created_at) AT TIME ZONE 'UTC')
        <date_trunc('month',statement_timestamp() AT TIME ZONE 'UTC'))
) AS needed`;
