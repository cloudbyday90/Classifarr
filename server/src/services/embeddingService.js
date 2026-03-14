/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const crypto = require('crypto');
const db = require('../config/database');
const embeddingRouter = require('./embeddingRouter');
const imageEmbeddingProvider = require('./imageEmbeddingProvider');
const { createLogger } = require('../utils/logger');
const { normalizeMetadataList } = require('../utils/metadataNormalization');

const logger = createLogger('EmbeddingService');

/**
 * Embedding Service
 * Handles generating, storing, and managing embeddings for classifications
 */
class EmbeddingService {
    constructor() {
        // Embedding format version for migration tracking
        this.EMBEDDING_FORMAT_VERSION = 2;
        this.isProviderOffline = false;
    }

    hashValue(value) {
        return crypto.createHash('sha256').update(value).digest('hex');
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

    /**
     * Safe get for nested object properties
     * @param {object} obj - Object to access
     * @param {string} path - Dot-separated path (e.g., 'metadata.studio')
     * @param {*} defaultValue - Default value if path doesn't exist
     */
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

    /**
     * Extract names from array of objects or strings
     * @param {Array} items - Array of items
     * @param {number} limit - Max items to extract
     * @returns {Array<string>} Array of names
     */
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

    /**
     * Format metadata into text suitable for embedding (v2 with rich context)
     * @param {object} metadata - Classification metadata
     * @returns {string} Formatted text for embedding
     */
    formatForEmbedding(metadata) {
        const parts = [];

        // Title and year
        if (metadata.title) {
            parts.push(`Title: ${metadata.title}`);
        }
        if (metadata.year) {
            parts.push(`Year: ${metadata.year}`);
        }

        // Media type
        if (metadata.media_type) {
            const typeLabel = metadata.media_type === 'movie' ? 'Movie' : 'TV Series';
            parts.push(`Type: ${typeLabel}`);
        }

        // Genres
        const genreNames = normalizeMetadataList(metadata.genres).slice(0, 5);
        if (genreNames.length > 0) {
            parts.push(`Genres: ${genreNames.join(', ')}`);
        }

        // Certification/Rating
        const certification = this.safeGet(metadata, 'certification') ||
            this.safeGet(metadata, 'content_rating');
        if (certification) {
            parts.push(`Rating: ${certification}`);
        }

        // Original language
        if (metadata.original_language) {
            parts.push(`Language: ${metadata.original_language}`);
        }

        // Studio/Production companies (top 3)
        const studios = this.safeGet(metadata, 'production_companies', []);
        if (studios && studios.length > 0) {
            const studioNames = this.extractNames(studios, 3);
            if (studioNames.length > 0) {
                parts.push(`Studio: ${studioNames.join(', ')}`);
            }
        }

        // Franchise/Collection
        const collection = this.safeGet(metadata, 'belongs_to_collection');
        if (collection) {
            const franchiseName = typeof collection === 'object'
                ? collection.name
                : collection;
            if (franchiseName) {
                parts.push(`Franchise: ${franchiseName}`);
            }
        }

        // Cast (top 3)
        const cast = this.safeGet(metadata, 'cast', []);
        if (cast && cast.length > 0) {
            const castNames = this.extractNames(cast, 3);
            if (castNames.length > 0) {
                parts.push(`Cast: ${castNames.join(', ')}`);
            }
        }

        // Keywords (top 8)
        const keywordNames = normalizeMetadataList(metadata.keywords).slice(0, 8);
        if (keywordNames.length > 0) {
            parts.push(`Keywords: ${keywordNames.join(', ')}`);
        }

        // Vote average/Score
        const voteAverage = this.safeGet(metadata, 'vote_average');
        if (voteAverage !== null && voteAverage !== undefined && !isNaN(parseFloat(voteAverage))) {
            parts.push(`Score: ${parseFloat(voteAverage).toFixed(1)}/10`);
        }

        // Library if known
        if (metadata.library_name) {
            parts.push(`Classified: ${metadata.library_name}`);
        }

        // Overview (truncated to 300 chars)
        if (metadata.overview) {
            const truncatedOverview = metadata.overview.length > 300
                ? metadata.overview.slice(0, 300) + '...'
                : metadata.overview;
            parts.push(`Synopsis: ${truncatedOverview}`);
        }

        return parts.join(' | ').trim();
    }

    /**
     * Check if embedding version mismatch exists
     * @returns {Promise<boolean>} True if mismatch detected
     */
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

    /**
     * Generate and store embedding for a classification
     * @param {number} classificationId - ID of classification_history record
     * @param {object} metadata - Classification metadata
     * @returns {Promise<object>} Stored embedding info
     */
    async generateAndStore(classificationId, metadata) {
        try {
            // Embeddings are strictly optional. If RAG is disabled, do not treat this as an error and
            // do not enqueue retries. This keeps Classifarr behavior identical to pre-RAG installs.
            const ragEnabled = await embeddingRouter.isEnabled();
            if (!ragEnabled) {
                logger.debug('RAG disabled; skipping embedding generation', { classificationId });
                return null;
            }

            // Format metadata for embedding
            const text = this.formatForEmbedding(metadata);

            if (!text || text.length < 10) {
                logger.warn('Text too short for embedding', { classificationId, textLength: text?.length });
                throw new Error('Text too short for embedding');
            }

            // Generate embedding
            const result = await embeddingRouter.embed(text);

            // Reset offline state if successful
            if (this.isProviderOffline) {
                logger.info('Embedding provider detected as back online');
                this.isProviderOffline = false;
            }

            // Store embedding
            const stored = await this.storeEmbedding(classificationId, result);

            // Best-effort image embedding (non-blocking for text)
            try {
                await this.generateImageEmbedding(classificationId, metadata);
            } catch (imageError) {
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
            // Check for connection refusal (provider offline)
            const isConnectionError = error.message.includes('ECONNREFUSED') || 
                                     error.message.includes('ETIMEDOUT') ||
                                     error.message.includes('fetch failed');

            if (isConnectionError) {
                // Only log the first time we detect it's offline
                if (!this.isProviderOffline) {
                    logger.error('Embedding provider is offline', { error: error.message });
                    this.isProviderOffline = true;
                }
                
                // Propagate specific error so caller can back off
                throw new Error('PROVIDER_OFFLINE');
            }

            // For other errors, log normally
            logger.error('Failed to generate embedding', {
                classificationId,
                error: error.message
            });

            // Add to retry queue only for non-connection errors
            await this.addToRetryQueue(classificationId, error.message);
            return null;
        }
    }

    /**
     * Generate and store image embedding only (no text regeneration)
     */
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

            if (isConnectionError) {
                throw new Error('PROVIDER_OFFLINE');
            }

            throw error;
        }
    }

