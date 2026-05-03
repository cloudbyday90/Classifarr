/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

class QueueTmdbResolutionService {
    constructor(deps = {}) {
        this.logger = deps.logger;
        this.tmdbService = deps.tmdbService;
        this.queryWithTimeout = deps.queryWithTimeout || (async () => ({}));
    }

    async resolveFromTvdb(payload) {
        if (!payload.tvdb_id) {
            return null;
        }

        try {
            const tvdbLookup = await this.tmdbService.findByExternalId(payload.tvdb_id, 'tvdb_id');
            const tvResults = tvdbLookup.tv_results || [];
            if (tvResults.length > 0) {
                const tmdbId = tvResults[0].id;
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
        const imdbId = enrichmentData.omdb?.data?.imdbID || payload.imdb_id;
        if (!imdbId) {
            return null;
        }

        try {
            const imdbLookup = await this.tmdbService.findByExternalId(imdbId, 'imdb_id');
            const results = imdbLookup.movie_results?.length > 0
                ? imdbLookup.movie_results
                : imdbLookup.tv_results || [];
            if (results.length > 0) {
                const tmdbId = results[0].id;
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
        if (!payload.title) {
            return null;
        }

        try {
            const mediaType = payload.media?.media_type || 'movie';
            const searchQuery = payload.year
                ? `${payload.title} ${payload.year}`
                : payload.title;

            const searchResults = await this.tmdbService.search(searchQuery, mediaType);

            if (searchResults && searchResults.length > 0) {
                const bestMatch = searchResults.find(r =>
                    r.title?.toLowerCase() === payload.title?.toLowerCase() &&
                    (!payload.year || r.year === String(payload.year))
                ) || searchResults[0];

                const tmdbId = bestMatch.id;
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

    async backfillTmdbId(itemId, tmdbId) {
        if (!itemId || !tmdbId) {
            return;
        }

        await this.queryWithTimeout(
            'UPDATE media_server_items SET tmdb_id = $1 WHERE id = $2 AND tmdb_id IS NULL',
            [tmdbId, itemId]
        );
        this.logger.info('Backfilled TMDB ID to media_server_items', {
            itemId,
            tmdbId
        });
    }

    async resolveAndBackfill(payload, enrichmentData, currentTmdbId = null) {
        let tmdbId = currentTmdbId;

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
            await this.backfillTmdbId(payload.itemId, tmdbId);
        }

        return tmdbId;
    }
}

module.exports = { QueueTmdbResolutionService };
