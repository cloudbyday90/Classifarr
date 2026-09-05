/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { buildInventoryTmdbObservation, inventoryTmdbObservationDue } from './inventoryTmdbObservation.mjs';

export class QueueInventoryTmdbEnrichmentService {
    constructor({ tmdbService, logger, now = Date.now } = {}) {
        this.tmdbService = tmdbService;
        this.logger = logger;
        this.now = now;
    }

    async enrich(payload, enrichmentData, tmdbId) {
        const mediaType = canonicalMediaType(payload?.media?.media_type);
        tmdbId = positiveDatabaseInteger(tmdbId);
        if (!tmdbId || !mediaType || !inventoryTmdbObservationDue(payload, tmdbId, this.now())) return false;
        try {
            if (!await this.tmdbService.getApiKey()) return false;
            const details = mediaType === 'movie' ? await this.tmdbService.getMovieDetails(tmdbId)
                : await this.tmdbService.getTVDetails(tmdbId);
            const observation = buildInventoryTmdbObservation(details, tmdbId, mediaType, new Date(this.now()).toISOString());
            if (observation) enrichmentData.inventory_tmdb = observation;
            else this.logger.warn('Inventory TMDb observation unavailable', { reason: 'invalid_provider_observation' });
        } catch {
            this.logger.warn('Inventory TMDb observation unavailable', { reason: 'provider_unavailable' });
        }
        return true;
    }
}