    /**
     * Store image embedding fields (best-effort; does not change text embedding)
     */
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
                    // All schema DDL must run on a single pinned client — pool.query() dispatches
                    // each statement to a random idle connection, breaking transaction isolation.
                    // CREATE INDEX (especially HNSW) is intentionally excluded: HNSW builds are
                    // CPU-proportional to table size and can block for minutes. B-tree supporting
                    // indexes are also excluded so the heal transaction stays minimal.
                    // All three indexes are rebuilt asynchronously via a rebuild_hnsw_index task.
                    await db.withTransaction(async (client) => {
                        await client.query('DROP INDEX IF EXISTS idx_embeddings_image_hnsw');
                        await client.query('DROP INDEX IF EXISTS idx_embeddings_image_present');
                        await client.query('DROP INDEX IF EXISTS idx_embeddings_image_hash');
                        await client.query('ALTER TABLE classification_embeddings DROP COLUMN image_embedding');
                        await client.query(`ALTER TABLE classification_embeddings ADD COLUMN image_embedding vector(${targetDims})`); // sql-interpolation: DDL - dimension is a validated internal integer, $N params are not supported in DDL
                        // Index creation is deferred — see rebuild_hnsw_index task enqueued below.
                    });

                    // Enqueue a background task to rebuild all three image indexes with
                    // CREATE INDEX CONCURRENTLY, which cannot run inside a transaction.
                    await db.query(
                        `INSERT INTO task_queue (task_type, payload, priority, source, max_attempts)
                         VALUES ('rebuild_hnsw_index', $1::jsonb, 5, 'system', 3)`,
                        [JSON.stringify({ reason: 'image_dimension_mismatch', targetDims })]
                    );

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

