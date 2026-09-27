/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { buildInventoryTmdbObservation, inventoryTmdbObservationDue } from './inventoryTmdbObservation.mjs';
import { tmdbObservationFailure } from './tmdbObservationFailure.mjs';
import { SOURCE_CONFLICT_AUTHORITY_BLOCK_REASON } from './sourceConflictAuthorityGuard.mjs';
import { claimInventoryProviderRecovery } from './inventoryProviderRecoveryPersistence.mjs';
import { nextInventoryProviderRecovery } from './inventoryProviderRecoveryPolicy.mjs';

export class QueueInventoryTmdbEnrichmentService {
    constructor({ tmdbService, logger, now = Date.now } = {}) {
        this.tmdbService = tmdbService;
        this.logger = logger;
        this.now = now;
    }

    async enrich(payload, enrichmentData, tmdbId, context = {}) {
        if (payload?.source_conflict_blocks_authority === true) {
            this.logger?.debug?.('Inventory TMDb observation skipped', { reason: SOURCE_CONFLICT_AUTHORITY_BLOCK_REASON });
            return false;
        }
        const mediaType = canonicalMediaType(payload?.media?.media_type);
        tmdbId = positiveDatabaseInteger(tmdbId);
        if (!tmdbId || !mediaType || !inventoryTmdbObservationDue(payload, tmdbId, this.now(), { requireCompanies: true })) return false;
        if (!await this.tmdbService.getApiKey()) return false;
        let claim = null;
        if (payload.itemId) {
            if (typeof context.query !== 'function' || !context.receipt) return false;
            claim = await claimInventoryProviderRecovery(context.query, payload, tmdbId);
            if (!claim) return false;
            context.receipt.token = claim.token;
        }
        let failure = null;
        try {
            const details = mediaType === 'movie' ? await this.tmdbService.getMovieDetails(tmdbId)
                : await this.tmdbService.getTVDetails(tmdbId);
            const observation = buildInventoryTmdbObservation(details, tmdbId, mediaType, new Date(this.now()).toISOString());
            if (observation) enrichmentData.inventory_tmdb = observation;
            else {
                failure = { category: 'invalid_response' };
                if (!claim) this.logger?.warn?.('Inventory TMDb observation unavailable', { reason: 'invalid_provider_observation', mediaType, tmdbId });
            }
        } catch (error) {
            failure = tmdbObservationFailure(error);
            if (!claim) this.logger?.warn?.('Inventory TMDb observation unavailable', {
                reason: failure.category === 'not_found' ? 'identity_not_found' : 'provider_unavailable',
                ...failure, mediaType, tmdbId,
            });
        }
        if (claim) context.receipt.outcome = nextInventoryProviderRecovery({ previous: claim.previous,
            tmdbId, mediaType, failure, now: this.now() });
        return true;
    }
}
