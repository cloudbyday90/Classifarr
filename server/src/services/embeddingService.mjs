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
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

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

    safeGet(obj, path, defaultValue = null) {
        if (!obj) return defaultValue;

        const keys = path.split('.');
        let result = obj;

        for (const key of keys) {
            if (result === null || result === undefined || typeof result !== 'object') {
                return defaultValue;
            }
            result = result[key];
        }

        return result !== undefined ? result : defaultValue;
    }

    extractNames(items, limit = 3) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        return items
            .slice(0, limit)
            .map(item => {
                if (typeof item === 'string') {
                    return item;
                }
                if (item && typeof item === 'object') {
                    return item.name || item.title || null;
                }
                return null;
            })
            .filter(Boolean);
    }

    formatForEmbedding(metadata) {
        const parts = [];

        if (metadata.title) {
            parts.push(`Title: ${metadata.title}`);
        }
        if (metadata.year) {
            parts.push(`Year: ${metadata.year}`);
        }

        if (metadata.media_type) {
            const typeLabel = metadata.media_type === 'movie' ? 'Movie' : 'TV Series';
            parts.push(`Type: ${typeLabel}`);
        }

        const genreNames = normalizeMetadataList(metadata.genres).slice(0, 5);
        if (genreNames.length > 0) {
            parts.push(`Genres: ${genreNames.join(', ')}`);
        }

        const certification = this.safeGet(metadata, 'certification') ||
            this.safeGet(metadata, 'content_rating');
        if (certification) {
            parts.push(`Rating: ${certification}`);
        }

        if (metadata.original_language) {
            parts.push(`Language: ${metadata.original_language}`);
        }

        const studios = this.safeGet(metadata, 'production_companies', []);
        if (studios && studios.length > 0) {
            const studioNames = this.extractNames(studios, 3);
            if (studioNames.length > 0) {
                parts.push(`Studio: ${studioNames.join(', ')}`);
            }
        }

        const collection = this.safeGet(metadata, 'belongs_to_collection');
        if (collection) {
            const franchiseName = typeof collection === 'object'
                ? collection.name
                : collection;
            if (franchiseName) {
                parts.push(`Franchise: ${franchiseName}`);
            }
        }

        const cast = this.safeGet(metadata, 'cast', []);
        if (cast && cast.length > 0) {
            const castNames = this.extractNames(cast, 3);
            if (castNames.length > 0) {
                parts.push(`Cast: ${castNames.join(', ')}`);
            }
        }

        const keywordNames = normalizeMetadataList(metadata.keywords).slice(0, 8);
        if (keywordNames.length > 0) {
            parts.push(`Keywords: ${keywordNames.join(', ')}`);
        }

        const voteAverage = this.safeGet(metadata, 'vote_average');
        if (voteAverage !== null && voteAverage !== undefined && !isNaN(parseFloat(voteAverage))) {
            parts.push(`Score: ${parseFloat(voteAverage).toFixed(1)}/10`);
        }

        if (metadata.library_name) {
            parts.push(`Classified: ${metadata.library_name}`);
        }

        if (metadata.overview) {
            const truncatedOverview = metadata.overview.length > 300
                ? metadata.overview.slice(0, 300) + '...'
                : metadata.overview;
            parts.push(`Synopsis: ${truncatedOverview}`);
        }

        return parts.join(' | ').trim();
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
        if (!imageResult || !Array.isArray(imageResult.embedding)) {
            return null;
        }

        const vectorString = `[${imageResult.embedding.join(',')}]`;

        try {
            await db.query(`
                UPDATE classification_embeddings
                SET image_embedding = $2::vector,
                    image_embedding_dims = $3,
                    image_provider = $4,
                    image_model = $5,
                    image_embedding_hash = $6,
                    image_embedding_size = $7,
                    image_embedding_source_url = $8,
                    updated_at = NOW()
                WHERE classification_id = $1
            `, [
                classificationId,
                vectorString,
                imageResult.dims,
                imageResult.provider,
                imageResult.model,
                imageHash || null,
                imageSize || imageResult.size || null,
                posterUrl || null
            ]);

            return {
                classificationId,
                dims: imageResult.dims,
                provider: imageResult.provider
            };
        } catch (error) {
            const isDimensionMismatch =
                (error.message.includes('expected') && error.message.includes('dimensions')) ||
                (error.message.includes('different') && error.message.includes('vector') && error.message.includes('dimensions'));

            if (isDimensionMismatch) {
                const targetDims = imageResult.dims;
                logger.warn(`Image embedding dimension mismatch detected (Target: ${targetDims}). Auto-healing image vector schema...`);

                try {
                    await db.withTransaction(async (client) => {
                        await client.query('DROP INDEX IF EXISTS idx_embeddings_image_hnsw');
                        await client.query('DROP INDEX IF EXISTS idx_embeddings_image_present');
                        await client.query('DROP INDEX IF EXISTS idx_embeddings_image_hash');
                        await client.query('ALTER TABLE classification_embeddings DROP COLUMN image_embedding');
                        await client.query(`ALTER TABLE classification_embeddings ADD COLUMN image_embedding vector(${targetDims})`); // sql-interpolation: DDL vector dimension — cannot use $N in ALTER TABLE
                    });

                    await db.query(
                        `INSERT INTO task_queue (task_type, payload, priority, source, max_attempts)
                         VALUES ('rebuild_hnsw_index', $1::jsonb, 5, 'system', 3)`,
                        [JSON.stringify({ reason: 'image_dimension_mismatch', targetDims })]
                    );
                    await persistRagAuditLog({
                        client: db,
                        logger,
                        type: 'system',
                        message: `Image embedding dimension mismatch auto-healed to vector(${targetDims}); cleared stored image embeddings and queued HNSW rebuild.`,
                    });

                    logger.info(`Image vector schema auto-healed to vector(${targetDims}). HNSW index rebuild queued as background task.`);

                    await db.query(`
                        UPDATE classification_embeddings
                        SET image_embedding = $2::vector,
                            image_embedding_dims = $3,
                            image_provider = $4,
                            image_model = $5,
                            image_embedding_hash = $6,
                            image_embedding_size = $7,
                            image_embedding_source_url = $8,
                            updated_at = NOW()
                        WHERE classification_id = $1
                    `, [
                        classificationId,
                        vectorString,
                        imageResult.dims,
                        imageResult.provider,
                        imageResult.model,
                        imageHash || null,
                        imageSize || imageResult.size || null,
                        posterUrl || null
                    ]);

                    return {
                        classificationId,
                        dims: imageResult.dims,
                        provider: imageResult.provider
                    };
                } catch (healError) {
                    logger.error('Failed to auto-heal image embedding schema', {
                        classificationId,
                        error: healError.message
                    });
                    return null;
                }
            }

            logger.error('Failed to store image embedding', { classificationId, error: error.message });
            return null;
        }
    }

    async storeEmbedding(classificationId, embeddingResult) {
        try {
            const vectorString = `[${embeddingResult.embedding.join(',')}]`;

            const result = await db.query(`
                INSERT INTO classification_embeddings
                (classification_id, embedding, embedding_dims, provider, model)
                VALUES ($1, $2::vector, $3, $4, $5)
                ON CONFLICT (classification_id)
                DO UPDATE SET
                    embedding = $2::vector,
                    embedding_dims = $3,
                    provider = $4,
                    model = $5,
                    is_stale = false,
                    updated_at = NOW()
                RETURNING id
            `, [
                classificationId,
                vectorString,
                embeddingResult.dims,
                embeddingResult.provider,
                embeddingResult.model
            ]);

            return {
                id: result.rows[0].id,
                dims: embeddingResult.dims,
                provider: embeddingResult.provider
            };
        } catch (error) {
            const isDimensionMismatch =
                (error.message.includes('expected') && error.message.includes('dimensions')) ||
                (error.message.includes('different') && error.message.includes('vector') && error.message.includes('dimensions'));

            if (isDimensionMismatch) {
                const targetDims = embeddingResult.dims;
                logger.warn(`Dimension mismatch detected (Target: ${targetDims}). Auto-healing database schema...`);

                try {
                    await db.withTransaction(async (client) => {
                        await client.query('TRUNCATE TABLE classification_embeddings');
                        await client.query('ALTER TABLE classification_embeddings DROP COLUMN embedding');
                        await client.query(`ALTER TABLE classification_embeddings ADD COLUMN embedding vector(${targetDims})`); // sql-interpolation: DDL vector dimension — cannot use $N in ALTER TABLE
                    });
                    await persistRagAuditLog({
                        client: db,
                        logger,
                        type: 'system',
                        message: `Text embedding dimension mismatch auto-healed to vector(${targetDims}); cleared classification_embeddings for rebuild.`,
                    });

                    logger.info(`Schema auto-healed to vector(${targetDims}). Retrying storage...`);

                    const vectorString = `[${embeddingResult.embedding.join(',')}]`;
                    const retryResult = await db.query(`
                        INSERT INTO classification_embeddings
                        (classification_id, embedding, embedding_dims, provider, model)
                        VALUES ($1, $2::vector, $3, $4, $5)
                        RETURNING id
                    `, [
                        classificationId,
                        vectorString,
                        embeddingResult.dims,
                        embeddingResult.provider,
                        embeddingResult.model
                    ]);

                    return {
                        id: retryResult.rows[0].id,
                        dims: embeddingResult.dims,
                        provider: embeddingResult.provider
                    };

                } catch (healingError) {
                    logger.error('Failed to auto-heal database schema', { error: healingError.message });
                    throw error;
                }
            }

            logger.error('Failed to store embedding', { error: error.message });
            throw error;
        }
    }

    async markStale(oldProvider = null, oldModel = null) {
        try {
            let query = 'UPDATE classification_embeddings SET is_stale = true';
            const params = [];

            if (oldProvider) {
                query += ' WHERE provider = $1';
                params.push(oldProvider);

                if (oldModel) {
                    query += ' AND model = $2';
                    params.push(oldModel);
                }
            }

            const result = await db.query(query, params);
            logger.info('Marked embeddings as stale', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            logger.error('Failed to mark embeddings stale', { error: error.message });
            throw error;
        }
    }

    async getStats() {
        try {
            const result = await db.query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_stale = true) as stale,
                    COUNT(DISTINCT provider) as providers,
                    AVG(embedding_dims) as avg_dims
                FROM classification_embeddings
            `);

            const stats = result.rows[0];
            const includeImage = await this.shouldIncludeImageEmbeddings();
            const actualPending = await this.getPendingCount({ includeImage });

            return {
                total: parseInt(stats.total) || 0,
                totalEmbeddings: parseInt(stats.total) || 0,
                stale: parseInt(stats.stale) || 0,
                providers: parseInt(stats.providers) || 0,
                avgDims: Math.round(parseFloat(stats.avg_dims)) || 0,
                pendingRetries: 0,
                pendingCount: actualPending
            };
        } catch (error) {
            logger.error('Failed to get embedding stats', { error: error.message });
            return null;
        }
    }

    async getImageStats() {
        try {
            const posterCondition = "NULLIF(COALESCE(ch.metadata->>'poster_path', ch.metadata->>'posterPath', msi.metadata->>'posterPath', msi.metadata->>'poster_path'), '') IS NOT NULL";
            const result = await db.query(`
                SELECT
                    COUNT(*) FILTER (WHERE ce.image_embedding IS NOT NULL) as total,
                    COUNT(*) FILTER (
                        WHERE ce.image_embedding IS NULL
                        AND ${posterCondition}
                    ) as pending
                FROM classification_history ch
                LEFT JOIN classification_embeddings ce ON ce.classification_id = ch.id
                LEFT JOIN media_server_items msi
                  ON msi.tmdb_id = ch.tmdb_id
                 AND msi.media_type = ch.media_type
            `);

            return {
                total: parseInt(result.rows[0]?.total || 0),
                pending: parseInt(result.rows[0]?.pending || 0)
            };
        } catch (error) {
            logger.error('Failed to get image embedding stats', { error: error.message });
            return { total: 0, pending: 0 };
        }
    }

    async getPendingCount({ includeText = true, includeImage = false } = {}) {
        try {
            const posterCondition = "NULLIF(COALESCE(ch.metadata->>'poster_path', ch.metadata->>'posterPath', msi.metadata->>'posterPath', msi.metadata->>'poster_path'), '') IS NOT NULL";
            const filters = [];

            if (includeText) {
                filters.push('ce.id IS NULL');
            }

            if (includeImage) {
                filters.push(`(ce.id IS NOT NULL AND ce.image_embedding IS NULL AND ${posterCondition})`);
            }

            if (filters.length === 0) {
                return 0;
            }

            const whereClause = filters.join(' OR ');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM classification_history ch
                LEFT JOIN classification_embeddings ce ON ce.classification_id = ch.id
                LEFT JOIN media_server_items msi
                  ON msi.tmdb_id = ch.tmdb_id
                 AND msi.media_type = ch.media_type
                WHERE ${whereClause}
            `);

            return parseInt(result.rows[0].count) || 0;
        } catch (error) {
            logger.error('Failed to get pending count', { error: error.message });
            return 0;
        }
    }

    async getPendingBreakdown() {
        try {
            const posterCondition = "NULLIF(COALESCE(ch.metadata->>'poster_path', ch.metadata->>'posterPath', msi.metadata->>'posterPath', msi.metadata->>'poster_path'), '') IS NOT NULL";
            const result = await db.query(`
                SELECT
                    COUNT(*) FILTER (WHERE ce.id IS NULL) AS pending_text,
                    COUNT(*) FILTER (
                        WHERE ce.id IS NOT NULL
                        AND ce.image_embedding IS NULL
                        AND ${posterCondition}
                    ) AS pending_image
                FROM classification_history ch
                LEFT JOIN classification_embeddings ce ON ce.classification_id = ch.id
                LEFT JOIN media_server_items msi
                  ON msi.tmdb_id = ch.tmdb_id
                 AND msi.media_type = ch.media_type
            `);

            const pendingText = parseInt(result.rows[0]?.pending_text || 0);
            const pendingImage = parseInt(result.rows[0]?.pending_image || 0);
            return {
                text: pendingText,
                image: pendingImage,
                total: pendingText + pendingImage
            };
        } catch (error) {
            logger.error('Failed to get pending breakdown', { error: error.message });
            return { text: 0, image: 0, total: 0 };
        }
    }

    async getPendingEmbeddings({ limit = 10, includeText = true, includeImage = false } = {}) {
        try {
            const posterCondition = "NULLIF(COALESCE(ch.metadata->>'poster_path', ch.metadata->>'posterPath', msi.metadata->>'posterPath', msi.metadata->>'poster_path'), '') IS NOT NULL";
            const needsTextExpr = includeText
                ? '(ce.id IS NULL)'
                : 'false';
            const needsImageExpr = includeImage
                ? `(ce.id IS NOT NULL AND ce.image_embedding IS NULL AND ${posterCondition})`
                : 'false';
            const filters = [];

            if (includeText) {
                filters.push('ce.id IS NULL');
            }

            if (includeImage) {
                filters.push(`(ce.id IS NOT NULL AND ce.image_embedding IS NULL AND ${posterCondition})`);
            }

            if (filters.length === 0) {
                return [];
            }

            const whereClause = filters.join(' OR ');

            const result = await db.query(`
                SELECT
                    ch.id,
                    ch.title,
                    ch.media_type,
                    ch.library_name,
                    ch.metadata,
                    ${needsTextExpr} AS needs_text,
                    ${needsImageExpr} AS needs_image
                FROM classification_history ch
                LEFT JOIN classification_embeddings ce ON ce.classification_id = ch.id
                LEFT JOIN media_server_items msi
                  ON msi.tmdb_id = ch.tmdb_id
                 AND msi.media_type = ch.media_type
                WHERE ${whereClause}
                ORDER BY ch.created_at DESC
                LIMIT $1
            `, [limit]);

            return result.rows.map(row => ({
                id: row.id,
                title: row.title,
                media_type: row.media_type,
                library_name: row.library_name,
                needsText: row.needs_text === true,
                needsImage: row.needs_image === true,
                metadata: typeof row.metadata === 'string'
                    ? JSON.parse(row.metadata)
                    : row.metadata
            }));
        } catch (error) {
            logger.error('Failed to get pending embeddings', { error: error.message });
            return [];
        }
    }

    async hasMinimumEmbeddings() {
        try {
            const config = await embeddingRouter.getConfig();
            const minCount = config?.rag_min_history_count || 50;

            const result = await db.query(
                'SELECT COUNT(*) as count FROM classification_embeddings WHERE is_stale = false'
            );

            return parseInt(result.rows[0].count) >= minCount;
        } catch (_error) {
            return false;
        }
    }
}

export const embeddingService = new EmbeddingService();
