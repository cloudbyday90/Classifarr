/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { canonicalMediaType } from './mediaIdentityValues.mjs';
import { readInventoryTmdbObservation, INVENTORY_TMDB_CACHE_DAYS, INVENTORY_TMDB_RETRY_HOURS } from './inventoryTmdbObservation.mjs';
import { INVENTORY_TMDB_REFILL_SQL } from './queueInventoryTmdbRefill.mjs';

export const REFILL_QUEUE_BATCH_LIMIT = 5000;
const STANDARD_ENRICHMENT_SQL = `msi.metadata->'content_analysis' IS NULL
    OR (msi.metadata->'omdb' IS NULL AND (
        msi.metadata->'content_analysis'->>'source' IS DISTINCT FROM 'metadata_enrichment'
        OR EXISTS (SELECT 1 FROM omdb_config WHERE is_active = true)))`;

export class QueueRefillService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.enqueueTask = deps.enqueueTask || (async () => {});
    }

    async _withCatch(label, fn) {
        try {
            return await fn();
        } catch (error) {
            this.logger.error(label, { error: error.message });
            throw error;
        }
    }

    async selectRefillCandidates() {
        const result = await this.db.query(
            `SELECT msi.id, msi.title, msi.metadata, msi.genres, msi.tags, msi.content_rating, 
                    msi.tmdb_id, msi.tvdb_id, msi.imdb_id, msi.year,
                    msi.library_id, l.name as library_name, msi.media_type,
                    (${STANDARD_ENRICHMENT_SQL}) AS needs_standard_enrichment
             FROM media_server_items msi
             LEFT JOIN libraries l ON msi.library_id = l.id
             WHERE ((${STANDARD_ENRICHMENT_SQL}) OR (${INVENTORY_TMDB_REFILL_SQL}))
             AND msi.media_type IN ('movie', 'tv')
             AND NOT EXISTS (
                 SELECT 1 FROM task_queue tq 
                 WHERE tq.task_type = 'metadata_enrichment' 
                 AND tq.status IN ('pending', 'processing')
                 AND tq.payload->>'itemId' = msi.id::text
             )
             ORDER BY msi.inventory_tmdb_attempted_at NULLS FIRST, msi.id
             LIMIT ${REFILL_QUEUE_BATCH_LIMIT}`,
            [INVENTORY_TMDB_CACHE_DAYS, INVENTORY_TMDB_RETRY_HOURS]
        );

        return result.rows;
    }

    buildMetadataEnrichmentPayload(item) {
        const mediaType = canonicalMediaType(item.media_type);
        if (!mediaType) return null;
        const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
        const observation = readInventoryTmdbObservation(item);

        return {
            title: item.title,
            year: item.year,
            overview: metadata.summary || '',
            genres: normalizeMetadataList(item.genres),
            keywords: observation?.keywords || [],
            tags: normalizeMetadataList(item.tags),
            content_rating: item.content_rating,
            original_language: observation?.original_language ?? null,
            tmdb_id: item.tmdb_id,
            tvdb_id: item.tvdb_id,
            imdb_id: item.imdb_id,
            posterPath: metadata.posterPath || null,
            itemId: item.id,
            source_library_id: item.library_id,
            source_library_name: item.library_name,
            media: { media_type: mediaType },
            ...(item.needs_standard_enrichment === false ? { inventory_tmdb_only: true } : {}),
        };
    }

    async refillQueue() {
        return this._withCatch('Error refilling queue', async () => {
            const candidates = await this.selectRefillCandidates();

            if (candidates.length === 0) {
                this.logger.debug('Refill queue: No unanalyzed items found');
                return { queued: 0 };
            }

            this.logger.info(`Refill queue: Found ${candidates.length} unanalyzed items. Queueing for metadata enrichment...`);
            let queuedCount = 0;

            for (const item of candidates) {
                const payload = this.buildMetadataEnrichmentPayload(item);
                if (!payload) continue;
                await this.enqueueTask('metadata_enrichment', payload, {
                    priority: 5,
                    source: 'gap_analysis',
                });
                queuedCount += 1;
            }

            return { queued: queuedCount };
        });
    }
}
