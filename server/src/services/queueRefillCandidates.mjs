/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inventoryTmdbObservationDue, INVENTORY_TMDB_RETRY_HOURS } from './inventoryTmdbObservation.mjs';
import { INVENTORY_TMDB_REFILL_SQL } from './queueInventoryTmdbRefill.mjs';

export const REFILL_QUEUE_BATCH_LIMIT = 5000;
const STANDARD_ENRICHMENT_SQL = `msi.metadata->'content_analysis' IS NULL
    OR (msi.metadata->'omdb' IS NULL AND (
        msi.metadata->'content_analysis'->>'source' IS DISTINCT FROM 'metadata_enrichment'
        OR EXISTS (SELECT 1 FROM omdb_config WHERE is_active = true)))`;

/** One bounded page per cycle; a fixed pass ceiling prevents insertions from delaying wraparound. */
export async function readRefillCandidatePage(db, cursor) {
    const result = await db.query(
        `SELECT msi.id, msi.title, msi.metadata, msi.genres, msi.tags, msi.content_rating,
                msi.tmdb_id, msi.tvdb_id, msi.imdb_id, msi.year,
                msi.library_id, l.name as library_name, msi.media_type,
                msi.inventory_tmdb_attempted_at, msi.inventory_tmdb_fetched_at,
                NOW() AS inventory_tmdb_checked_at, scan.through_id,
                (${STANDARD_ENRICHMENT_SQL}) AS needs_standard_enrichment
         FROM media_server_items msi
         LEFT JOIN libraries l ON msi.library_id = l.id
         CROSS JOIN (SELECT COALESCE($3::integer, (SELECT MAX(id) FROM media_server_items)) AS through_id) scan
         WHERE ((${STANDARD_ENRICHMENT_SQL}) OR (${INVENTORY_TMDB_REFILL_SQL}))
         AND msi.media_type IN ('movie', 'tv')
         AND msi.id > $2 AND msi.id <= scan.through_id
         AND NOT EXISTS (
             SELECT 1 FROM task_queue tq
             WHERE tq.task_type = 'metadata_enrichment'
             AND tq.status IN ('pending', 'processing')
             AND tq.payload->>'itemId' = msi.id::text
         )
         ORDER BY msi.id
         LIMIT ${REFILL_QUEUE_BATCH_LIMIT}`,
        [INVENTORY_TMDB_RETRY_HOURS, cursor?.afterId ?? 0, cursor?.throughId ?? null]
    );
    const last = result.rows.at(-1);
    return {
        cursor: result.rows.length === REFILL_QUEUE_BATCH_LIMIT
            ? { afterId: last.id, throughId: last.through_id } : null,
        rows: result.rows.filter(item => item.needs_standard_enrichment !== false ||
            inventoryTmdbObservationDue({
                media: { media_type: item.media_type },
                inventory_tmdb: item.metadata?.inventory_tmdb,
                inventory_tmdb_attempted_at: item.inventory_tmdb_attempted_at,
                inventory_tmdb_fetched_at: item.inventory_tmdb_fetched_at,
            }, item.tmdb_id, new Date(item.inventory_tmdb_checked_at).getTime())),
    };
}
