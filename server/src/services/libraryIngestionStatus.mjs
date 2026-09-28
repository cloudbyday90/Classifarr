/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INGESTION_OWNER_ACTIVE_SQL, INGESTION_FOREIGN_MARKERS_SQL as foreignOwner,
  INGESTION_UNFINISHED_MARKERS_SQL } from './libraryIngestionPredicates.mjs';
import { SOURCE_CONTENT_STATUS_SQL, SOURCE_CONTENT_COOLING_SQL } from './sourceContentStatus.mjs';

export const LIBRARY_INGESTION_STATUS_SQL = `(COALESCE((SELECT jsonb_build_object(
    'state',CASE WHEN s.phase<>'complete' AND (NOT l.is_active OR NOT EXISTS
        (SELECT 1 FROM media_server ms WHERE ms.id=l.media_server_id AND ms.is_active)) THEN 'disabled'
      WHEN s.phase<>'complete' AND NOT EXISTS (SELECT 1 FROM media_server ms WHERE ms.id=l.media_server_id
        AND length(btrim(ms.url))>0 AND length(btrim(ms.api_key))>0) THEN 'unconfigured'
      WHEN ${foreignOwner} THEN 'legacy_owner_unknown'
      WHEN ${INGESTION_OWNER_ACTIVE_SQL} THEN 'active'
      WHEN s.phase='running' THEN 'interrupted' ELSE s.phase END,
    'needsReconciliation',${foreignOwner},
    'pages',s.pages_processed,'items',s.items_processed,'total',s.items_total,'restarts',s.restart_count,
    'retryAt',s.retry_after,'updatedAt',s.updated_at)
  FROM library_ingestion_state s WHERE s.library_id=l.id),
  CASE WHEN ${INGESTION_UNFINISHED_MARKERS_SQL}
    THEN jsonb_build_object('state','legacy_owner_unknown','needsReconciliation',true)
    WHEN l.media_server_id IS NOT NULL AND l.media_type IN ('movie','tv') THEN jsonb_build_object(
      'state',CASE WHEN NOT l.is_active OR NOT EXISTS (SELECT 1 FROM media_server ms
          WHERE ms.id=l.media_server_id AND ms.is_active) THEN 'disabled'
        WHEN NOT EXISTS (SELECT 1 FROM media_server ms WHERE ms.id=l.media_server_id
          AND length(btrim(ms.url))>0 AND length(btrim(ms.api_key))>0) THEN 'unconfigured'
        WHEN ${INGESTION_OWNER_ACTIVE_SQL} THEN 'active' ELSE 'awaiting_import' END,
      'needsReconciliation',false) END) || jsonb_build_object('sourceRecovery',${SOURCE_CONTENT_STATUS_SQL}))`;

export const LIBRARY_INGESTION_WATCHDOG_SQL = `SELECT l.id,l.name FROM libraries l
  JOIN media_server ms ON ms.id=l.media_server_id AND ms.is_active
  LEFT JOIN library_ingestion_state s ON s.library_id=l.id
  WHERE l.is_active AND l.media_type IN ('movie','tv') AND NOT (${INGESTION_OWNER_ACTIVE_SQL})
    AND length(btrim(ms.url))>0 AND length(btrim(ms.api_key))>0
    AND NOT ${SOURCE_CONTENT_COOLING_SQL}
    AND NOT ${foreignOwner}
    AND (s.retry_after IS NULL OR s.retry_after<=clock_timestamp() OR s.phase='complete')
    AND (s.phase IN ('running','retry_wait') OR s.library_id IS NULL)
  ORDER BY s.retry_after NULLS FIRST,l.id LIMIT 10`;