    /**
     * Store embedding in database
     */
    async storeEmbedding(classificationId, embeddingResult) {
        try {
            // Convert embedding array to pgvector format
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

            // Clean up any retry queue entry for this classification since it's now complete
            await db.query('DELETE FROM embedding_retry_queue WHERE classification_id = $1', [classificationId]);

            return {
                id: result.rows[0].id,
                dims: embeddingResult.dims,
                provider: embeddingResult.provider
            };
        } catch (error) {
            // Check for dimension mismatch (pgvector error)
            // Error can look like: "expected 768 dimensions, not 1536" OR "different vector dimensions 768 and 1024"
            const isDimensionMismatch =
                (error.message.includes('expected') && error.message.includes('dimensions')) ||
                (error.message.includes('different') && error.message.includes('vector') && error.message.includes('dimensions'));

            if (isDimensionMismatch) {
                const targetDims = embeddingResult.dims;
                logger.warn(`Dimension mismatch detected (Target: ${targetDims}). Auto-healing database schema...`);

                try {
                    // Truncate and alter table to match new dimension
                    // We must truncate because existing vectors are incompatible
                    // Strategy: Drop and recreate column to avoid pgvector casting issues
                    // All DDL must run on a single pinned client — pool.query() dispatches each
                    // statement to a random idle connection, breaking transaction isolation for DDL.
                    await db.withTransaction(async (client) => {
                        await client.query('TRUNCATE TABLE classification_embeddings');
                        await client.query('ALTER TABLE classification_embeddings DROP COLUMN embedding');
                        await client.query(`ALTER TABLE classification_embeddings ADD COLUMN embedding vector(${targetDims})`); // sql-interpolation: DDL - dimension is a validated internal integer, $N params are not supported in DDL
                        // Dropping the column removes dependent indexes; the migration runner
                        // recreates them. Safe to skip here since the table was truncated anyway.
                    });

                    logger.info(`Schema auto-healed to vector(${targetDims}). Retrying storage...`);

                    // Retry storage once
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
                    throw error; // Throw original error if healing fails
                }
            }

            logger.error('Failed to store embedding', { error: error.message });
            throw error;
        }
    }

    /**
     * Mark embeddings as stale (when provider changes)
     * @param {string} oldProvider - Previous provider
     * @param {string} oldModel - Previous model
     */
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

    /**
     * Add failed embedding to retry queue
     */
    async addToRetryQueue(classificationId, errorMessage) {
        try {
            await db.query(`
                INSERT INTO embedding_retry_queue 
                (classification_id, last_error, next_retry_at)
                VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
                ON CONFLICT DO NOTHING
            `, [classificationId, errorMessage]);
        } catch (error) {
            logger.warn('Failed to add to retry queue', { error: error.message });
        }
    }

    /**
     * Process retry queue
     */
    async processRetryQueue() {
        try {
            const items = await db.query(`
                SELECT rq.*, ch.title, ch.media_type, ch.library_name
                FROM embedding_retry_queue rq
                JOIN classification_history ch ON rq.classification_id = ch.id
                WHERE rq.status = 'pending' 
                AND rq.next_retry_at <= NOW()
                AND rq.attempt_count < rq.max_attempts
                LIMIT 10
            `);

            for (const item of items.rows) {
                try {
                    await this.generateAndStore(item.classification_id, item);

                    // Remove from queue on success
                    await db.query(
                        'DELETE FROM embedding_retry_queue WHERE id = $1',
                        [item.id]
                    );
                } catch (error) {
                    // Update attempt count
                    await db.query(`
                        UPDATE embedding_retry_queue 
                        SET attempt_count = attempt_count + 1,
                            last_error = $1,
                            next_retry_at = NOW() + INTERVAL '15 minutes',
                            updated_at = NOW()
                        WHERE id = $2
                    `, [error.message, item.id]);
                }
            }

            return items.rows.length;
        } catch (error) {
            logger.error('Failed to process retry queue', { error: error.message });
            return 0;
        }
    }

