/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Fixed msi alias shared by refill and current-source reads. Once handed off,
// due/processing/terminal retries all belong to the retry controller, not refill.
export const RETRY_OWNS_METADATA_PROVIDERS_SQL = `EXISTS (
    SELECT 1 FROM enrichment_retry_queue retry
    WHERE retry.media_item_id = msi.id
      AND retry.enrichment_type IN ('omdb', 'web_search', 'tavily')
)`;

export const STANDARD_METADATA_REFILL_SQL = `msi.metadata->'content_analysis' IS NULL
    OR (msi.metadata->'omdb' IS NULL AND NOT (${RETRY_OWNS_METADATA_PROVIDERS_SQL}) AND (
        msi.metadata->'content_analysis'->>'source' IS DISTINCT FROM 'metadata_enrichment'
        OR EXISTS (SELECT 1 FROM (SELECT api_key FROM omdb_config WHERE is_active = true
            ORDER BY id DESC LIMIT 1) selected_omdb WHERE NULLIF(BTRIM(api_key), '') IS NOT NULL)))`;
