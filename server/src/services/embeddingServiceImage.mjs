/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createHash } from 'node:crypto';
import * as db from '../config/database.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { imageEmbeddingProvider } from './imageEmbeddingProvider.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('EmbeddingService');

export function hashValue(value) {
    return createHash('sha256').update(value).digest('hex');
}

export function resolvePosterUrl(metadata) {
    const raw = metadata?.poster_path || metadata?.posterPath;
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://image.tmdb.org/t/p/w500${raw}`;
}

export async function resolvePosterUrlForClassification(classificationId, metadata) {
    const direct = resolvePosterUrl(metadata);
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

export async function getExistingImageEmbeddingMeta(classificationId) {
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

export function shouldReuseImageEmbedding(existing, imageHash, imageModel, imageSize) {
    if (!existing || !existing.has_image) {
        return false;
    }

    return (
        existing.image_embedding_hash === imageHash &&
        existing.image_model === imageModel &&
        Number(existing.image_embedding_size) === Number(imageSize)
    );
}

export async function shouldIncludeImageEmbeddings(config = null) {
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

export async function checkEmbeddingVersionMismatch(embeddingFormatVersion) {
    try {
        const config = await embeddingRouter.getConfig();
        const configVersion = config?.embedding_format_version || 1;

        return configVersion !== embeddingFormatVersion;
    } catch (error) {
        logger.warn('Failed to check embedding version mismatch', { error: error.message });
        return false;
    }
}
