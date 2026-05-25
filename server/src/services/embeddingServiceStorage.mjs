/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { persistRagAuditLog as persistRagAuditLogFn } from './ragAuditLogService.mjs';
import { formatVectorString } from '../utils/embeddingUtils.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';

const logger = createLogger('EmbeddingService');

export async function storeImageEmbedding({ db, logger, persistRagAuditLog }, classificationId, imageResult, { imageHash, imageSize, posterUrl } = {}) {
    if (!imageResult || !Array.isArray(imageResult.embedding)) {
        return null;
    }

    const vectorString = formatVectorString(imageResult.embedding);

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

export async function storeEmbedding({ db, logger, persistRagAuditLog }, classificationId, embeddingResult) {
    return withServiceCatch(logger, 'Failed to store embedding', async () => {
        try {
            const vectorString = formatVectorString(embeddingResult.embedding);

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

                    const vectorString = formatVectorString(embeddingResult.embedding);
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

            throw error;
        }
    });
}

export async function markStale({ db, logger }, oldProvider = null, oldModel = null) {
    return withServiceCatch(logger, 'Failed to mark embeddings stale', async () => {
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
    });
}
