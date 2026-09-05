/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { captureQueueEnrichmentPayload } from './queueEnrichmentPayload.mjs';
import { omdbImdbId, typedTmdbResults } from './queueEnrichmentResults.mjs';

export class QueueTmdbResolutionService {
    constructor(deps = {}) {
        this.logger = deps.logger;
        this.tmdbService = deps.tmdbService;
        this.queryWithTimeout = deps.queryWithTimeout || (async () => ({}));
    }

    async resolveFromTvdb(payload) {
        payload = captureQueueEnrichmentPayload(payload);
        if (!payload || payload.media.media_type !== 'tv' || !positiveDatabaseInteger(payload.tvdb_id)) {
            return null;
        }

        try {
            const tvdbLookup = await this.tmdbService.findByExternalId(payload.tvdb_id, 'tvdb_id');
            const tvResults = typedTmdbResults(tvdbLookup?.tv_results, 'tv');
            if (tvResults.length > 0) {
                const tmdbId = positiveDatabaseInteger(tvResults[0].id);
                this.logger.info('TVDB→TMDB conversion successful', {
                    tvdbId: payload.tvdb_id,
                    tmdbId,
                    title: payload.title
                });
                return tmdbId;
            }
        } catch (error) {
            this.logger.debug('TVDB→TMDB lookup failed', { error: error.message });
        }

        return null;
    }

    async resolveFromImdb(payload, enrichmentData) {
        payload = captureQueueEnrichmentPayload(payload);
        if (!payload) return null;
        const mediaType = payload.media.media_type;
        const imdbId = omdbImdbId(enrichmentData?.omdb?.data, mediaType) || payload.imdb_id;
        if (typeof imdbId !== 'string' || !/^tt[0-9]{1,12}$/u.test(imdbId)) {
            return null;
        }

        try {
            const imdbLookup = await this.tmdbService.findByExternalId(imdbId, 'imdb_id');
            const results = typedTmdbResults(mediaType === 'movie'
                ? imdbLookup?.movie_results : imdbLookup?.tv_results, mediaType);
            if (results.length > 0) {
                const tmdbId = positiveDatabaseInteger(results[0].id);
                this.logger.info('IMDB→TMDB conversion successful', {
                    imdbId,
                    tmdbId,
                    title: payload.title
                });
                return tmdbId;
            }
        } catch (error) {
            this.logger.debug('IMDB→TMDB lookup failed', { error: error.message });
        }

        return null;
    }

    async resolveFromTitle(payload) {
        payload = captureQueueEnrichmentPayload(payload);
        if (!payload || typeof payload.title !== 'string' || !payload.title.trim() || payload.title.length > 500) {
            return null;
        }

        try {
            const mediaType = payload.media.media_type;
            const searchQuery = payload.year
                ? `${payload.title} ${payload.year}`
                : payload.title;

            const searchResults = typedTmdbResults(await this.tmdbService.search(searchQuery, mediaType), mediaType);

            if (searchResults && searchResults.length > 0) {
                const bestMatch = searchResults.find(r =>
                    r.title?.toLowerCase() === payload.title?.toLowerCase() &&
                    (!payload.year || r.year === String(payload.year))
                ) || searchResults[0];

                const tmdbId = positiveDatabaseInteger(bestMatch.id);
                this.logger.info('TMDB title search successful', {
                    query: searchQuery,
                    tmdbId,
                    matchedTitle: bestMatch.title,
                    title: payload.title
                });
                return tmdbId;
            }
        } catch (error) {
            this.logger.debug('TMDB title search failed', { error: error.message });
        }

        return null;
    }

    async backfillTmdbId(itemId, tmdbId, mediaType) {
        itemId = positiveDatabaseInteger(itemId);
        tmdbId = positiveDatabaseInteger(tmdbId);
        mediaType = canonicalMediaType(mediaType);
        if (!itemId || !tmdbId || !mediaType) {
            return;
        }

        const updated = await this.queryWithTimeout(
            'UPDATE media_server_items SET tmdb_id = $1 WHERE id = $2 AND media_type = $3 AND tmdb_id IS NULL',
            [tmdbId, itemId, mediaType]
        );
        if (updated?.rowCount !== 1) return;
        this.logger.info('Backfilled TMDB ID to media_server_items', {
            itemId,
            tmdbId
        });
    }

    async resolveAndBackfill(payload, enrichmentData, currentTmdbId = null) {
        payload = captureQueueEnrichmentPayload(payload);
        if (!payload || (currentTmdbId != null && !positiveDatabaseInteger(currentTmdbId))) return null;
        let tmdbId = positiveDatabaseInteger(currentTmdbId);

        if (!tmdbId) {
            tmdbId = await this.resolveFromTvdb(payload);
        }

        if (!tmdbId) {
            tmdbId = await this.resolveFromImdb(payload, enrichmentData);
        }

        if (!tmdbId) {
            tmdbId = await this.resolveFromTitle(payload);
        }

        if (tmdbId) {
            await this.backfillTmdbId(payload.itemId, tmdbId, payload.media.media_type);
        }

        return tmdbId;
    }
}
