/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import * as db from '../config/database.mjs';
import { buildRagHealthState } from './healthCheckServiceShared.mjs';

export async function checkRAG(previous) {
    try {
        const config = await db.query(
            `SELECT
                rag_enabled,
                embedding_provider,
                embedding_model,
                rag_image_weight
             FROM ai_provider_config
             WHERE id = 1`
        );

        if (config.rows.length === 0 || !config.rows[0].rag_enabled) {
            return buildRagHealthState(previous, 'disabled');
        }

        const imageWeight = Number(config.rows[0].rag_image_weight ?? 0);
        const imageIndexRequired = Number.isFinite(imageWeight) && imageWeight > 0;

        let pgvectorAvailable = false;
        let embeddingsTableAvailable = false;
        let textIndexAvailable = false;
        let imageIndexAvailable = false;
        let prewarmAvailable = false;

        try {
            const ragReadinessResult = await db.query(`
                SELECT
                    to_regtype('public.vector') IS NOT NULL AS pgvector_available,
                    to_regclass('public.classification_embeddings') IS NOT NULL AS embeddings_table_available,
                    to_regclass('public.idx_embeddings_hnsw') IS NOT NULL AS text_index_available,
                    to_regclass('public.idx_embeddings_image_hnsw') IS NOT NULL AS image_index_available,
                    EXISTS (
                        SELECT 1
                        FROM pg_extension
                        WHERE extname = 'pg_prewarm'
                    ) AS prewarm_available
            `);
            pgvectorAvailable = ragReadinessResult.rows[0]?.pgvector_available === true;
            embeddingsTableAvailable = ragReadinessResult.rows[0]?.embeddings_table_available === true;
            textIndexAvailable = ragReadinessResult.rows[0]?.text_index_available === true;
            imageIndexAvailable = ragReadinessResult.rows[0]?.image_index_available === true;
            prewarmAvailable = ragReadinessResult.rows[0]?.prewarm_available === true;
        } catch (_pgError) {
            // pgvector or readiness metadata not available
        }

        let embeddingCount = 0;
        let staleCount = 0;
        if (embeddingsTableAvailable) {
            const countResult = await db.query('SELECT COUNT(*) FROM classification_embeddings');
            const staleResult = await db.query('SELECT COUNT(*) FROM classification_embeddings WHERE is_stale = true');
            embeddingCount = parseInt(countResult.rows[0].count) || 0;
            staleCount = parseInt(staleResult.rows[0].count) || 0;
        }

        const missingIndexes = [];
        if (!textIndexAvailable) {
            missingIndexes.push('text');
        }
        if (imageIndexRequired && !imageIndexAvailable) {
            missingIndexes.push('image');
        }

        let currentStatus = 'available';
        if (!pgvectorAvailable || !embeddingsTableAvailable) {
            currentStatus = 'unavailable';
        } else if (missingIndexes.length > 0 || !prewarmAvailable) {
            currentStatus = 'degraded';
        }

        return buildRagHealthState(previous, currentStatus, {
            lastSuccessfulCheck: currentStatus === 'available' || currentStatus === 'degraded'
                ? new Date().toISOString()
                : previous.lastSuccessfulCheck,
            pgvector: pgvectorAvailable,
            embeddingsTable: embeddingsTableAvailable,
            prewarm: prewarmAvailable,
            indexes: {
                text: textIndexAvailable,
                image: imageIndexAvailable,
                imageRequired: imageIndexRequired,
                missing: missingIndexes,
            },
            provider: config.rows[0].embedding_provider,
            model: config.rows[0].embedding_model,
            embeddingCount: embeddingCount,
            staleCount: staleCount,
        });
    } catch (error) {
        return buildRagHealthState(previous, 'error', {
            error: error.message,
        });
    }
}