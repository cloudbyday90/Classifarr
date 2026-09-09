/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inventoryTmdbObservationDue, INVENTORY_TMDB_RETRY_HOURS } from './inventoryTmdbObservation.mjs';
import { INVENTORY_TMDB_REFILL_SQL } from './queueInventoryTmdbRefill.mjs';
import {
    elapsedMilliseconds,
    QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS,
    recordQueueStartupPerformanceObservation,
} from './queueStartupPerformanceReceipt.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

export const REFILL_QUEUE_BATCH_LIMIT = 5000;
const STANDARD_ENRICHMENT_SQL = `msi.metadata->'content_analysis' IS NULL
    OR (msi.metadata->'omdb' IS NULL AND (
        msi.metadata->'content_analysis'->>'source' IS DISTINCT FROM 'metadata_enrichment'
        OR EXISTS (SELECT 1 FROM omdb_config WHERE is_active = true)))`;

function boundedPositiveInteger(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function cursorFromScanProgress(row) {
    const scanCount = boundedPositiveInteger(row?.scan_count);
    const afterId = boundedPositiveInteger(row?.scan_after_id);
    const throughId = boundedPositiveInteger(row?.through_id);
    return scanCount === REFILL_QUEUE_BATCH_LIMIT && afterId && throughId && afterId < throughId
        ? { afterId, throughId }
        : null;
}

function isCandidateRow(row) {
    return boundedPositiveInteger(row?.id) !== null;
}

/** One bounded page per cycle; a fixed pass ceiling prevents insertions from delaying wraparound. */
export async function readRefillCandidatePage(db, cursor, performanceReceiptRecorder = null) {
    const startedAt = process.hrtime.bigint();
    const result = await db.query(
        `WITH scan_bounds AS (
             SELECT COALESCE($3::integer, (SELECT MAX(id) FROM media_server_items)) AS through_id
         ), scan AS MATERIALIZED (
             SELECT msi.id
             FROM media_server_items msi
             CROSS JOIN scan_bounds
             WHERE msi.id > $2
               AND msi.id <= scan_bounds.through_id
               AND msi.media_type IN ('movie', 'tv')
             ORDER BY msi.id
             LIMIT ${REFILL_QUEUE_BATCH_LIMIT}
         ), scan_progress AS (
             SELECT scan_bounds.through_id,
                    COUNT(scan.id) AS scan_count,
                    MAX(scan.id) AS scan_after_id
             FROM scan_bounds
             LEFT JOIN scan ON true
             GROUP BY scan_bounds.through_id
         )
         SELECT candidate.*, scan_progress.through_id, scan_progress.scan_count, scan_progress.scan_after_id
         FROM scan_progress
         LEFT JOIN LATERAL (
             SELECT msi.id, msi.title, msi.metadata, msi.genres, msi.tags, msi.content_rating,
                msi.tmdb_id, msi.tvdb_id, msi.imdb_id, msi.year,
                msi.library_id, l.name as library_name, msi.media_type,
                msi.inventory_tmdb_attempted_at, msi.inventory_tmdb_fetched_at,
                NOW() AS inventory_tmdb_checked_at,
                (${STANDARD_ENRICHMENT_SQL}) AS needs_standard_enrichment
             FROM scan
             JOIN media_server_items msi ON msi.id = scan.id
             LEFT JOIN libraries l ON msi.library_id = l.id
             WHERE ((${STANDARD_ENRICHMENT_SQL}) OR (${INVENTORY_TMDB_REFILL_SQL}))
             AND scan.id <= scan_progress.through_id
             AND msi.media_type IN ('movie', 'tv')
             AND ${sourceConflictAuthorityExclusionForMediaServerItem('$4')}
             AND NOT EXISTS (
                 SELECT 1 FROM task_queue tq
                 WHERE tq.task_type = 'metadata_enrichment'
                 AND tq.status IN ('pending', 'processing')
                 AND tq.payload->>'itemId' = msi.id::text
             )
         ) candidate ON true`,
        [INVENTORY_TMDB_RETRY_HOURS, cursor?.afterId ?? 0, cursor?.throughId ?? null, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]
    );
    const progress = result.rows.at(0);
    const rows = result.rows.filter(isCandidateRow).filter(item => item.needs_standard_enrichment !== false ||
        inventoryTmdbObservationDue({
            media: { media_type: item.media_type },
            inventory_tmdb: item.metadata?.inventory_tmdb,
            inventory_tmdb_attempted_at: item.inventory_tmdb_attempted_at,
            inventory_tmdb_fetched_at: item.inventory_tmdb_fetched_at,
        }, item.tmdb_id, new Date(item.inventory_tmdb_checked_at).getTime()))
        .sort((left, right) => left.id - right.id);

    recordQueueStartupPerformanceObservation(performanceReceiptRecorder, {
        operationId: QUEUE_STARTUP_PERFORMANCE_OPERATION_IDS.QUEUE_REFILL_CANDIDATES,
        durationMs: elapsedMilliseconds(startedAt),
        scannedIdCount: progress?.scan_count,
        candidateCount: rows.length,
    });

    return {
        cursor: cursorFromScanProgress(progress),
        rows,
    };
}
