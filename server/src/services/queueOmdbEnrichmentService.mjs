/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { enrichmentRetryService } from './enrichmentRetryService.mjs';
import { metadataProviderIntegrityService } from './metadataProviderIntegrityService.mjs';
import { captureQueueEnrichmentPayload } from './queueEnrichmentPayload.mjs';
import { omdbResultMatchesType } from './queueEnrichmentResults.mjs';
import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { persistOmdbRating } from './queueEnrichmentPersistence.mjs';

export class QueueOmdbEnrichmentService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.omdbService = deps.omdbService;
        this.queryWithTimeout = deps.queryWithTimeout || (async () => ({}));
        this.isOmdbSslBlocked = deps.isOmdbSslBlocked || (async () => false);
        this.getRuntimeState = deps.getRuntimeState || (() => ({
            omdbLimitHit: false,
            lastOmdbCircuitWarnAt: 0,
            lastOmdbSslWarnAt: 0,
        }));
        this.metadataProviderIntegrityService = deps.metadataProviderIntegrityService || metadataProviderIntegrityService;
        this.setRuntimeState = deps.setRuntimeState || (() => {});
        this.omdbCircuitWarnThrottleMs = deps.omdbCircuitWarnThrottleMs || 60_000;
        this.omdbSslWarnThrottleMs = deps.omdbSslWarnThrottleMs || 15 * 60 * 1000;
        this.omdbSslBlockMs = deps.omdbSslBlockMs || 15 * 60 * 1000;
    }

    async queueRetry(itemId, enrichmentType, reason, priority) {
        if (!itemId) {
            return;
        }

        try {
            await enrichmentRetryService.queueForRetry(itemId, enrichmentType, reason, priority);
        } catch (retryErr) {
            this.logger.debug('Failed to queue for retry', { error: retryErr.message });
        }
    }

    buildContentAnalysisPatch(omdbResult) {
        return {
            omdb_rated: omdbResult.rated,
            omdb_genre: omdbResult.genre,
            omdb_imdb_rating: omdbResult.imdbRating,
            is_animation: omdbResult.genre?.toLowerCase().includes('animation'),
            is_documentary: omdbResult.genre?.toLowerCase().includes('documentary'),
            is_family: omdbResult.genre?.toLowerCase().includes('family'),
            is_kids: ['G', 'TV-G', 'TV-Y', 'TV-Y7'].includes(omdbResult.rated),
            is_adult: ['R', 'NC-17', 'TV-MA'].includes(omdbResult.rated)
        };
    }

    async maybeBackfillRating(itemId, omdbResult, mediaType, source = null, tmdbId = undefined) {
        itemId = positiveDatabaseInteger(itemId);
        mediaType = canonicalMediaType(mediaType);
        const rated = omdbResult?.rated;
        if (!itemId || !mediaType || !omdbResultMatchesType(omdbResult, mediaType) ||
            typeof rated !== 'string' || !rated.trim() || rated.length > 20 || rated === 'N/A' ||
            tmdbId === undefined || (tmdbId !== null && !positiveDatabaseInteger(tmdbId))) {
            return;
        }

        try {
            const updated = await persistOmdbRating(
                this.queryWithTimeout, itemId, rated, mediaType, source, tmdbId);
            if (updated?.rowCount !== 1) return;

            this.logger.info('Rating updated from OMDb', {
                itemId,
                original: updated.rows?.[0]?.original_rating ?? null,
                omdb: rated
            });
        } catch (ratingError) {
            this.logger.debug('Failed to update rating from OMDb', { error: ratingError.message });
        }
    }

    async handleLimitReached(payload, error) {
        const runtimeState = this.getRuntimeState();
        if (!runtimeState.omdbLimitHit) {
            this.logger.warn('OMDb daily limit reached - skipping OMDb enrichment until API resets', {
                error: error.message
            });
            this.setRuntimeState({ omdbLimitHit: true });
        }

        await this.queueRetry(payload.itemId, 'web_search', 'OMDb limit reached', 3);
    }

    async handleSslError(payload, error) {
        const now = Date.now();
        this.setRuntimeState({
            omdbSslBlockedUntil: now + this.omdbSslBlockMs
        });

        const runtimeState = this.getRuntimeState();
        if ((now - runtimeState.lastOmdbSslWarnAt) >= this.omdbSslWarnThrottleMs) {
            this.setRuntimeState({ lastOmdbSslWarnAt: now });
            this.logger.warn('OMDb SSL certificate issue; queuing OMDb retry and pausing OMDb enrichment until recovery probe succeeds', {
                title: payload.title,
                code: error.code,
                error: error.message
            });
        } else {
            this.logger.debug('OMDb SSL certificate warning suppressed', {
                title: payload.title,
                code: error.code
            });
        }

        await this.queueRetry(payload.itemId, 'omdb', 'OMDb SSL certificate issue', 6);
    }

    async handleCircuitError(payload, error) {
        const isHalfOpenThrottled = error.code === 'CIRCUIT_BREAKER_HALF_OPEN_THROTTLED';
        if (isHalfOpenThrottled) {
            this.logger.debug('OMDb circuit breaker HALF_OPEN throttled request; queuing for OMDb retry', {
                title: payload.title,
                code: error.code
            });
        } else {
            const now = Date.now();
            const runtimeState = this.getRuntimeState();
            if ((now - runtimeState.lastOmdbCircuitWarnAt) >= this.omdbCircuitWarnThrottleMs) {
                this.setRuntimeState({ lastOmdbCircuitWarnAt: now });
                this.logger.warn('OMDb circuit breaker blocking enrichment; queuing for OMDb retry', {
                    title: payload.title,
                    code: error.code,
                    nextAttempt: error.nextAttempt ? new Date(error.nextAttempt).toISOString() : null
                });
            } else {
                this.logger.debug('OMDb circuit breaker block warning suppressed', {
                    title: payload.title,
                    code: error.code
                });
            }
        }

        await this.queueRetry(payload.itemId, 'omdb', `OMDb circuit breaker: ${error.code}`, 6);
    }

    async handleGenericError(payload, error) {
        this.metadataProviderIntegrityService.warnProviderRuntimeFailure({
            provider: 'omdb',
            category: 'queue_failure',
            message: 'OMDb enrichment failed; queuing for OMDb retry',
            metadata: {
                source: 'queue_enrichment',
                title: payload.title || null,
                code: error.code || null,
                error: error.message,
            },
            dedupeSignature: `${error.code || 'NO_CODE'}:${(error.message || 'unknown_error').toLowerCase()}`,
        });
        await this.queueRetry(
            payload.itemId,
            'omdb',
            `OMDb error: ${error.message?.substring(0, 100)}`,
            7
        );
    }

    async handleError(payload, error) {
        const isCircuitBlocked = error.code === 'CIRCUIT_BREAKER_OPEN' ||
            error.code === 'CIRCUIT_BREAKER_HALF_OPEN_THROTTLED' ||
            error.code === 'CIRCUIT_BREAKER_REJECTED';
        const omdbErrorMessage = (error.message || '').toLowerCase();
        const isSslCertificateError = Boolean(
            error.isOmdbSslCertError ||
            error.code === 'CERT_HAS_EXPIRED' ||
            error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
            error.code === 'CERT_NOT_YET_VALID' ||
            omdbErrorMessage.includes('certificate')
        );

        if (error.name === 'OMDbLimitReachedError' ||
            (error.message && error.message.includes('Limit Reached'))) {
            await this.handleLimitReached(payload, error);
            return;
        }

        if (isSslCertificateError) {
            await this.handleSslError(payload, error);
            return;
        }

        if (isCircuitBlocked) {
            await this.handleCircuitError(payload, error);
            return;
        }

        await this.handleGenericError(payload, error);
    }

    async enrich(payload, enrichmentData) {
        payload = captureQueueEnrichmentPayload(payload);
        if (!payload) {
            this.logger.warn('OMDb enrichment skipped', { reason: 'invalid_media_identity' });
            return enrichmentData;
        }
        const runtimeState = this.getRuntimeState();
        if (runtimeState.omdbLimitHit) {
            return enrichmentData;
        }

        try {
            const omdbConfig = await this.db.query('SELECT * FROM omdb_config WHERE is_active = true LIMIT 1');

            if (omdbConfig.rows.length === 0 || !omdbConfig.rows[0].api_key) {
                return enrichmentData;
            }

            const omdbApiKey = omdbConfig.rows[0].api_key;
            const mediaType = payload.media.media_type;

            this.logger.info('OMDb lookup', { title: payload.title, type: mediaType });

            const sslBlocked = await this.isOmdbSslBlocked(omdbApiKey, payload.title);
            if (sslBlocked) {
                await this.queueRetry(payload.itemId, 'omdb', 'OMDb SSL certificate issue', 6);
                return enrichmentData;
            }

            const omdbResult = await this.omdbService.getByTitle(
                payload.title,
                payload.year,
                mediaType,
                omdbApiKey
            );

            if (!omdbResult) {
                await this.queueRetry(payload.itemId, 'web_search', 'OMDb not found', 5);
                if (payload.itemId) {
                    this.logger.debug('Queued item for web-search fallback', { title: payload.title });
                }
                return enrichmentData;
            }

            if (!omdbResultMatchesType(omdbResult, mediaType)) {
                this.logger.warn('OMDb enrichment skipped', { reason: 'provider_type_mismatch' });
                return enrichmentData;
            }
            enrichmentData.omdb = {
                fetched_at: new Date().toISOString(),
                data: omdbResult
            };
            enrichmentData.content_analysis = {
                ...enrichmentData.content_analysis,
                ...this.buildContentAnalysisPatch(omdbResult)
            };

            this.logger.info('OMDb enrichment successful', {
                title: payload.title,
                rated: omdbResult.rated,
                genre: omdbResult.genre
            });

            await this.maybeBackfillRating(payload.itemId, omdbResult, mediaType,
                payload.source_identity_snapshot, payload.tmdb_id);

            return enrichmentData;
        } catch (error) {
            await this.handleError(payload, error);
            return enrichmentData;
        }
    }
}
