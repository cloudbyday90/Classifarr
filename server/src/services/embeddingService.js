/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingRouter = require('./embeddingRouter');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EmbeddingService');

/**
 * Embedding Service
 * Handles generating, storing, and managing embeddings for classifications
 */
class EmbeddingService {
    constructor() {
        // Embedding format version for migration tracking
        this.EMBEDDING_FORMAT_VERSION = 2;
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
        if (metadata.genres && metadata.genres.length > 0) {
            const genreNames = this.extractNames(metadata.genres, 5);
            if (genreNames.length > 0) {
                parts.push(`Genres: ${genreNames.join(', ')}`);
            }
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
        if (metadata.keywords && metadata.keywords.length > 0) {
            const keywordNames = this.extractNames(metadata.keywords, 8);
            if (keywordNames.length > 0) {
                parts.push(`Keywords: ${keywordNames.join(', ')}`);
            }
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
            // Format metadata for embedding
            const text = this.formatForEmbedding(metadata);

            if (!text || text.length < 10) {
                logger.warn('Text too short for embedding', { classificationId, textLength: text?.length });
                throw new Error('Text too short for embedding');
            }

            // Generate embedding
            const result = await embeddingRouter.embed(text);

            // Store embedding
            const stored = await this.storeEmbedding(classificationId, result);

            logger.info('Embedding generated and stored', {
                classificationId,
                dims: result.dims,
                provider: result.provider,
                cost: result.cost
            });

            return stored;
        } catch (error) {
            logger.error('Failed to generate embedding', {
                classificationId,
                error: error.message
            });

            // Add to retry queue
            await this.addToRetryQueue(classificationId, error.message);
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
                    await db.query('BEGIN');
                    await db.query('TRUNCATE TABLE classification_embeddings');
                    await db.query('ALTER TABLE classification_embeddings DROP COLUMN embedding');
                    await db.query(`ALTER TABLE classification_embeddings ADD COLUMN embedding vector(${targetDims})`);

                    // Re-create the index if needed (though dropping column usually drops index)
                    // We'll create a basic IVFFLAT index for now if rows > 0, but since we truncated, 
                    // we don't need to index immediately. The migration logic handles index creation usually.

                    await db.query('COMMIT');

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
                    await db.query('ROLLBACK');
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
            return {
                total: parseInt(stats.total) || 0,
                totalEmbeddings: parseInt(stats.total) || 0,  // Alias for frontend compatibility
                stale: parseInt(stats.stale) || 0,
                providers: parseInt(stats.providers) || 0,
                avgDims: Math.round(parseFloat(stats.avg_dims)) || 0,
                pendingRetries: parseInt(queueResult.rows[0].pending) || 0,
                pendingCount: parseInt(queueResult.rows[0].pending) || 0  // Alias for frontend compatibility
            };
        } catch (error) {
            logger.error('Failed to get embedding stats', { error: error.message });
            return null;
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
        } catch (error) {
            return false;
        }
    }
}

module.exports = new EmbeddingService();
