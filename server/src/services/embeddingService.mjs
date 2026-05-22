/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createHash } from 'node:crypto';
import * as db from '../config/database.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { imageEmbeddingProvider } from './imageEmbeddingProvider.mjs';
import { embeddingAvailabilityService } from './embeddingAvailabilityService.mjs';
import { persistRagAuditLog } from './ragAuditLogService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { getStats as getStatsFn, getImageStats as getImageStatsFn, getPendingCount as getPendingCountFn, getPendingBreakdown as getPendingBreakdownFn, getPendingEmbeddings as getPendingEmbeddingsFn, hasMinimumEmbeddings as hasMinimumEmbeddingsFn } from './embeddingServiceQueries.mjs';
import { formatForEmbedding as formatForEmbeddingFn, safeGet as safeGetFn, extractNames as extractNamesFn } from './embeddingServiceFormatters.mjs';
import { storeImageEmbedding as storeImageEmbeddingFn, storeEmbedding as storeEmbeddingFn, markStale as markStaleFn } from './embeddingServiceStorage.mjs';

const logger = createLogger('EmbeddingService');

class EmbeddingService {
    constructor() {
        this.EMBEDDING_FORMAT_VERSION = 2;
    }

    getProviderAvailabilityStatus(options = {}) {
        if (options.refresh === true) {
            return embeddingAvailabilityService.getStatusFresh();
        }
        return embeddingAvailabilityService.getStatus();
    }

    resetProviderAvailability() {
        return embeddingAvailabilityService.resetAvailability();
    }

    createProviderOfflineError(status = embeddingAvailabilityService.getStatus()) {
        const error = new Error('PROVIDER_OFFLINE');
        error.code = 'EMBEDDING_PROVIDER_OFFLINE';
        error.cooldownUntil = status.cooldownUntil || null;
        error.lastError = status.lastError || null;
        return error;
    }

    createProviderBusyError(upstreamError = null) {
        const error = new Error('PROVIDER_BUSY');
        error.code = 'EMBEDDING_PROVIDER_BUSY';
        error.lockHolder = upstreamError?.lockHolder || upstreamError?.lockedBy || null;
        error.waitMs = Number.isFinite(Number(upstreamError?.waitMs)) ? Number(upstreamError.waitMs) : null;
        error.activeModel = upstreamError?.activeModel || null;
        error.preemptRequested = upstreamError?.preemptRequested === true;
        error.lastError = upstreamError?.message || null;
        return error;
    }

    isProviderBusyError(error) {
        const message = error?.message || '';
        return error?.code === 'EMBEDDING_PROVIDER_BUSY' ||
            error?.code === 'PROVIDER_LOCK_TIMEOUT' ||
            message === 'PROVIDER_BUSY' ||
            message.includes('[ProviderLock] Timeout waiting for lock');
    }

    isProviderConnectionError(error) {
        const message = error?.message || '';
        const code = error?.code || '';

        return code === 'EMBEDDING_CIRCUIT_OPEN' ||
            code === 'EMBEDDING_PROVIDER_OFFLINE' ||
            message.includes('PROVIDER_OFFLINE') ||
            message.includes('Circuit breaker is OPEN') ||
            message.includes('ECONNREFUSED') ||
            message.includes('ETIMEDOUT') ||
            message.includes('ENOTFOUND') ||
            message.includes('EHOSTUNREACH') ||
            message.includes('fetch failed') ||
            message.includes('Failed to fetch models');
    }

    async markProviderOffline(error, { source = 'embedding' } = {}) {
        return await embeddingAvailabilityService.markUnavailable(error, { source });
    }

    async probeProviderRecovery() {
        return await embeddingAvailabilityService.runRecoveryProbe(async () => await embeddingRouter.testConnection());
    }

    async ensureProviderAvailable() {
        const status = await this.getProviderAvailabilityStatus({ refresh: true });
        if (!status.isOffline) {
            return;
        }

        if (status.status === 'cooldown' || status.status === 'probing') {
            throw this.createProviderOfflineError(status);
        }

        const recovered = await this.probeProviderRecovery();
        if (!recovered) {
            throw this.createProviderOfflineError(await this.getProviderAvailabilityStatus({ refresh: true }));
        }
    }

