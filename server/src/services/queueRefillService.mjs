/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { canonicalMediaType } from './mediaIdentityValues.mjs';
import { readInventoryTmdbObservation } from './inventoryTmdbObservation.mjs';
import { readRefillCandidatePage } from './queueRefillCandidates.mjs';

export { REFILL_QUEUE_BATCH_LIMIT } from './queueRefillCandidates.mjs';

export class QueueRefillService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.enqueueTask = deps.enqueueTask || (async () => {});
        this.refillCursor = null;
        this.refillInFlight = null;
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
        const page = await readRefillCandidatePage(this.db, this.refillCursor);
        this.refillCursor = page.cursor;
        return page.rows;
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
        if (this.refillInFlight) return this.refillInFlight;
        const checkpoint = this.refillCursor;
        this.refillInFlight = this._withCatch('Error refilling queue', async () => {
            const candidates = await this.selectRefillCandidates();

            if (candidates.length === 0) {
                this.logger.debug('Refill queue: No enrichment due in this inventory page');
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
        try {
            return await this.refillInFlight;
        } catch (error) {
            this.refillCursor = checkpoint;
            throw error;
        } finally {
            this.refillInFlight = null;
        }
    }
}
