/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('EmbeddingService');

const POSTER_CONDITION = "NULLIF(COALESCE(ch.metadata->>'poster_path', ch.metadata->>'posterPath', msi.metadata->>'posterPath', msi.metadata->>'poster_path'), '') IS NOT NULL";

export async function getStats({ db, logger }, shouldIncludeImageEmbeddings) {
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
        const includeImage = await shouldIncludeImageEmbeddings();
        const actualPending = await getPendingCount({ db, logger }, { includeImage });

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

export async function getImageStats({ db, logger }) {
    try {
        const result = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE ce.image_embedding IS NOT NULL) as total,
                COUNT(*) FILTER (
                    WHERE ce.image_embedding IS NULL
                    AND ${POSTER_CONDITION}
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

export async function getPendingCount({ db, logger }, { includeText = true, includeImage = false } = {}) {
    try {
        const filters = [];

        if (includeText) {
            filters.push('ce.id IS NULL');
        }

        if (includeImage) {
            filters.push(`(ce.id IS NOT NULL AND ce.image_embedding IS NULL AND ${POSTER_CONDITION})`);
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

export async function getPendingBreakdown({ db, logger }) {
    try {
        const result = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE ce.id IS NULL) AS pending_text,
                COUNT(*) FILTER (
                    WHERE ce.id IS NOT NULL
                    AND ce.image_embedding IS NULL
                    AND ${POSTER_CONDITION}
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

export async function getPendingEmbeddings({ db, logger }, { limit = 10, includeText = true, includeImage = false } = {}) {
    try {
        const needsTextExpr = includeText
            ? '(ce.id IS NULL)'
            : 'false';
        const needsImageExpr = includeImage
            ? `(ce.id IS NOT NULL AND ce.image_embedding IS NULL AND ${POSTER_CONDITION})`
            : 'false';
        const filters = [];

        if (includeText) {
            filters.push('ce.id IS NULL');
        }

        if (includeImage) {
            filters.push(`(ce.id IS NOT NULL AND ce.image_embedding IS NULL AND ${POSTER_CONDITION})`);
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

export async function hasMinimumEmbeddings({ db, embeddingRouter }) {
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