    hashValue(value) {
        return createHash('sha256').update(value).digest('hex');
    }

    resolvePosterUrl(metadata) {
        const raw = metadata?.poster_path || metadata?.posterPath;
        if (!raw) return null;
        if (/^https?:\/\//i.test(raw)) return raw;
        return `https://image.tmdb.org/t/p/w500${raw}`;
    }

    async resolvePosterUrlForClassification(classificationId, metadata) {
        const direct = this.resolvePosterUrl(metadata);
        if (direct) return direct;
        if (!classificationId) return null;

        try {
            const result = await db.query(`
                SELECT msi.metadata->>'posterPath' AS poster_path
                FROM classification_history ch
                JOIN media_server_items msi
                  ON msi.tmdb_id = ch.tmdb_id
                 AND msi.media_type = ch.media_type
                WHERE ch.id = $1
                ORDER BY msi.last_synced DESC
                LIMIT 1
            `, [classificationId]);

            const posterPath = result.rows[0]?.poster_path;
            if (posterPath) {
                return posterPath;
            }
        } catch (error) {
            logger.debug('Failed to resolve poster URL from media server cache', {
                classificationId,
                error: error.message
            });
        }

        return null;
    }

    async getExistingImageEmbeddingMeta(classificationId) {
        try {
            const result = await db.query(`
                SELECT
                    image_embedding_hash,
                    image_model,
                    image_embedding_size,
                    image_embedding IS NOT NULL AS has_image
                FROM classification_embeddings
                WHERE classification_id = $1
            `, [classificationId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.warn('Failed to load existing image embedding metadata', {
                classificationId,
                error: error.message
            });
            return null;
        }
    }

    shouldReuseImageEmbedding(existing, imageHash, imageModel, imageSize) {
        if (!existing || !existing.has_image) {
            return false;
        }

        return (
            existing.image_embedding_hash === imageHash &&
            existing.image_model === imageModel &&
            Number(existing.image_embedding_size) === Number(imageSize)
        );
    }

    async shouldIncludeImageEmbeddings(config = null) {
        const resolvedConfig = config || await imageEmbeddingProvider.getConfig();
        if (!resolvedConfig) {
            return false;
        }

        const weight = Number(resolvedConfig.rag_image_weight ?? 0);
        if (!Number.isFinite(weight) || weight <= 0) {
            return false;
        }

        return imageEmbeddingProvider.isConfigured(resolvedConfig);
    }

    async checkEmbeddingVersionMismatch() {
        try {
            const config = await embeddingRouter.getConfig();
            const configVersion = config?.embedding_format_version || 1;

            return configVersion !== this.EMBEDDING_FORMAT_VERSION;
        } catch (error) {
            logger.warn('Failed to check embedding version mismatch', { error: error.message });
            return false;
        }
    }

    async generateAndStore(classificationId, metadata) {
        try {
            const ragEnabled = await embeddingRouter.isEnabled();
            if (!ragEnabled) {
                logger.debug('RAG disabled; skipping embedding generation', { classificationId });
                return null;
            }

            await this.ensureProviderAvailable();

            const text = this.formatForEmbedding(metadata);

            if (!text || text.length < 10) {
                logger.warn('Text too short for embedding', { classificationId, textLength: text?.length });
                throw new Error('Text too short for embedding');
            }

            const result = await embeddingRouter.embed(text);

            const availability = this.getProviderAvailabilityStatus();
            if (availability.isOffline) {
                await this.resetProviderAvailability();
            }

            const stored = await this.storeEmbedding(classificationId, result);

            try {
                await this.generateImageEmbedding(classificationId, metadata);
            } catch (imageError) {
                if (imageError.message === 'PROVIDER_OFFLINE') {
                    throw imageError;
                }
                logger.warn('Image embedding failed', {
                    classificationId,
                    error: imageError.message
                });
            }

            logger.info('Embedding generated and stored', {
                classificationId,
                dims: result.dims,
                provider: result.provider,
                cost: result.cost
            });

            return stored;
        } catch (error) {
            if (this.isProviderConnectionError(error)) {
                if (error.code !== 'EMBEDDING_PROVIDER_OFFLINE') {
                    await this.markProviderOffline(error, { source: 'generateAndStore' });
                }

                throw this.createProviderOfflineError(this.getProviderAvailabilityStatus());
            }

            if (this.isProviderBusyError(error)) {
                logger.warn('Embedding generation deferred: provider busy', {
                    classificationId,
                    error: error.message,
                    lockHolder: error.lockHolder || error.lockedBy || null,
                    waitMs: Number.isFinite(Number(error.waitMs)) ? Number(error.waitMs) : null,
                    activeModel: error.activeModel || null
                }, { error });

                throw this.createProviderBusyError(error);
            }

            if (error.isConfigurationError || error.name === 'ConfigurationError') {
                logger.debug('Text embedding provider not configured; skipping text embedding', {
                    classificationId
                });
                try {
                    await this.generateImageEmbedding(classificationId, metadata);
                } catch (imageError) {
                    if (imageError.message === 'PROVIDER_OFFLINE') {
                        throw imageError;
                    }
                    logger.warn('Image embedding failed', {
                        classificationId,
                        error: imageError.message
                    });
                }
                return null;
            }

            logger.error('Failed to generate embedding', {
                classificationId,
                error: error.message
            }, { error });

            return null;
        }
    }

    async generateImageEmbedding(classificationId, metadata) {
        const posterUrl = await this.resolvePosterUrlForClassification(classificationId, metadata);
        if (!posterUrl) {
            return null;
        }

        const imageConfig = await imageEmbeddingProvider.getConfig();
        const includeImage = await this.shouldIncludeImageEmbeddings(imageConfig);
        if (!includeImage) {
            return null;
        }

        const imageModel = imageEmbeddingProvider.getEffectiveModel(imageConfig);
        const imageSize = imageEmbeddingProvider.getEffectiveSize(imageConfig);
        const imageHash = this.hashValue(posterUrl);
        const existingImage = await this.getExistingImageEmbeddingMeta(classificationId);

        if (this.shouldReuseImageEmbedding(existingImage, imageHash, imageModel, imageSize)) {
            logger.debug('Reusing cached image embedding', { classificationId });
            return { reused: true };
        }

        try {
            const imageResult = await imageEmbeddingProvider.embedImageFromUrl(posterUrl);
            return await this.storeImageEmbedding(classificationId, imageResult, {
                imageHash,
                imageSize,
                posterUrl
            });
        } catch (error) {
            const isConnectionError = error.message.includes('ECONNREFUSED') ||
                error.message.includes('ETIMEDOUT') ||
                error.message.includes('fetch failed');

            const isCircuitOpen = error.code === 'CIRCUIT_OPEN' ||
                error.code === 'EMBEDDING_CIRCUIT_OPEN';

            if (isConnectionError || isCircuitOpen) {
                throw new Error('PROVIDER_OFFLINE');
            }

            throw error;
        }
    }

    async storeImageEmbedding(classificationId, imageResult, { imageHash, imageSize, posterUrl } = {}) {
        return storeImageEmbeddingFn({ db, logger, persistRagAuditLog }, classificationId, imageResult, { imageHash, imageSize, posterUrl });
    }

    async storeEmbedding(classificationId, embeddingResult) {
        return storeEmbeddingFn({ db, logger, persistRagAuditLog }, classificationId, embeddingResult);
    }

    async markStale(oldProvider = null, oldModel = null) {
        return markStaleFn({ db, logger }, oldProvider, oldModel);
    }

    async getStats() {
        return getStatsFn({ db, logger }, () => this.shouldIncludeImageEmbeddings());
    }

    async getImageStats() {
        return getImageStatsFn({ db, logger });
    }

    async getPendingCount(opts) {
        return getPendingCountFn({ db, logger }, opts);
    }

    async getPendingBreakdown() {
        return getPendingBreakdownFn({ db, logger });
    }

    async getPendingEmbeddings(opts) {
        return getPendingEmbeddingsFn({ db, logger }, opts);
    }

    async hasMinimumEmbeddings() {
        return hasMinimumEmbeddingsFn({ db, embeddingRouter });
    }

    formatForEmbedding(metadata) {
        return formatForEmbeddingFn(metadata);
    }

    safeGet(obj, path, defaultValue) {
        return safeGetFn(obj, path, defaultValue);
    }

    extractNames(items, limit) {
        return extractNamesFn(items, limit);
    }
}

export const embeddingService = new EmbeddingService();