    /**
     * Get embedding statistics
     */
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

            const queueResult = await db.query(`
                SELECT COUNT(*) as pending FROM embedding_retry_queue WHERE status = 'pending'
            `);

            const stats = result.rows[0];
            const includeImage = await this.shouldIncludeImageEmbeddings();
            const actualPending = await this.getPendingCount({ includeImage });

            return {
                total: parseInt(stats.total) || 0,
                totalEmbeddings: parseInt(stats.total) || 0,  // Alias for frontend compatibility
                stale: parseInt(stats.stale) || 0,
                providers: parseInt(stats.providers) || 0,
                avgDims: Math.round(parseFloat(stats.avg_dims)) || 0,
                pendingRetries: parseInt(queueResult.rows[0].pending) || 0,
                pendingCount: actualPending  // Fixed: Now counts actual items without embeddings
            };
        } catch (error) {
            logger.error('Failed to get embedding stats', { error: error.message });
            return null;
        }
    }

    /**
     * Get image embedding statistics
     */
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

    /**
     * Get count of pending embeddings
     */
    async getPendingCount({ includeImage = false } = {}) {
        try {
            const posterCondition = "NULLIF(COALESCE(ch.metadata->>'poster_path', ch.metadata->>'posterPath', msi.metadata->>'posterPath', msi.metadata->>'poster_path'), '') IS NOT NULL";
            const imageClause = includeImage
                ? ` OR (ce.id IS NOT NULL AND ce.image_embedding IS NULL AND ${posterCondition})`
                : '';

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM classification_history ch
                LEFT JOIN classification_embeddings ce ON ce.classification_id = ch.id
                LEFT JOIN media_server_items msi
                  ON msi.tmdb_id = ch.tmdb_id
                 AND msi.media_type = ch.media_type
                WHERE ce.id IS NULL${imageClause}
            `);

            return parseInt(result.rows[0].count) || 0;
        } catch (error) {
            logger.error('Failed to get pending count', { error: error.message });
            return 0;
        }
    }

    /**
     * Get pending embeddings breakdown (text vs image)
     */
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

    /**
     * Get pending embeddings
     */
    async getPendingEmbeddings({ limit = 10, includeImage = false } = {}) {
        try {
            const posterCondition = "NULLIF(COALESCE(ch.metadata->>'poster_path', ch.metadata->>'posterPath', msi.metadata->>'posterPath', msi.metadata->>'poster_path'), '') IS NOT NULL";
            const needsImageExpr = includeImage
                ? `(ce.id IS NOT NULL AND ce.image_embedding IS NULL AND ${posterCondition})`
                : 'false';
            const imageClause = includeImage
                ? ` OR (ce.id IS NOT NULL AND ce.image_embedding IS NULL AND ${posterCondition})`
                : '';

            const result = await db.query(`
                SELECT
                    ch.id,
                    ch.title,
                    ch.media_type,
                    ch.library_name,
                    ch.metadata,
                    (ce.id IS NULL) AS needs_text,
                    ${needsImageExpr} AS needs_image
                FROM classification_history ch
                LEFT JOIN classification_embeddings ce ON ce.classification_id = ch.id
                LEFT JOIN media_server_items msi
                  ON msi.tmdb_id = ch.tmdb_id
                 AND msi.media_type = ch.media_type
                WHERE ce.id IS NULL${imageClause}
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

    /**
     * Check if we have enough embeddings for RAG to be useful
     */
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

module.exports = new EmbeddingService();
