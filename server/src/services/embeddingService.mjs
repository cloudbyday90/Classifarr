/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as db from '../config/database.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { imageEmbeddingProvider } from './imageEmbeddingProvider.mjs';
import { embeddingAvailabilityService } from './embeddingAvailabilityService.mjs';
import { persistRagAuditLog } from './ragAuditLogService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { getStats as getStatsFn, getImageStats as getImageStatsFn, getPendingCount as getPendingCountFn, getPendingBreakdown as getPendingBreakdownFn, getPendingEmbeddings as getPendingEmbeddingsFn, hasMinimumEmbeddings as hasMinimumEmbeddingsFn } from './embeddingServiceQueries.mjs';
import { formatForEmbedding as formatForEmbeddingFn, safeGet as safeGetFn, extractNames as extractNamesFn } from './embeddingServiceFormatters.mjs';
import { storeImageEmbedding as storeImageEmbeddingFn, storeEmbedding as storeEmbeddingFn, markStale as markStaleFn } from './embeddingServiceStorage.mjs';
import { createProviderOfflineError as _createProviderOfflineError, createProviderBusyError as _createProviderBusyError, isProviderBusyError as _isProviderBusyError, isProviderConnectionError as _isProviderConnectionError } from './embeddingServiceErrors.mjs';
import { hashValue as _hashValue, resolvePosterUrl as _resolvePosterUrl, resolvePosterUrlForClassification as _resolvePosterUrlForClassification, getExistingImageEmbeddingMeta as _getExistingImageEmbeddingMeta, shouldReuseImageEmbedding as _shouldReuseImageEmbedding, shouldIncludeImageEmbeddings as _shouldIncludeImageEmbeddings, checkEmbeddingVersionMismatch as _checkEmbeddingVersionMismatch } from './embeddingServiceImage.mjs';

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
        return _createProviderOfflineError(status);
    }

    createProviderBusyError(upstreamError = null) {
        return _createProviderBusyError(upstreamError);
    }

    isProviderBusyError(error) {
        return _isProviderBusyError(error);
    }

    isProviderConnectionError(error) {
        return _isProviderConnectionError(error);
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
        return _hashValue(value);
    }

    resolvePosterUrl(metadata) {
        return _resolvePosterUrl(metadata);
    }

    async resolvePosterUrlForClassification(classificationId, metadata) {
        return _resolvePosterUrlForClassification(classificationId, metadata);
    }

    async getExistingImageEmbeddingMeta(classificationId) {
        return _getExistingImageEmbeddingMeta(classificationId);
    }

    shouldReuseImageEmbedding(existing, imageHash, imageModel, imageSize) {
        return _shouldReuseImageEmbedding(existing, imageHash, imageModel, imageSize);
    }

    async shouldIncludeImageEmbeddings(config = null) {
        return _shouldIncludeImageEmbeddings(config);
    }

    async checkEmbeddingVersionMismatch() {
        return _checkEmbeddingVersionMismatch(this.EMBEDDING_FORMAT_VERSION);
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
