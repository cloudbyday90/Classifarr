/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ENRICHMENT_METADATA_KEYS } from '../utils/metadataEnrichment.mjs';

/** One snapshot, no item payloads returned, and no optional AI/embedding work. */
export async function readRecoveryMetadata(db, libraryId) {
  const { rows: [counts] } = await db.query(`WITH evidence AS (
    SELECT i.id,
      jsonb_typeof(i.metadata->'content_analysis')='object' AND (
        EXISTS (SELECT 1 FROM unnest($2::text[]) key WHERE jsonb_typeof(i.metadata->key)='object')
        OR (i.metadata->'content_analysis'->>'source'='metadata_enrichment'
          AND NOT EXISTS (SELECT 1 FROM omdb_config WHERE is_active))) AS ready,
      EXISTS (SELECT 1 FROM task_queue t WHERE t.task_type='metadata_enrichment' AND t.status IN ('pending','processing')
        AND (t.payload->>'itemId'=i.id::text OR t.payload->>'media_item_id'=i.id::text))
        OR EXISTS (SELECT 1 FROM enrichment_retry_queue e WHERE e.media_item_id=i.id AND e.status IN ('pending','processing')) AS active,
      EXISTS (SELECT 1 FROM task_queue t WHERE t.task_type='metadata_enrichment' AND t.status='failed'
        AND (t.payload->>'itemId'=i.id::text OR t.payload->>'media_item_id'=i.id::text))
        OR EXISTS (SELECT 1 FROM enrichment_retry_queue e WHERE e.media_item_id=i.id AND e.status='failed') AS failed
    FROM media_server_items i WHERE i.library_id=$1 AND i.media_type IN ('movie','tv')
  ) SELECT COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE ready AND NOT active)::integer AS ready,
    COUNT(*) FILTER (WHERE NOT active AND NOT COALESCE(ready,false) AND failed)::integer AS blocked,
    COUNT(*) FILTER (WHERE active OR (NOT COALESCE(ready,false) AND NOT failed))::integer AS pending,
    statement_timestamp() AS checked_at FROM evidence`, [libraryId, ENRICHMENT_METADATA_KEYS]);
  return counts;
}
