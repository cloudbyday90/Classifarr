/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { validateEmbeddingResult } from '../utils/embeddingValidation.mjs';
import { formatVectorString } from '../utils/embeddingUtils.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';

export async function storeImageEmbedding({ db, logger }, classificationId, imageResult, { imageHash, imageSize, posterUrl } = {}) {
    try {
        validateEmbeddingResult(imageResult);
        const vectorString = formatVectorString(imageResult.embedding);
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
        logger.error('Failed to store image embedding', { classificationId, error: error.message });
        return null;
    }
}

export async function storeEmbedding({ db, logger }, classificationId, embeddingResult) {
    return withServiceCatch(logger, 'Failed to store embedding', async () => {
        validateEmbeddingResult(embeddingResult);
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
