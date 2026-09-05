/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { captureQueueEnrichmentPayload } from './queueEnrichmentPayload.mjs';
import { resolveQueueTmdbExternalIdentity } from './queueTmdbExternalResolution.mjs';
import { buildTmdbTitleRequest, decideTmdbTitleMatch } from './tmdbTitleMatch.mjs';

function recordResolution(data, method, reason, tmdbId) {
    if (data) data.tmdb_resolution = {
        version: 1, status: tmdbId ? 'resolved' : 'review_required', method, reason,
    };
}

export class QueueTmdbResolutionService {
    constructor(deps = {}) {
        this.logger = deps.logger;
        this.tmdbService = deps.tmdbService;
        this.queryWithTimeout = deps.queryWithTimeout || (async () => ({}));
    }

    async resolveFromTvdb(payload) {
        payload = captureQueueEnrichmentPayload(payload);
        if (!payload || payload.media.media_type !== 'tv') return null;
        const result = await resolveQueueTmdbExternalIdentity({ ...payload, imdb_id: null }, {}, this.tmdbService);
        return result.tmdbId;
    }

    async resolveFromImdb(payload, enrichmentData) {
        payload = captureQueueEnrichmentPayload(payload);
        if (!payload) return null;
        const result = await resolveQueueTmdbExternalIdentity({ ...payload, tvdb_id: null }, enrichmentData, this.tmdbService);
        return result.tmdbId;
    }

    async resolveFromTitle(payload, enrichmentData) {
        payload = captureQueueEnrichmentPayload(payload);
        const request = buildTmdbTitleRequest(payload?.title, payload?.media?.media_type, payload?.year);
        if (!request) {
            recordResolution(enrichmentData, 'title', payload?.year == null || payload.year === '' ? 'missing_year' : 'invalid_request', null);
            return null;
        }

        try {
            const response = await this.tmdbService.searchIdentityCandidates(request.title, request.mediaType, request.year);
            const decision = decideTmdbTitleMatch(request, response);
            recordResolution(enrichmentData, 'title', decision.reason, decision.tmdbId);
            this.logger.debug('TMDB title resolution evaluated', { reason: decision.reason });
            return decision.tmdbId;
        } catch {
            recordResolution(enrichmentData, 'title', 'provider_unavailable', null);
            this.logger.debug('TMDB title resolution unavailable', { reason: 'provider_unavailable' });
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
        if (tmdbId) recordResolution(enrichmentData, 'existing_id', 'identifier_available', tmdbId);

        if (!tmdbId) {
            const decision = await resolveQueueTmdbExternalIdentity(payload, enrichmentData, this.tmdbService);
            if (decision.status !== 'not_found') {
                recordResolution(enrichmentData, decision.method, decision.reason, decision.tmdbId);
                this.logger.debug('TMDB external identity evaluated', { reason: decision.reason });
            }
            if (decision.status === 'review_required') return null;
            tmdbId = decision.tmdbId;
        }

        if (!tmdbId) {
            tmdbId = await this.resolveFromTitle(payload, enrichmentData);
        }

        if (tmdbId) {
            await this.backfillTmdbId(payload.itemId, tmdbId, payload.media.media_type);
        }

        return tmdbId;
    }
}
